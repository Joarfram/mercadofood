-- Gestão Delivery Simples: cria, finaliza e reconcilia o pedido público em uma única transação.
-- Se qualquer etapa falhar, o PostgreSQL desfaz todo o comando RPC e não deixa pedido parcial.

create or replace function public.delivery_simple_create_public_order_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created jsonb;
  v_finalized jsonb;
  v_adjusted jsonb;
  v_reconciled jsonb;
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

  -- 1) Cria o pedido legado, preservando validação de cliente, opções e cupom.
  v_created := public.create_public_order(p_payload);
  v_order_id := nullif(v_created->>'order_id','')::uuid;
  v_public_code := nullif(v_created->>'public_code','');

  if v_order_id is null or v_public_code is null then
    raise exception 'O pedido não pôde ser criado corretamente.';
  end if;

  -- 2) Aplica preço/medida real dos produtos do Delivery Simples e reserva estoque.
  v_finalized := public.delivery_simple_finalize_public_order(
    v_order_id,
    v_public_code,
    v_items
  );

  -- 3) Aplica zona somente em delivery. Retirada nunca recebe taxa de entrega.
  if v_service_type = 'delivery' and v_zone_id is not null then
    v_adjusted := public.apply_public_order_delivery_zone(v_order_id, v_zone_id);
  elsif v_service_type = 'pickup' then
    update public.orders
    set delivery_fee = 0,
        delivery_address = '{}'::jsonb,
        total = greatest(0, round(subtotal - coalesce(discount_amount,0), 2)),
        updated_at = now()
    where id = v_order_id and public_code = v_public_code;
  end if;

  -- 4) Confere endereço, pedido mínimo, forma de pagamento, cupom e total definitivo.
  v_reconciled := public.delivery_simple_reconcile_public_order_totals(
    v_order_id,
    v_public_code
  );

  if v_reconciled is null then
    raise exception 'O pedido não pôde ser conferido antes da confirmação.';
  end if;

  return v_reconciled;
end;
$$;

revoke all on function public.delivery_simple_create_public_order_atomic(jsonb) from public;
grant execute on function public.delivery_simple_create_public_order_atomic(jsonb) to anon, authenticated;

comment on function public.delivery_simple_create_public_order_atomic(jsonb) is
  'Cria o pedido público do Gestão Delivery Simples em uma única chamada transacional; qualquer falha desfaz o pedido inteiro.';
