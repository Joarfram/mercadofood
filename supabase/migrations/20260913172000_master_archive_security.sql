-- Hardening do ciclo de vida das empresas no MercadoMaster.
-- Objetivos:
-- 1) empresa arquivada não pode continuar acessível pelo cliente;
-- 2) funções públicas deixam de expor dados de empresa arquivada;
-- 3) exclusão definitiva preserva histórico de auditoria e convites.

alter table public.support_audit_logs
  alter column company_id drop not null;

alter table public.support_audit_logs
  drop constraint if exists support_audit_logs_company_id_fkey,
  add constraint support_audit_logs_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete set null;

alter table public.platform_plan_invites
  drop constraint if exists platform_plan_invites_company_id_fkey,
  add constraint platform_plan_invites_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete set null;

create or replace function public.current_company_role(target_company uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when not exists (
      select 1 from public.companies c
      where c.id = target_company and c.archived_at is null
    ) then null
    when exists (
      select 1 from public.companies c
      where c.id = target_company and c.owner_id = auth.uid() and c.archived_at is null
    ) then 'owner'
    when exists (
      select 1 from public.support_sessions s
      join public.companies c on c.id = s.company_id
      where s.company_id = target_company
        and c.archived_at is null
        and s.staff_user_id = auth.uid()
        and s.ended_at is null
        and s.expires_at > now()
        and s.access_level = 'support'
    ) then 'manager'
    when exists (
      select 1 from public.support_sessions s
      join public.companies c on c.id = s.company_id
      where s.company_id = target_company
        and c.archived_at is null
        and s.staff_user_id = auth.uid()
        and s.ended_at is null
        and s.expires_at > now()
        and s.access_level = 'viewer'
    ) then 'viewer'
    else (
      select m.role
      from public.company_members m
      join public.companies c on c.id = m.company_id
      where m.company_id = target_company
        and c.archived_at is null
        and m.user_id = auth.uid()
        and m.is_active = true
      limit 1
    )
  end;
$$;

drop policy if exists "owner can read own companies" on public.companies;
create policy "owner can read own companies"
on public.companies for select
to public
using (owner_id = auth.uid() and archived_at is null);

drop policy if exists "owner can update own companies" on public.companies;
create policy "owner can update own companies"
on public.companies for update
to public
using (owner_id = auth.uid() and archived_at is null)
with check (owner_id = auth.uid() and archived_at is null);

drop policy if exists "active support reads assigned company" on public.companies;
create policy "active support reads assigned company"
on public.companies for select
to authenticated
using (
  archived_at is null and exists (
    select 1 from public.support_sessions s
    where s.company_id = companies.id
      and s.staff_user_id = (select auth.uid())
      and s.ended_at is null
      and s.expires_at > now()
  )
);

drop policy if exists "authorized support updates assigned company" on public.companies;
create policy "authorized support updates assigned company"
on public.companies for update
to authenticated
using (
  archived_at is null and exists (
    select 1 from public.support_sessions s
    where s.company_id = companies.id
      and s.staff_user_id = (select auth.uid())
      and s.access_level = 'support'
      and s.ended_at is null
      and s.expires_at > now()
  )
)
with check (
  archived_at is null and exists (
    select 1 from public.support_sessions s
    where s.company_id = companies.id
      and s.staff_user_id = (select auth.uid())
      and s.access_level = 'support'
      and s.ended_at is null
      and s.expires_at > now()
  )
);

create or replace function public.get_public_service_config(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'delivery_enabled', delivery_enabled,
    'pickup_enabled', pickup_enabled,
    'average_delivery_minutes', average_delivery_minutes
  )
  from public.companies
  where slug = p_slug
    and status = 'active'
    and menu_is_active = true
    and archived_at is null;
$$;

create or replace function public.get_public_delivery_zones(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', z.id,
        'name', z.name,
        'delivery_fee', z.delivery_fee,
        'minimum_order', z.minimum_order,
        'estimated_minutes', z.estimated_minutes
      ) order by z.name
    ),
    '[]'::jsonb
  )
  from public.delivery_zones z
  join public.companies c on c.id = z.company_id
  where c.slug = p_slug
    and c.status = 'active'
    and c.menu_is_active = true
    and c.archived_at is null
    and z.is_active = true;
$$;

create or replace function public.has_public_combos(p_slug text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists(
    select 1
    from public.combos x
    join public.companies c on c.id = x.company_id
    where c.slug = p_slug
      and c.status = 'active'
      and c.menu_is_active = true
      and c.archived_at is null
      and x.is_active = true
  );
$$;

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
set search_path to 'public'
as $$
declare
  target_company uuid;
  created_id uuid;
begin
  select id into target_company
  from public.companies
  where slug = lower(trim(p_slug))
    and status = 'active'
    and archived_at is null
    and coalesce(menu_is_active, true) = true;

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

create or replace function public.get_public_table_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'table', jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code, 'status', t.status, 'seats', t.seats),
    'company', jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug),
    'tab', case when tt.id is null then null else jsonb_build_object('id', tt.id, 'customer_name', tt.customer_name, 'status', tt.status, 'subtotal', tt.subtotal, 'service_charge', tt.service_charge, 'total', tt.total) end,
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description, 'price', p.base_price, 'category_id', p.category_id) order by p.name) from public.products p where p.company_id=t.company_id and p.is_active=true and p.availability_status='available'), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', ca.id, 'name', ca.name) order by ca.sort_order, ca.name) from public.categories ca where ca.company_id=t.company_id and ca.is_active=true), '[]'::jsonb)
  ) into v_result
  from public.restaurant_tables t
  join public.companies c on c.id=t.company_id
  left join lateral (
    select * from public.table_tabs x
    where x.table_id=t.id and x.status in ('open','requested_closing')
    order by x.opened_at desc limit 1
  ) tt on true
  where t.public_token=upper(p_token)
    and t.is_active=true
    and c.status='active'
    and c.archived_at is null
    and c.allow_table_qr_orders=true;
  return v_result;
end;
$$;

create or replace function public.get_public_order_tracking(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'tracking_code', coalesce(d.tracking_code, o.public_code),
    'status', coalesce(d.status, o.status),
    'order_status', o.status,
    'service_type', o.service_type,
    'order_number', o.order_number,
    'customer_name', case when coalesce(o.customer_name, '') = '' then 'Cliente' else split_part(o.customer_name, ' ', 1) end,
    'driver_name', case when coalesce(dr.name, '') = '' then null else split_part(dr.name, ' ', 1) end,
    'delivery_address', jsonb_build_object('neighborhood', coalesce(d.delivery_address, o.delivery_address) ->> 'neighborhood', 'city', coalesce(d.delivery_address, o.delivery_address) ->> 'city'),
    'confirmation_code', case when d.status = 'delivering' then d.confirmation_code else null end,
    'started_at', coalesce(d.started_at, o.started_at, o.accepted_at, o.created_at),
    'completed_at', coalesce(d.completed_at, o.delivered_at),
    'updated_at', greatest(o.updated_at, coalesce(d.updated_at, o.updated_at)),
    'last_location', case when d.status = 'delivering' and loc.id is not null then jsonb_build_object('latitude', round(loc.latitude::numeric, 5), 'longitude', round(loc.longitude::numeric, 5), 'accuracy_meters', loc.accuracy_meters, 'recorded_at', loc.recorded_at) else null end,
    'events', coalesce(events.items, '[]'::jsonb)
  ) into result
  from public.orders o
  join public.companies c on c.id = o.company_id and c.archived_at is null
  left join public.deliveries d on d.order_id = o.id
  left join public.drivers dr on dr.id = d.driver_id
  left join lateral (
    select dl.id, dl.latitude, dl.longitude, dl.accuracy_meters, dl.recorded_at
    from public.driver_locations dl
    where dl.delivery_id = d.id
    order by dl.recorded_at desc limit 1
  ) loc on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('type', e.event_type, 'created_at', e.created_at) order by e.created_at asc) items
    from public.delivery_events e
    where e.delivery_id = d.id
  ) events on true
  where upper(o.public_code) = upper(trim(p_code))
     or upper(d.tracking_code) = upper(trim(p_code))
  order by d.created_at desc nulls last
  limit 1;
  return result;
end;
$$;
