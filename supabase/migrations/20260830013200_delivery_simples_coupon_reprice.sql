-- Gestão Delivery Simples: recalcula cupons somente depois que peso/embalagem e complementos
-- tiveram o preço final validado no servidor.

create or replace function public.delivery_simple_finalize_public_order(
  p_order_id uuid,
  p_public_code text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payload_item jsonb;
  v_product public.products%rowtype;
  v_order_item public.order_items%rowtype;
  v_coupon public.coupons%rowtype;
  v_sale_quantity numeric;
  v_sale_unit text;
  v_line_quantity numeric;
  v_base_price numeric;
  v_original_base_price numeric;
  v_option_delta numeric;
  v_final_unit_price numeric;
  v_subtotal numeric;
  v_discount numeric := 0;
  v_total numeric;
  v_fixed_option jsonb;
  v_coupon_removed_reason text := null;
  v_had_redemption boolean := false;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
    and public_code = p_public_code
    and channel = 'public_menu'
    and created_at >= now() - interval '10 minutes'
  for update;

  if not found then raise exception 'Pedido público inválido ou expirado para finalização.'; end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then raise exception 'Itens inválidos para finalização.'; end if;

  for v_payload_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into v_product
    from public.products
    where id = (v_payload_item->>'product_id')::uuid and company_id = v_order.company_id;
    if not found then raise exception 'Produto do pedido não encontrado.'; end if;

    select * into v_order_item
    from public.order_items oi
    where oi.order_id = v_order.id
      and oi.company_id = v_order.company_id
      and oi.product_id = v_product.id
      and oi.sale_quantity is null
    order by oi.created_at, oi.id
    limit 1
    for update;
    if not found then raise exception 'Não foi possível relacionar um item do carrinho ao pedido.'; end if;

    v_line_quantity := greatest(1, coalesce(v_order_item.quantity, 1));
    v_original_base_price := coalesce(v_product.promotional_price, v_product.base_price);
    v_option_delta := greatest(0, coalesce(v_order_item.unit_price, 0) - v_original_base_price);

    if coalesce(v_product.selling_mode, 'unit') = 'unit' then
      v_sale_quantity := v_line_quantity;
      v_sale_unit := 'unit';
      v_base_price := v_original_base_price;
    elsif v_product.selling_mode = 'weight' then
      v_sale_quantity := nullif((v_payload_item->>'sale_quantity')::numeric, 0);
      v_sale_unit := coalesce(nullif(v_payload_item->>'sale_unit', ''), v_product.reference_unit, 'g');
      if v_sale_quantity is null or v_sale_quantity <= 0 then raise exception 'Informe o peso de %.', v_product.name; end if;
      if v_line_quantity <> 1 then raise exception 'Produto por peso deve ser enviado em uma única seleção por item.'; end if;
      v_base_price := public.delivery_simple_weight_price(v_product.id, v_sale_quantity, v_sale_unit);
    elsif v_product.selling_mode = 'fixed_weight' then
      v_sale_quantity := nullif((v_payload_item->>'sale_quantity')::numeric, 0);
      v_sale_unit := coalesce(nullif(v_payload_item->>'sale_unit', ''), 'g');
      if v_sale_quantity is null or v_sale_quantity <= 0 or v_sale_unit not in ('g','kg') then
        raise exception 'Selecione uma embalagem válida para %.', v_product.name;
      end if;
      select option_value into v_fixed_option
      from jsonb_array_elements(coalesce(v_product.fixed_weight_options, '[]'::jsonb)) option_value
      where (option_value->>'quantity')::numeric = v_sale_quantity
        and coalesce(option_value->>'unit','g') = v_sale_unit
      limit 1;
      if v_fixed_option is null then raise exception 'A embalagem selecionada para % não está disponível.', v_product.name; end if;
      v_base_price := (v_fixed_option->>'price')::numeric;
    else
      raise exception 'Forma de venda inválida para %.', v_product.name;
    end if;

    v_final_unit_price := round(v_base_price + v_option_delta, 2);

    update public.order_items
    set selling_mode = coalesce(v_product.selling_mode, 'unit'),
        sale_quantity = v_sale_quantity,
        sale_unit = v_sale_unit,
        reference_quantity = v_product.reference_quantity,
        reference_unit = v_product.reference_unit,
        unit_price = v_final_unit_price,
        total_price = round(v_final_unit_price * v_line_quantity, 2)
    where id = v_order_item.id;

    perform public.delivery_simple_apply_order_item_stock(v_order_item.id);
  end loop;

  select coalesce(sum(total_price),0) into v_subtotal
  from public.order_items where order_id = v_order.id and company_id = v_order.company_id;

  if v_order.coupon_id is not null then
    select * into v_coupon
    from public.coupons
    where id = v_order.coupon_id and company_id = v_order.company_id
    for update;

    if not found or not coalesce(v_coupon.is_active,false) then
      v_coupon_removed_reason := 'Cupom indisponível no fechamento do pedido.';
    elsif v_coupon.starts_at is not null and v_coupon.starts_at > now() then
      v_coupon_removed_reason := 'Cupom ainda não iniciado.';
    elsif v_coupon.ends_at is not null and v_coupon.ends_at < now() then
      v_coupon_removed_reason := 'Cupom expirado.';
    elsif v_subtotal < coalesce(v_coupon.minimum_order_value,0) then
      v_coupon_removed_reason := 'Subtotal final abaixo do mínimo exigido pelo cupom.';
    else
      v_discount := case
        when v_coupon.discount_type = 'percentage' then round(v_subtotal * v_coupon.discount_value / 100, 2)
        else v_coupon.discount_value
      end;
      if v_coupon.maximum_discount is not null then v_discount := least(v_discount, v_coupon.maximum_discount); end if;
      v_discount := least(v_subtotal, greatest(0, round(v_discount,2)));
    end if;

    if v_coupon_removed_reason is not null then
      select exists(select 1 from public.coupon_redemptions where order_id = v_order.id and coupon_id = v_order.coupon_id) into v_had_redemption;
      delete from public.coupon_redemptions where order_id = v_order.id and coupon_id = v_order.coupon_id;
      if v_had_redemption then
        update public.coupons set usage_count = greatest(0, coalesce(usage_count,0) - 1), updated_at = now()
        where id = v_order.coupon_id and company_id = v_order.company_id;
      end if;
      update public.orders set coupon_id = null, coupon_code = null where id = v_order.id;
      v_discount := 0;
    else
      update public.coupon_redemptions set discount_amount = v_discount
      where order_id = v_order.id and coupon_id = v_order.coupon_id;
    end if;
  end if;

  v_total := greatest(0, round(v_subtotal - v_discount + coalesce(v_order.delivery_fee,0), 2));

  update public.orders
  set subtotal = round(v_subtotal,2), discount_amount = v_discount, total = v_total, updated_at = now()
  where id = v_order.id;

  update public.order_payments set amount = v_total, updated_at = now()
  where order_id = v_order.id and status = 'pending';

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'public_code', v_order.public_code,
    'subtotal', round(v_subtotal,2),
    'discount_amount', v_discount,
    'delivery_fee', coalesce(v_order.delivery_fee,0),
    'total', v_total,
    'coupon_removed_reason', v_coupon_removed_reason
  );
end;
$$;

revoke all on function public.delivery_simple_finalize_public_order(uuid,text,jsonb) from public;
grant execute on function public.delivery_simple_finalize_public_order(uuid,text,jsonb) to anon, authenticated;

comment on function public.delivery_simple_finalize_public_order(uuid,text,jsonb) is
  'Finaliza medidas/preços, reserva estoque e recalcula cupom/pagamento usando o subtotal real da Gestão Delivery Simples.';