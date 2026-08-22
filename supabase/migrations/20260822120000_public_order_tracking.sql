-- Acompanhamento público desde a criação do pedido, antes de existir uma entrega.
create or replace function public.get_public_order_tracking(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'tracking_code', coalesce(d.tracking_code, o.public_code), 'status', coalesce(d.status, o.status),
    'order_status', o.status, 'service_type', o.service_type, 'order_number', o.order_number,
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
  from public.orders o left join public.deliveries d on d.order_id = o.id left join public.drivers dr on dr.id = d.driver_id
  left join lateral (select dl.id, dl.latitude, dl.longitude, dl.accuracy_meters, dl.recorded_at from public.driver_locations dl where dl.delivery_id = d.id order by dl.recorded_at desc limit 1) loc on true
  left join lateral (select jsonb_agg(jsonb_build_object('type', e.event_type, 'created_at', e.created_at) order by e.created_at asc) items from public.delivery_events e where e.delivery_id = d.id) events on true
  where upper(o.public_code) = upper(trim(p_code)) or upper(d.tracking_code) = upper(trim(p_code))
  order by d.created_at desc nulls last limit 1;
  return result;
end; $$;

revoke all on function public.get_public_order_tracking(text) from public;
grant execute on function public.get_public_order_tracking(text) to anon, authenticated;
comment on function public.get_public_order_tracking(text) is 'Retorna somente dados mínimos do pedido identificado por código público opaco.';
