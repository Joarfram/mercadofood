-- GPS vinculado à corrida: nunca aceitar localização apenas pelo status disponível.

alter table public.driver_locations
  add column if not exists delivery_id uuid references public.deliveries(id) on delete cascade;

create index if not exists idx_driver_locations_delivery_time
  on public.driver_locations(delivery_id, recorded_at desc);

create or replace function public.enforce_active_delivery_location()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.delivery_id is null or not exists (
    select 1
    from public.deliveries d
    where d.id = new.delivery_id
      and d.driver_id = new.driver_id
      and d.status in ('to_store', 'waiting_pickup', 'delivering')
      and d.started_at is not null
      and d.completed_at is null
      and d.started_at >= now() - interval '6 hours'
  ) then
    raise exception 'O GPS só pode ser usado durante uma corrida ativa.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_driver_location_active_delivery on public.driver_locations;
create trigger trg_driver_location_active_delivery
before insert on public.driver_locations
for each row execute function public.enforce_active_delivery_location();

drop policy if exists "driver inserts own location" on public.driver_locations;
drop policy if exists "driver inserts own active delivery location" on public.driver_locations;
create policy "driver inserts own active delivery location" on public.driver_locations
for insert with check (
  exists (
    select 1
    from public.drivers drv
    join public.deliveries del on del.driver_id = drv.id
    where drv.id = driver_id
      and drv.auth_user_id = auth.uid()
      and del.id = delivery_id
      and del.status in ('to_store', 'waiting_pickup', 'delivering')
      and del.started_at is not null
      and del.completed_at is null
      and del.started_at >= now() - interval '6 hours'
  )
);

-- A consulta pública recebe somente a posição desta entrega e nunca a exibe após finalizar.
create or replace function public.get_public_delivery_tracking(p_tracking_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'tracking_code', d.tracking_code,
    'status', d.status,
    'order_number', o.order_number,
    'customer_name', case when coalesce(o.customer_name, '') = '' then 'Cliente' else split_part(o.customer_name, ' ', 1) end,
    'driver_name', case when coalesce(dr.name, '') = '' then null else split_part(dr.name, ' ', 1) end,
    'delivery_address', jsonb_build_object(
      'neighborhood', d.delivery_address ->> 'neighborhood',
      'city', d.delivery_address ->> 'city'
    ),
    'started_at', d.started_at,
    'completed_at', d.completed_at,
    'updated_at', d.updated_at,
    'last_location', case
      when d.status = 'delivering' and loc.id is not null then jsonb_build_object(
        'latitude', round(loc.latitude::numeric, 5),
        'longitude', round(loc.longitude::numeric, 5),
        'accuracy_meters', loc.accuracy_meters,
        'recorded_at', loc.recorded_at
      ) else null
    end,
    'events', coalesce(events.items, '[]'::jsonb)
  ) into result
  from public.deliveries d
  join public.orders o on o.id = d.order_id
  left join public.drivers dr on dr.id = d.driver_id
  left join lateral (
    select dl.id, dl.latitude, dl.longitude, dl.accuracy_meters, dl.recorded_at
    from public.driver_locations dl
    where dl.delivery_id = d.id
    order by dl.recorded_at desc
    limit 1
  ) loc on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('type', e.event_type, 'created_at', e.created_at) order by e.created_at asc) as items
    from public.delivery_events e
    where e.delivery_id = d.id
  ) events on true
  where d.tracking_code = trim(p_tracking_code)
  limit 1;

  return result;
end;
$$;

revoke all on function public.get_public_delivery_tracking(text) from public;
grant execute on function public.get_public_delivery_tracking(text) to anon, authenticated;

comment on function public.enforce_active_delivery_location() is
'Bloqueia qualquer localização sem corrida ativa, vinculada ao entregador e iniciada há no máximo seis horas.';
