-- MercadoFood v2.5: usuários, convites, papéis e permissões por empresa
create extension if not exists pgcrypto;

alter table public.company_members
  add column if not exists display_name text,
  add column if not exists phone text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

-- Amplia os papéis originalmente definidos em 0003.
alter table public.company_members
  drop constraint if exists company_members_role_check;
alter table public.company_members
  add constraint company_members_role_check
  check (role in ('owner','manager','attendant','kitchen','cashier','stock','driver','viewer'));

create table if not exists public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager','attendant','kitchen','cashier','stock','driver','viewer')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists company_invites_company_idx on public.company_invites(company_id, created_at desc);
create index if not exists company_invites_token_idx on public.company_invites(token);

alter table public.company_invites enable row level security;

do $$ begin
  create policy "owners and managers read invites" on public.company_invites
  for select using (
    public.has_company_role(company_id, array['owner','manager'])
  );
exception when undefined_function then null; when duplicate_object then null; end $$;

-- Funções auxiliares são security definer para evitar recursão das políticas RLS.
create or replace function public.current_company_role(target_company uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when exists(select 1 from public.companies c where c.id = target_company and c.owner_id = auth.uid()) then 'owner'
    else (
      select m.role from public.company_members m
      where m.company_id = target_company and m.user_id = auth.uid() and m.is_active = true
      limit 1
    )
  end;
$$;

create or replace function public.has_company_role(target_company uuid, allowed_roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_company_role(target_company) = any(allowed_roles), false);
$$;

-- Recria as políticas de convites depois das funções.
drop policy if exists "owners and managers read invites" on public.company_invites;
create policy "owners and managers read invites" on public.company_invites
for select using (public.has_company_role(company_id, array['owner','manager']));

create policy "owners and managers create invites" on public.company_invites
for insert with check (
  public.has_company_role(company_id, array['owner','manager'])
  and (
    public.current_company_role(company_id) = 'owner'
    or role <> 'manager'
  )
  and invited_by = auth.uid()
);

create policy "owners and managers update invites" on public.company_invites
for update using (
  public.current_company_role(company_id) = 'owner'
  or (
    public.current_company_role(company_id) = 'manager'
    and role <> 'manager'
  )
)
with check (
  public.current_company_role(company_id) = 'owner'
  or (
    public.current_company_role(company_id) = 'manager'
    and role <> 'manager'
  )
);

create policy "owners and managers delete invites" on public.company_invites
for delete using (
  public.current_company_role(company_id) = 'owner'
  or (
    public.current_company_role(company_id) = 'manager'
    and role <> 'manager'
  )
);

-- Convite público: retorna apenas dados mínimos necessários para a tela de aceite.
create or replace function public.get_company_invite(invite_token uuid)
returns table(company_name text, email text, role text, expires_at timestamptz, valid boolean)
language sql stable security definer set search_path = public
as $$
  select c.name, i.email, i.role, i.expires_at,
    (i.accepted_at is null and i.expires_at > now())
  from public.company_invites i
  join public.companies c on c.id = i.company_id
  where i.token = invite_token
  limit 1;
$$;

grant execute on function public.get_company_invite(uuid) to anon, authenticated;

create or replace function public.accept_company_invite(invite_token uuid, member_name text default null, member_phone text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  invite_row public.company_invites%rowtype;
  auth_email text;
begin
  if auth.uid() is null then raise exception 'Faça login para aceitar o convite.'; end if;

  select email into auth_email from auth.users where id = auth.uid();
  select * into invite_row from public.company_invites where token = invite_token for update;

  if invite_row.id is null then raise exception 'Convite não encontrado.'; end if;
  if invite_row.accepted_at is not null then raise exception 'Convite já utilizado.'; end if;
  if invite_row.expires_at <= now() then raise exception 'Convite expirado.'; end if;
  if lower(invite_row.email) <> lower(auth_email) then raise exception 'Entre com o mesmo e-mail que recebeu o convite.'; end if;

  insert into public.company_members(company_id, user_id, role, display_name, phone, is_active)
  values(invite_row.company_id, auth.uid(), invite_row.role, nullif(trim(member_name), ''), nullif(trim(member_phone), ''), true)
  on conflict(company_id, user_id) do update set
    role = excluded.role,
    display_name = coalesce(excluded.display_name, public.company_members.display_name),
    phone = coalesce(excluded.phone, public.company_members.phone),
    is_active = true,
    updated_at = now();

  update public.company_invites set accepted_at = now() where id = invite_row.id;
  return invite_row.company_id;
end;
$$;

grant execute on function public.accept_company_invite(uuid, text, text) to authenticated;

-- Proprietário e gerente podem listar membros; somente proprietário altera gerente/proprietário.
drop policy if exists "members can read own membership" on public.company_members;
drop policy if exists "owner manages members" on public.company_members;

create policy "company members can read team" on public.company_members
for select using (
  user_id = auth.uid() or public.has_company_role(company_id, array['owner','manager'])
);

create policy "owners and managers insert members" on public.company_members
for insert with check (
  (public.current_company_role(company_id) = 'owner' and role <> 'owner')
  or (
    public.current_company_role(company_id) = 'manager'
    and role not in ('owner', 'manager')
  )
);

create policy "owners and managers update members" on public.company_members
for update using (
  (public.current_company_role(company_id) = 'owner' and role <> 'owner')
  or (
    public.current_company_role(company_id) = 'manager'
    and role not in ('owner', 'manager')
  )
)
with check (
  (public.current_company_role(company_id) = 'owner' and role <> 'owner')
  or (
    public.current_company_role(company_id) = 'manager'
    and role not in ('owner', 'manager')
  )
);

create policy "owners and managers delete members" on public.company_members
for delete using (
  (public.current_company_role(company_id) = 'owner' and role <> 'owner')
  or (
    public.current_company_role(company_id) = 'manager'
    and role not in ('owner', 'manager')
  )
);

-- Permissões operacionais centralizadas.
create or replace function public.can_access_module(target_company uuid, module_name text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare r text;
begin
  r := public.current_company_role(target_company);
  if r is null then return false; end if;
  if r in ('owner','manager') then return true; end if;

  return case module_name
    when 'dashboard' then r in ('attendant','kitchen','cashier','stock','viewer')
    when 'orders' then r in ('attendant','kitchen','cashier')
    when 'products' then r in ('stock')
    when 'kitchen' then r in ('kitchen','attendant')
    when 'delivery' then r in ('attendant','driver')
    when 'payments' then r in ('cashier','attendant')
    when 'finance' then r in ('cashier')
    when 'reports' then r in ('viewer','cashier')
    when 'stock' then r in ('stock')
    when 'customers' then r in ('attendant')
    when 'promotions' then false
    when 'tables' then r in ('attendant')
    when 'settings' then false
    when 'team' then false
    else false
  end;
end;
$$;

grant execute on function public.current_company_role(uuid) to authenticated;
grant execute on function public.has_company_role(uuid, text[]) to authenticated;
grant execute on function public.can_access_module(uuid, text) to authenticated;
