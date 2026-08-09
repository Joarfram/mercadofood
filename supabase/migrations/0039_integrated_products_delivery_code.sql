-- MercadoFood: cadastro integrado de produtos e entrega confirmada pelo cliente.

alter table public.products
  add column if not exists sku text,
  add column if not exists track_stock boolean not null default false,
  add column if not exists stock_quantity numeric(14,3) not null default 0,
  add column if not exists minimum_stock numeric(14,3) not null default 0,
  add column if not exists available_delivery boolean not null default true,
  add column if not exists available_pickup boolean not null default true,
  add column if not exists available_dine_in boolean not null default true;

create unique index if not exists products_company_sku_unique
  on public.products(company_id, lower(sku)) where sku is not null and trim(sku) <> '';

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0,
  stock_quantity numeric(14,3) not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_variants_product_idx
  on public.product_variants(product_id, is_active, sort_order);

alter table public.product_variants enable row level security;
do $$ begin
  create policy "company product variants" on public.product_variants for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

alter table public.deliveries
  add column if not exists confirmation_code_hash text,
  add column if not exists confirmation_code_generated_at timestamptz,
  add column if not exists confirmation_attempts integer not null default 0,
  add column if not exists confirmation_locked_until timestamptz,
  add column if not exists confirmed_at timestamptz;

create or replace function public.start_delivery_with_confirmation(p_delivery_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_driver public.drivers%rowtype;
  v_delivery public.deliveries%rowtype;
  v_code text;
begin
  select * into v_driver from public.drivers where auth_user_id = auth.uid() limit 1;
  if v_driver.id is null then raise exception 'Entregador não autorizado'; end if;

  select * into v_delivery from public.deliveries
  where id = p_delivery_id and driver_id = v_driver.id for update;
  if v_delivery.id is null then raise exception 'Entrega não encontrada'; end if;
  if v_delivery.status <> 'waiting_pickup' then raise exception 'A entrega não está aguardando retirada'; end if;

  v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
  update public.deliveries set
    status = 'delivering', picked_up_at = now(),
    confirmation_code = v_code,
    confirmation_code_hash = crypt(v_code, gen_salt('bf')),
    confirmation_code_generated_at = now(), confirmation_attempts = 0,
    confirmation_locked_until = null, updated_at = now()
  where id = v_delivery.id;

  update public.orders set status = 'out_for_delivery', updated_at = now()
  where id = v_delivery.order_id;
  insert into public.delivery_events(delivery_id, event_type, actor_type, actor_id)
  values(v_delivery.id, 'picked_up', 'driver', v_driver.id);

  return jsonb_build_object('ok', true, 'confirmation_code', v_code);
end;
$$;

create or replace function public.confirm_delivery_with_code(p_delivery_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_driver public.drivers%rowtype;
  v_delivery public.deliveries%rowtype;
  v_attempts integer;
begin
  select * into v_driver from public.drivers where auth_user_id = auth.uid() limit 1;
  if v_driver.id is null then raise exception 'Entregador não autorizado'; end if;

  select * into v_delivery from public.deliveries
  where id = p_delivery_id and driver_id = v_driver.id for update;
  if v_delivery.id is null then raise exception 'Entrega não encontrada'; end if;
  if v_delivery.status <> 'delivering' then raise exception 'A entrega não está em andamento'; end if;
  if v_delivery.confirmation_locked_until is not null and v_delivery.confirmation_locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'message', 'Muitas tentativas. Aguarde 5 minutos.');
  end if;

  if length(trim(coalesce(p_code, ''))) <> 6
     or v_delivery.confirmation_code_hash is null
     or crypt(trim(p_code), v_delivery.confirmation_code_hash) <> v_delivery.confirmation_code_hash then
    v_attempts := coalesce(v_delivery.confirmation_attempts, 0) + 1;
    update public.deliveries set
      confirmation_attempts = case when v_attempts >= 5 then 0 else v_attempts end,
      confirmation_locked_until = case when v_attempts >= 5 then now() + interval '5 minutes' else null end,
      updated_at = now()
    where id = v_delivery.id;
    return jsonb_build_object('ok', false, 'reason', 'invalid',
      'message', case when v_attempts >= 5 then 'Muitas tentativas. Aguarde 5 minutos.' else 'Código inválido.' end,
      'attempts_remaining', greatest(0, 5 - v_attempts));
  end if;

  update public.deliveries set
    status = 'completed', completed_at = now(), confirmed_at = now(),
    confirmation_code = null, confirmation_code_hash = null,
    confirmation_attempts = 0, confirmation_locked_until = null, updated_at = now()
  where id = v_delivery.id;
  update public.orders set status = 'delivered', delivered_at = now(), updated_at = now()
  where id = v_delivery.order_id;
  update public.drivers set availability_status = 'available', updated_at = now()
  where id = v_driver.id;
  insert into public.delivery_events(delivery_id, event_type, actor_type, actor_id, payload)
  values(v_delivery.id, 'completed', 'driver', v_driver.id, '{"confirmation_method":"customer_code"}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.start_delivery_with_confirmation(uuid) from public;
revoke all on function public.confirm_delivery_with_code(uuid, text) from public;
grant execute on function public.start_delivery_with_confirmation(uuid) to authenticated;
grant execute on function public.confirm_delivery_with_code(uuid, text) to authenticated;

create or replace function public.get_public_delivery_tracking(p_tracking_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'tracking_code', d.tracking_code, 'status', d.status, 'order_number', o.order_number,
    'customer_name', case when coalesce(o.customer_name, '') = '' then 'Cliente' else split_part(o.customer_name, ' ', 1) end,
    'driver_name', case when coalesce(dr.name, '') = '' then null else split_part(dr.name, ' ', 1) end,
    'delivery_address', jsonb_build_object('neighborhood', d.delivery_address ->> 'neighborhood', 'city', d.delivery_address ->> 'city'),
    'confirmation_code', case when d.status = 'delivering' then d.confirmation_code else null end,
    'started_at', d.started_at, 'completed_at', d.completed_at, 'updated_at', d.updated_at,
    'last_location', case when d.status = 'delivering' and loc.id is not null then jsonb_build_object(
      'latitude', round(loc.latitude::numeric, 5), 'longitude', round(loc.longitude::numeric, 5),
      'accuracy_meters', loc.accuracy_meters, 'recorded_at', loc.recorded_at) else null end,
    'events', coalesce(events.items, '[]'::jsonb)
  ) into result
  from public.deliveries d join public.orders o on o.id = d.order_id
  left join public.drivers dr on dr.id = d.driver_id
  left join lateral (select dl.id, dl.latitude, dl.longitude, dl.accuracy_meters, dl.recorded_at
    from public.driver_locations dl where dl.delivery_id = d.id order by dl.recorded_at desc limit 1) loc on true
  left join lateral (select jsonb_agg(jsonb_build_object('type', e.event_type, 'created_at', e.created_at) order by e.created_at asc) items
    from public.delivery_events e where e.delivery_id = d.id) events on true
  where d.tracking_code = trim(p_tracking_code) limit 1;
  return result;
end; $$;

revoke all on function public.get_public_delivery_tracking(text) from public;
grant execute on function public.get_public_delivery_tracking(text) to anon, authenticated;
