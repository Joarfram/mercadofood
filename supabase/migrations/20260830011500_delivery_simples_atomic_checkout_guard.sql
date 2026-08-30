-- Completa o RPC atômico com a mesma guarda final usada pelo checkout público.

create or replace function public.delivery_simple_create_public_order_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created jsonb;
  v_result jsonb;
  v_order_id uuid;
  v_public_code text;
  v_service_type text;
  v_zone_id uuid;
  v_items jsonb;
begin
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Dados do pedido inválidos.';
  end if;

  v_service_type := coalesce(nullif(p_payload->>'service_type',''), 'delivery');
  v_items := coalesce(p_payload->'items', '[]'::jsonb);

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'O carrinho está vazio.';
  end if;

  if nullif(p_payload->>'delivery_zone_id','') is not null then
    begin
      v_zone_id := (p_payload->>'delivery_zone_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Região de entrega inválida.';
    end;
  end if;

  v_created := public.create_public_order(p_payload);
  v_order_id := nullif(v_created->>'order_id','')::uuid;
  v_public_code := nullif(v_created->>'public_code','');

  if v_order_id is null or v_public_code is null then
    raise exception 'O pedido não pôde ser criado corretamente.';
  end if;

  perform public.delivery_simple_finalize_public_order(v_order_id, v_public_code, v_items);

  if v_service_type = 'delivery' and v_zone_id is not null then
    perform public.apply_public_order_delivery_zone(v_order_id, v_zone_id);
  elsif v_service_type = 'pickup' then
    update public.orders
    set delivery_fee = 0,
        delivery_address = '{}'::jsonb,
        total = greatest(0, round(subtotal - coalesce(discount_amount,0), 2)),
        updated_at = now()
    where id = v_order_id and public_code = v_public_code;
  end if;

  perform public.delivery_simple_reconcile_public_order_totals(v_order_id, v_public_code);

  v_result := public.delivery_simple_validate_public_checkout(
    v_order_id,
    v_public_code,
    case when v_service_type = 'delivery' then v_zone_id else null end
  );

  if v_result is null then
    raise exception 'O pedido não pôde ser validado antes da confirmação.';
  end if;

  return v_result;
end;
$$;

revoke all on function public.delivery_simple_create_public_order_atomic(jsonb) from public;
grant execute on function public.delivery_simple_create_public_order_atomic(jsonb) to anon, authenticated;
