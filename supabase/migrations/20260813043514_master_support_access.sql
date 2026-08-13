-- MercadoFood: Painel Master, suporte temporario por codigo e auditoria.
-- O usuario de suporte permanece autenticado na propria conta. A RLS concede
-- acesso somente a empresa vinculada a uma sessao temporaria ativa.

create extension if not exists pgcrypto;

alter table public.companies
  add column if not exists responsible_name text,
  add column if not exists last_activity_at timestamptz;

create table if not exists public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  support_level text not null check (support_level in ('viewer','support','master')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_access_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code_hash text not null,
  requested_level text not null check (requested_level in ('viewer','support')),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null unique references public.support_access_codes(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  access_level text not null check (access_level in ('viewer','support')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  last_seen_at timestamptz not null default now()
);

create table if not exists public.support_code_attempts (
  id bigint generated always as identity primary key,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);

create table if not exists public.support_audit_logs (
  id bigint generated always as identity primary key,
  session_id uuid references public.support_sessions(id) on delete set null,
  staff_user_id uuid not null references public.platform_staff(user_id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  action text not null,
  table_name text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists public.company_entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  module_key text not null,
  enabled boolean not null,
  reason text,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,module_key)
);

create index if not exists support_codes_active_idx
  on public.support_access_codes(company_id, expires_at desc)
  where used_at is null and revoked_at is null;
create index if not exists support_sessions_staff_active_idx
  on public.support_sessions(staff_user_id, expires_at desc)
  where ended_at is null;
create index if not exists support_audit_company_time_idx
  on public.support_audit_logs(company_id, occurred_at desc);
create index if not exists support_attempts_staff_time_idx
  on public.support_code_attempts(staff_user_id, attempted_at desc);

alter table public.platform_staff enable row level security;
alter table public.support_access_codes enable row level security;
alter table public.support_sessions enable row level security;
alter table public.support_code_attempts enable row level security;
alter table public.support_audit_logs enable row level security;
alter table public.company_entitlement_overrides enable row level security;

create policy "staff reads own platform profile" on public.platform_staff
for select to authenticated using (user_id = (select auth.uid()) and is_active);

create policy "company managers read support codes" on public.support_access_codes
for select to authenticated using (public.has_company_role(company_id,array['owner','manager']));

create policy "staff reads own support sessions" on public.support_sessions
for select to authenticated using (staff_user_id = (select auth.uid()));

create policy "company managers read support audit" on public.support_audit_logs
for select to authenticated using (public.has_company_role(company_id,array['owner','manager']));

create policy "active support reads assigned company" on public.companies
for select to authenticated using (
  exists(select 1 from public.support_sessions s
    where s.company_id=id and s.staff_user_id=(select auth.uid())
      and s.ended_at is null and s.expires_at>now())
);

create policy "authorized support updates assigned company" on public.companies
for update to authenticated using (
  exists(select 1 from public.support_sessions s where s.company_id=id
    and s.staff_user_id=(select auth.uid()) and s.access_level='support'
    and s.ended_at is null and s.expires_at>now())
) with check (
  exists(select 1 from public.support_sessions s where s.company_id=id
    and s.staff_user_id=(select auth.uid()) and s.access_level='support'
    and s.ended_at is null and s.expires_at>now())
);

create policy "company reads entitlement overrides" on public.company_entitlement_overrides
for select to authenticated using (public.current_company_role(company_id) is not null);

grant select on public.platform_staff to authenticated;
grant select on public.support_access_codes to authenticated;
grant select on public.support_sessions to authenticated;
grant select on public.support_audit_logs to authenticated;
grant select on public.company_entitlement_overrides to authenticated;

create or replace function public.company_plan_allows(target_company uuid, requested_module text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    (select o.enabled from public.company_entitlement_overrides o
      where o.company_id=target_company and o.module_key=requested_module),
    exists(select 1 from public.company_subscriptions s
      join public.plan_entitlements e on e.plan_id=s.plan_id and e.enabled=true
      where s.company_id=target_company and s.status in ('trialing','active')
        and (s.status<>'trialing' or s.trial_ends_at is null or s.trial_ends_at>now())
        and e.module_key=requested_module),
    false
  );
$$;

create or replace function public.platform_support_level(target_user uuid default auth.uid())
returns text language sql stable security definer set search_path=public as $$
  select support_level from public.platform_staff
  where user_id=target_user and is_active=true;
$$;

create or replace function public.active_support_session(target_company uuid, target_user uuid default auth.uid())
returns public.support_sessions
language sql stable security definer set search_path=public as $$
  select s.* from public.support_sessions s
  where s.company_id=target_company
    and s.staff_user_id=target_user
    and s.ended_at is null
    and s.expires_at > now()
  order by s.started_at desc limit 1;
$$;

-- Integra o suporte a autorizacao central existente. Um codigo de visualizacao
-- equivale ao papel viewer; suporte equivale a manager. Master nunca e obtido
-- por codigo e continua restrito ao Painel Master.
create or replace function public.current_company_role(target_company uuid)
returns text language sql stable security definer set search_path=public as $$
  select case
    when exists(select 1 from public.companies c where c.id=target_company and c.owner_id=auth.uid()) then 'owner'
    when exists(
      select 1 from public.support_sessions s
      where s.company_id=target_company and s.staff_user_id=auth.uid()
        and s.ended_at is null and s.expires_at>now() and s.access_level='support'
    ) then 'manager'
    when exists(
      select 1 from public.support_sessions s
      where s.company_id=target_company and s.staff_user_id=auth.uid()
        and s.ended_at is null and s.expires_at>now() and s.access_level='viewer'
    ) then 'viewer'
    else (
      select m.role from public.company_members m
      where m.company_id=target_company and m.user_id=auth.uid() and m.is_active=true
      limit 1
    )
  end;
$$;

create or replace function public.is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.current_company_role(target_company) is not null;
$$;

-- Remove politicas antigas de CRUD total. Elas permitiam escrita para qualquer
-- membro (inclusive viewer). As politicas abaixo separam leitura e mutacao.
drop policy if exists "company products" on public.products;
create policy "authorized roles read products" on public.products for select to authenticated
using (public.current_company_role(company_id) is not null);
create policy "authorized roles insert products" on public.products for insert to authenticated
with check (public.can_access_module(company_id,'products') and public.current_company_role(company_id)<>'viewer');
create policy "authorized roles update products" on public.products for update to authenticated
using (public.can_access_module(company_id,'products') and public.current_company_role(company_id)<>'viewer')
with check (public.can_access_module(company_id,'products') and public.current_company_role(company_id)<>'viewer');
create policy "authorized roles delete products" on public.products for delete to authenticated
using (public.can_access_module(company_id,'products') and public.current_company_role(company_id)<>'viewer');

drop policy if exists "company drivers" on public.drivers;
create policy "authorized roles read drivers" on public.drivers for select to authenticated
using (public.can_access_module(company_id,'delivery'));
create policy "authorized roles manage drivers" on public.drivers for all to authenticated
using (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer')
with check (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer');

drop policy if exists "company deliveries" on public.deliveries;
create policy "authorized roles read deliveries" on public.deliveries for select to authenticated
using (public.can_access_module(company_id,'delivery'));
create policy "authorized roles manage deliveries" on public.deliveries for all to authenticated
using (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer')
with check (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer');

create or replace function public.generate_support_code(
  target_company uuid,
  requested_access text default 'support',
  validity_minutes integer default 30
)
returns table(code text, expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare generated_code text; generated_expiry timestamptz;
begin
  if not public.has_company_role(target_company,array['owner','manager']) then
    raise exception 'Acesso negado.';
  end if;
  if requested_access not in ('viewer','support') then raise exception 'Nivel de suporte invalido.'; end if;
  validity_minutes := greatest(5,least(coalesce(validity_minutes,30),60));
  generated_expiry := now() + make_interval(mins=>validity_minutes);

  update public.support_access_codes set revoked_at=now()
  where company_id=target_company and used_at is null and revoked_at is null and expires_at>now();

  loop
    generated_code := lpad(floor(random()*1000000)::integer::text,6,'0');
    exit when not exists (
      select 1 from public.support_access_codes
      where code_hash=encode(digest(generated_code,'sha256'),'hex')
        and used_at is null and revoked_at is null and expires_at>now()
    );
  end loop;

  insert into public.support_access_codes(company_id,code_hash,requested_level,created_by,expires_at)
  values(target_company,encode(digest(generated_code,'sha256'),'hex'),requested_access,auth.uid(),generated_expiry);
  return query select generated_code,generated_expiry;
end;
$$;

create or replace function public.redeem_support_code(submitted_code text)
returns table(session_id uuid, company_id uuid, company_name text, access_level text, session_expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare matched public.support_access_codes%rowtype; staff_level text; new_session public.support_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Faca login para continuar.'; end if;
  staff_level := public.platform_support_level(auth.uid());
  if staff_level is null then raise exception 'Usuario nao autorizado para atendimento.'; end if;
  if submitted_code !~ '^[0-9]{6}$' then raise exception 'Codigo invalido.'; end if;
  if (select count(*) from public.support_code_attempts where staff_user_id=auth.uid() and attempted_at>now()-interval '10 minutes') >= 5 then
    raise exception 'Muitas tentativas. Aguarde 10 minutos.';
  end if;

  insert into public.support_code_attempts(staff_user_id) values(auth.uid());
  select * into matched from public.support_access_codes
  where code_hash=encode(digest(submitted_code,'sha256'),'hex')
    and used_at is null and revoked_at is null and expires_at>now()
  order by created_at desc limit 1 for update skip locked;
  if matched.id is null then raise exception 'Codigo invalido, expirado ou ja utilizado.'; end if;
  if staff_level='viewer' and matched.requested_level<>'viewer' then
    raise exception 'Seu nivel permite somente atendimentos de visualizacao.';
  end if;

  update public.support_access_codes set used_at=now(),used_by=auth.uid() where id=matched.id;
  update public.support_code_attempts set succeeded=true
  where id=(select id from public.support_code_attempts where staff_user_id=auth.uid() order by id desc limit 1);
  insert into public.support_sessions(code_id,company_id,staff_user_id,access_level,expires_at)
  values(matched.id,matched.company_id,auth.uid(),matched.requested_level,now()+interval '2 hours') returning * into new_session;
  insert into public.support_audit_logs(session_id,staff_user_id,company_id,action,metadata)
  values(new_session.id,auth.uid(),matched.company_id,'support.session_started',jsonb_build_object('access_level',matched.requested_level));
  return query select new_session.id,c.id,c.name,new_session.access_level,new_session.expires_at
  from public.companies c where c.id=matched.company_id;
end;
$$;

create or replace function public.get_support_context(target_session uuid)
returns table(session_id uuid, company_id uuid, company_name text, company_slug text, access_level text, expires_at timestamptz)
language sql volatile security definer set search_path=public as $$
  update public.support_sessions s set last_seen_at=now()
  where s.id=target_session and s.staff_user_id=auth.uid() and s.ended_at is null and s.expires_at>now()
  returning s.id,s.company_id,
    (select c.name from public.companies c where c.id=s.company_id),
    (select c.slug from public.companies c where c.id=s.company_id),
    s.access_level,s.expires_at;
$$;

create or replace function public.end_support_session(target_session uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare ended public.support_sessions%rowtype;
begin
  update public.support_sessions set ended_at=now()
  where id=target_session and staff_user_id=auth.uid() and ended_at is null returning * into ended;
  if ended.id is null then return false; end if;
  insert into public.support_audit_logs(session_id,staff_user_id,company_id,action)
  values(ended.id,auth.uid(),ended.company_id,'support.session_ended');
  return true;
end;
$$;

create or replace function public.audit_support_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
declare row_company uuid; active_session public.support_sessions%rowtype; row_id text;
begin
  row_company := case when tg_table_name='companies'
    then coalesce((to_jsonb(new)->>'id')::uuid,(to_jsonb(old)->>'id')::uuid)
    else coalesce((to_jsonb(new)->>'company_id')::uuid,(to_jsonb(old)->>'company_id')::uuid) end;
  select * into active_session from public.active_support_session(row_company,auth.uid());
  if active_session.id is not null then
    row_id := coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id');
    insert into public.support_audit_logs(session_id,staff_user_id,company_id,action,table_name,record_id,old_values,new_values)
    values(active_session.id,auth.uid(),row_company,'support.'||lower(tg_op),tg_table_name,row_id,
      case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
      case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  end if;
  if tg_table_name<>'companies' then update public.companies set last_activity_at=now() where id=row_company; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

-- Instala auditoria em todas as tabelas de negocio com company_id. A lista e
-- descoberta pelo catalogo para tambem cobrir modulos ja existentes.
do $$
declare tenant_table record;
begin
  for tenant_table in
    select distinct c.table_name from information_schema.columns c
    where c.table_schema='public' and c.column_name='company_id'
      and c.table_name not in ('support_access_codes','support_sessions','support_audit_logs')
  loop
    execute format('drop trigger if exists support_audit_mutation on public.%I',tenant_table.table_name);
    execute format('create trigger support_audit_mutation after insert or update or delete on public.%I for each row execute function public.audit_support_mutation()',tenant_table.table_name);
  end loop;
end $$;

drop trigger if exists support_audit_mutation on public.companies;
create trigger support_audit_mutation after update on public.companies
for each row execute function public.audit_support_mutation();

revoke all on function public.platform_support_level(uuid) from public,anon,authenticated;
revoke all on function public.active_support_session(uuid,uuid) from public,anon,authenticated;
revoke all on function public.generate_support_code(uuid,text,integer) from public,anon;
revoke all on function public.redeem_support_code(text) from public,anon;
revoke all on function public.get_support_context(uuid) from public,anon;
revoke all on function public.end_support_session(uuid) from public,anon;
revoke all on function public.audit_support_mutation() from public,anon,authenticated;
grant execute on function public.generate_support_code(uuid,text,integer) to authenticated;
grant execute on function public.redeem_support_code(text) to authenticated;
grant execute on function public.get_support_context(uuid) to authenticated;
grant execute on function public.end_support_session(uuid) to authenticated;

comment on table public.platform_staff is 'Equipe interna MercadoFood. Promocao para master deve ser feita manualmente e auditada.';
comment on table public.support_access_codes is 'Codigos de uso unico; somente o hash e armazenado.';
comment on table public.support_audit_logs is 'Trilha imutavel de sessoes e alteracoes feitas durante suporte.';
