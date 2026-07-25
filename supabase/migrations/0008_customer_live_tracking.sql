-- MercadoFood v0.9: rastreamento público e seguro da entrega para o cliente
-- O cliente consulta somente dados sanitizados por meio de um código difícil de adivinhar.

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
    'customer_name', case
      when coalesce(o.customer_name, '') = '' then 'Cliente'
      else split_part(o.customer_name, ' ', 1)
    end,
    'driver_name', case
      when coalesce(dr.name, '') = '' then null
      else split_part(dr.name, ' ', 1)
    end,
    'delivery_address', jsonb_build_object(
      'neighborhood', d.delivery_address ->> 'neighborhood',
      'city', d.delivery_address ->> 'city'
    ),
    'started_at', d.started_at,
    'completed_at', d.completed_at,
    'updated_at', d.updated_at,
    'last_location', case
      when d.status in ('delivering', 'completed') and loc.id is not null then
        jsonb_build_object(
          'latitude', round(loc.latitude::numeric, 5),
          'longitude', round(loc.longitude::numeric, 5),
          'accuracy_meters', loc.accuracy_meters,
          'recorded_at', loc.recorded_at
        )
      else null
    end,
    'events', coalesce(events.items, '[]'::jsonb)
  ) into result
  from public.deliveries d
  join public.orders o on o.id = d.order_id
  left join public.drivers dr on dr.id = d.driver_id
  left join lateral (
    select dl.id, dl.latitude, dl.longitude, dl.accuracy_meters, dl.recorded_at
    from public.driver_locations dl
    where dl.driver_id = d.driver_id
      and dl.recorded_at >= coalesce(d.started_at, d.accepted_at, d.created_at)
    order by dl.recorded_at desc
    limit 1
  ) loc on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('type', e.event_type, 'created_at', e.created_at)
      order by e.created_at asc
    ) as items
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

comment on function public.get_public_delivery_tracking(text) is
'Entrega apenas dados sanitizados para acompanhamento público por código de rastreamento.';
