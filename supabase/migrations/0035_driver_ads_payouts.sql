-- Publicidade no app do entregador e repasses PIX auditáveis.

create table if not exists public.driver_payout_accounts (
  driver_id uuid primary key references public.drivers(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  payout_method text not null default 'pix' check (payout_method in ('pix','bank')),
  pix_key_type text,
  pix_key text,
  holder_name text not null,
  city text,
  bank_name text,
  bank_branch text,
  bank_account text,
  bank_account_type text,
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_payouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  delivery_count integer not null default 0 check (delivery_count >= 0),
  period_start timestamptz,
  period_end timestamptz,
  status text not null default 'pending' check (status in ('pending','paid','confirmed','canceled')),
  payment_method text not null default 'pix' check (payment_method in ('pix','bank')),
  payment_reference text,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deliveries add column if not exists payout_id uuid references public.driver_payouts(id) on delete set null;
create index if not exists driver_payouts_company_created_idx on public.driver_payouts(company_id, created_at desc);
create index if not exists driver_payouts_driver_status_idx on public.driver_payouts(driver_id, status, created_at desc);
create index if not exists deliveries_payout_idx on public.deliveries(payout_id) where payout_id is not null;

alter table public.driver_payouts enable row level security;
alter table public.driver_payout_accounts enable row level security;

drop policy if exists "owner manages driver payout accounts" on public.driver_payout_accounts;
create policy "owner manages driver payout accounts" on public.driver_payout_accounts for all to authenticated
using (public.has_company_role(company_id,array['owner']))
with check (public.has_company_role(company_id,array['owner']));
drop policy if exists "driver reads own payout account" on public.driver_payout_accounts;
create policy "driver reads own payout account" on public.driver_payout_accounts for select to authenticated
using (exists (select 1 from public.drivers d where d.id=driver_id and d.auth_user_id=auth.uid()));

drop policy if exists "company manages driver payouts" on public.driver_payouts;
create policy "company manages driver payouts" on public.driver_payouts for all to authenticated
using (public.has_company_role(company_id, array['owner']))
with check (public.has_company_role(company_id, array['owner']));

drop policy if exists "driver reads own payouts" on public.driver_payouts;
create policy "driver reads own payouts" on public.driver_payouts for select to authenticated
using (exists (select 1 from public.drivers d where d.id = driver_id and d.auth_user_id = auth.uid()));

grant select, insert, update, delete on public.driver_payouts to authenticated;
grant select, insert, update, delete on public.driver_payout_accounts to authenticated;

-- O motoboy atualiza apenas os dados de recebimento por esta função.
drop policy if exists "driver updates own profile" on public.drivers;
create or replace function public.update_own_driver_payout_profile(
  p_method text,
  p_pix_key_type text,
  p_pix_key text,
  p_holder_name text,
  p_city text,
  p_bank_name text,
  p_bank_branch text,
  p_bank_account text,
  p_bank_account_type text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_driver public.drivers%rowtype;
begin
  if p_method not in ('pix','bank') then raise exception 'Forma de recebimento inválida.'; end if;
  if length(trim(coalesce(p_holder_name,''))) < 3 then raise exception 'Informe o nome do titular.'; end if;
  if p_method = 'pix' and (length(trim(coalesce(p_pix_key,''))) < 3 or length(trim(coalesce(p_city,''))) < 2) then
    raise exception 'Informe a chave PIX e a cidade.';
  end if;
  if p_method = 'bank' and (length(trim(coalesce(p_bank_name,''))) < 2 or length(trim(coalesce(p_bank_account,''))) < 2) then
    raise exception 'Informe banco e conta.';
  end if;
  select * into v_driver from public.drivers where auth_user_id=auth.uid();
  if v_driver.id is null then raise exception 'Cadastro do motoboy não encontrado.'; end if;
  insert into public.driver_payout_accounts(driver_id,company_id,payout_method,pix_key_type,pix_key,holder_name,city,bank_name,bank_branch,bank_account,bank_account_type,updated_at)
  values(v_driver.id,v_driver.company_id,p_method,nullif(trim(p_pix_key_type),''),nullif(trim(p_pix_key),''),trim(p_holder_name),nullif(upper(trim(p_city)),''),nullif(trim(p_bank_name),''),nullif(trim(p_bank_branch),''),nullif(trim(p_bank_account),''),nullif(trim(p_bank_account_type),''),now())
  on conflict(driver_id) do update set payout_method=excluded.payout_method,pix_key_type=excluded.pix_key_type,pix_key=excluded.pix_key,holder_name=excluded.holder_name,city=excluded.city,bank_name=excluded.bank_name,bank_branch=excluded.bank_branch,bank_account=excluded.bank_account,bank_account_type=excluded.bank_account_type,updated_at=now();
end;
$$;

create or replace function public.create_driver_payout(p_driver_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_driver public.drivers%rowtype;
  v_account public.driver_payout_accounts%rowtype;
  v_payout_id uuid;
  v_amount numeric(12,2);
  v_count integer;
  v_start timestamptz;
  v_end timestamptz;
begin
  select * into v_driver from public.drivers where id = p_driver_id;
  if v_driver.id is null or not public.has_company_role(v_driver.company_id, array['owner']) then raise exception 'Acesso negado.'; end if;
  select * into v_account from public.driver_payout_accounts where driver_id=v_driver.id;
  if v_account.driver_id is null then raise exception 'O motoboy ainda não cadastrou os dados de recebimento.'; end if;
  if v_account.payout_method = 'pix' and coalesce(trim(v_account.pix_key),'') = '' then raise exception 'O motoboy ainda não cadastrou a chave PIX.'; end if;

  select coalesce(sum(delivery_value),0), count(*), min(completed_at), max(completed_at)
    into v_amount, v_count, v_start, v_end
  from public.deliveries
  where company_id = v_driver.company_id and driver_id = v_driver.id and status = 'completed' and payout_id is null;
  if v_count = 0 or v_amount <= 0 then raise exception 'Não existem entregas pendentes de repasse.'; end if;

  insert into public.driver_payouts(company_id,driver_id,amount,delivery_count,period_start,period_end,payment_method,created_by)
  values(v_driver.company_id,v_driver.id,v_amount,v_count,v_start,v_end,v_account.payout_method,auth.uid()) returning id into v_payout_id;
  update public.deliveries set payout_id = v_payout_id, updated_at = now()
  where company_id = v_driver.company_id and driver_id = v_driver.id and status = 'completed' and payout_id is null;
  return v_payout_id;
end;
$$;

create or replace function public.mark_driver_payout_paid(p_payout_id uuid, p_reference text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  select company_id into v_company from public.driver_payouts where id = p_payout_id and status = 'pending';
  if v_company is null or not public.has_company_role(v_company,array['owner']) then raise exception 'Repasse não encontrado ou acesso negado.'; end if;
  update public.driver_payouts set status='paid', payment_reference=nullif(trim(p_reference),''), paid_at=now(), paid_by=auth.uid(), updated_at=now() where id=p_payout_id;
end;
$$;

create or replace function public.confirm_own_driver_payout(p_payout_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.driver_payouts p set status='confirmed', confirmed_at=now(), updated_at=now()
  where p.id=p_payout_id and p.status='paid' and exists (
    select 1 from public.drivers d where d.id=p.driver_id and d.auth_user_id=auth.uid()
  );
  if not found then raise exception 'Repasse não encontrado ou ainda não marcado como pago.'; end if;
end;
$$;

create or replace function public.cancel_driver_payout(p_payout_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  select company_id into v_company from public.driver_payouts where id=p_payout_id and status='pending';
  if v_company is null or not public.has_company_role(v_company,array['owner']) then raise exception 'Repasse não encontrado ou acesso negado.'; end if;
  update public.deliveries set payout_id=null, updated_at=now() where payout_id=p_payout_id;
  update public.driver_payouts set status='canceled', updated_at=now() where id=p_payout_id;
end;
$$;

revoke all on function public.update_own_driver_payout_profile(text,text,text,text,text,text,text,text,text) from public;
revoke all on function public.create_driver_payout(uuid) from public;
revoke all on function public.mark_driver_payout_paid(uuid,text) from public;
revoke all on function public.confirm_own_driver_payout(uuid) from public;
revoke all on function public.cancel_driver_payout(uuid) from public;
grant execute on function public.update_own_driver_payout_profile(text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.create_driver_payout(uuid) to authenticated;
grant execute on function public.mark_driver_payout_paid(uuid,text) to authenticated;
grant execute on function public.confirm_own_driver_payout(uuid) to authenticated;
grant execute on function public.cancel_driver_payout(uuid) to authenticated;

-- Fotos da galeria da empresa são os anúncios exibidos no app do motoboy.
drop policy if exists "driver reads company app ads" on public.media_assets;
create policy "driver reads company app ads" on public.media_assets for select to authenticated
using (
  entity_type='company' and kind='gallery' and
  exists (select 1 from public.drivers d where d.company_id=media_assets.company_id and d.auth_user_id=auth.uid())
);

comment on table public.driver_payouts is 'Repasses de entregas com confirmação da loja e do motoboy.';
