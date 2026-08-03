-- Central de mensagens, feedback e avaliações do cardápio público.
create table if not exists public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_name text,
  customer_contact text,
  category text not null check (category in ('feedback','suggestion','complaint','praise')),
  rating smallint not null check (rating between 1 and 5),
  message text not null check (char_length(message) between 5 and 2000),
  status text not null default 'new' check (status in ('new','read','replied','archived')),
  owner_reply text check (owner_reply is null or char_length(owner_reply) between 1 and 2000),
  replied_by uuid references auth.users(id) on delete set null,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_messages_company_status_idx
  on public.customer_messages(company_id,status,created_at desc);

alter table public.customer_messages enable row level security;

drop policy if exists "company reads customer messages" on public.customer_messages;
create policy "company reads customer messages" on public.customer_messages
for select to authenticated
using (public.has_company_role(company_id,array['owner','manager','attendant']));

drop policy if exists "company updates customer messages" on public.customer_messages;
create policy "company updates customer messages" on public.customer_messages
for update to authenticated
using (public.has_company_role(company_id,array['owner','manager','attendant']))
with check (public.has_company_role(company_id,array['owner','manager','attendant']));

drop policy if exists "owners delete customer messages" on public.customer_messages;
create policy "owners delete customer messages" on public.customer_messages
for delete to authenticated
using (public.has_company_role(company_id,array['owner','manager']));

grant select,update,delete on public.customer_messages to authenticated;

create or replace function public.submit_public_feedback(
  p_slug text,
  p_customer_name text,
  p_customer_contact text,
  p_category text,
  p_rating integer,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_company uuid;
  created_id uuid;
begin
  select id into target_company
  from public.companies
  where slug = lower(trim(p_slug))
    and coalesce(menu_is_active,true) = true;

  if target_company is null then raise exception 'Estabelecimento não encontrado.'; end if;
  if p_category not in ('feedback','suggestion','complaint','praise') then raise exception 'Tipo de mensagem inválido.'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Escolha uma avaliação de 1 a 5 estrelas.'; end if;
  if char_length(trim(coalesce(p_message,''))) < 5 or char_length(trim(coalesce(p_message,''))) > 2000 then
    raise exception 'A mensagem deve ter entre 5 e 2.000 caracteres.';
  end if;

  insert into public.customer_messages(company_id,customer_name,customer_contact,category,rating,message)
  values (
    target_company,
    nullif(left(trim(coalesce(p_customer_name,'')),120),''),
    nullif(left(trim(coalesce(p_customer_contact,'')),160),''),
    p_category,p_rating,trim(p_message)
  ) returning id into created_id;
  return created_id;
end;
$$;

revoke all on function public.submit_public_feedback(text,text,text,text,integer,text) from public;
grant execute on function public.submit_public_feedback(text,text,text,text,integer,text) to anon,authenticated;

insert into public.plan_entitlements(plan_id,module_key,enabled)
select id,'messages',true from public.subscription_plans
on conflict(plan_id,module_key) do update set enabled=true;
