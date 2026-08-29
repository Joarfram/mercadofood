-- Gestão Delivery Simples: elimina a validação antecipada de pedido mínimo/cupom
-- do fluxo por peso. O pedido legado é criado em modo neutro (pickup, sem cupom)
-- e a regra comercial é aplicada somente depois do preço real de peso ser finalizado.

create or replace function public.delivery_simple_apply_final_coupon(
  p_order_id uuid,
  p_public_code text,
  p_coupon_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_coupon public.coupons%rowtype;
  v_code text;
  v_discount numeric := 0;
  v_redemptions integer := 0;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
    and public_code = p_public_code
    and channel = 'public_menu'
  for update;

  if not found then
    raise exception 'Pedido não encontrado para aplicar o cupom.';
  end if;

  v_code := upper(regexp_replace(coalesce(p_coupon_code,''), '\s+', '', 'g'));

  if v_code = '' then
    update public.orders
    set coupon_id = null,
        coupon_code = null,
        discount_amount = 0,
        total = greatest(0, round(subtotal + coalesce(delivery_fee,0), 2)),
        updated_at = now()
    where id = v_order.id;

    update public.order_payments
    set amount = greatest(0, round(v_order.subtotal + coalesce(v_order.delivery_fee,0), 2)),
        updated_at = now()
    where order_id = v_order.id and status = 'pending';

    return jsonb_build_object('applied', false, 'discount', 0);
  end if;

  select * into v_coupon
  from public.coupons
  where company_id = v_order.company_id
    and code = v_code
    and is_active = true
  for update;

  if not found then raise exception 'Cupom inválido ou inativo.'; end if;
  if v_coupon.starts_at is not null and v_coupon.starts_at > now() then raise exception 'Este cupom ainda não começou.'; end if;
  if v_coupon.ends_at is not null and v_coupon.ends_at < now() then raise exception 'Este cupom expirou.'; end if;
  if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then raise exception 'O limite deste cupom foi atingido.'; end if;
  if v_order.subtotal < coalesce(v_coupon.minimum_order_value,0) then raise exception 'O pedido não atingiu o valor mínimo do cupom.'; end if;

  select count(*) into v_redemptions
  from public.coupon_redemptions
  where coupon_id = v_coupon.id
    and customer_id = v_order.customer_id;

  if v_coupon.per_customer_limit is not null and v_redemptions >= v_coupon.per_customer_limit then
    raise exception 'Você já atingiu o limite deste cupom.';
  end if;

  v_discount := case
    when v_coupon.discount_type = 'percentage' then v_order.subtotal * v_coupon.discount_value / 100
    else v_coupon.discount_value
  end;

  if v_coupon.maximum_discount is not null then
    v_discount := least(v_discount, v_coupon.maximum_discount);
  end if;
  v_discount := least(v_order.subtotal, round(v_discount, 2));

  update public.orders
  set coupon_id = v_coupon.id,
      coupon_code = v_coupon.code,
      discount_amount = v_discount,
      total = greatest(0, round(subtotal - v_discount + coalesce(delivery_fee,0), 2)),
      updated_at = now()
  where id = v_order.id;

  insert into public.coupon_redemptions(company_id, coupon_id, customer_id, order_id, discount_amount)
  values(v_order.company_id, v_coupon.id, v_order.customer_id, v_order.id, v_discount);

  update public.coupons
  set usage_count = usage_count + 1,
      updated_at = now()
  where id = v_coupon.id;

  update public.order_payments p
  set amount = o.total,
      updated_at = now()
  from public.orders o
  where p.order_id = o.id
    and o.id = v_order.id
    and p.status = 'pending';

  return jsonb_build_object('applied', true, 'coupon_code', v_coupon.code, 'discount', v_discount);
end;
$$;

revoke all on function public.delivery_simple_apply_final_coupon(uuid,text,text) from public, anon, authenticated;

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
  v_coupon_code text;
  v_legacy_payload jsonb;
  v_default_delivery_fee numeric := 0;
begin
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Dados do pedido inválidos.';
  end if;

  v_service_type := coalesce(nullif(p_payload->>'service_type',''), 'delivery');
  if v_service_type not in ('delivery','pickup') then
    raise exception 'Tipo de atendimento inválido.';
  end if;

  v_items := coalesce(p_payload->'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'O carrinho está vazio.';
  end if;

  v_coupon_code := coalesce(p_payload->>'coupon_code','');

  if nullif(p_payload->>'delivery_zone_id','') is not null then
    begin
      v_zone_id := (p_payload->>'delivery_zone_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Região de entrega inválida.';
    end;
  end if;

  -- O criador legado continua responsável por cliente, complementos e estrutura do pedido,
  -- mas não pode validar pedido mínimo/cupom usando o preço-base de um produto por peso.
  -- Forçamos pickup e removemos o cupom apenas dentro desta chamada transacional.
  v_legacy_payload := p_payload || jsonb_build_object(
    'service_type', 'pickup',
    'coupon_code', ''
  );

  v_created := public.create_public_order(v_legacy_payload);
  v_order_id := nullif(v_created->>'order_id','')::uuid;
  v_public_code := nullif(v_created->>'public_code','');

  if v_order_id is null or v_public_code is null then
    raise exception 'O pedido não pôde ser criado corretamente.';
  end if;

  -- Restaura o tipo/endereço solicitado antes de finalizar as regras reais do checkout.
  update public.orders o
  set service_type = v_service_type,
      delivery_address = case
        when v_service_type = 'delivery' then coalesce(p_payload->'delivery_address','{}'::jsonb)
        else '{}'::jsonb
      end,
      updated_at = now()
  where o.id = v_order_id
    and o.public_code = v_public_code;

  -- Define preço real por unidade/peso/peso pronto e reserva estoque.
  perform public.delivery_simple_finalize_public_order(v_order_id, v_public_code, v_items);

  if v_service_type = 'delivery' and v_zone_id is not null then
    perform public.apply_public_order_delivery_zone(v_order_id, v_zone_id);
  elsif v_service_type = 'delivery' then
    select coalesce(c.default_delivery_fee,0)
      into v_default_delivery_fee
    from public.orders o
    join public.companies c on c.id = o.company_id
    where o.id = v_order_id;

    update public.orders
    set delivery_fee = v_default_delivery_fee,
        updated_at = now()
    where id = v_order_id;
  else
    update public.orders
    set delivery_fee = 0,
        delivery_address = '{}'::jsonb,
        updated_at = now()
    where id = v_order_id;
  end if;

  -- Cupom é validado somente agora, com subtotal real já calculado.
  perform public.delivery_simple_apply_final_coupon(
    v_order_id,
    v_public_code,
    v_coupon_code
  );

  -- Recalcula o total persistido e depois aplica as guardas finais de endereço,
  -- taxa/região, forma de pagamento e pedido mínimo sobre o subtotal definitivo.
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

comment on function public.delivery_simple_create_public_order_atomic(jsonb) is
  'Cria pedido público em uma transação e valida cupom/pedido mínimo somente depois do preço final por peso.';
