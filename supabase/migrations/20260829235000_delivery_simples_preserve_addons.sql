-- Gestão Delivery Simples: ao recalcular o preço por peso, preservar o valor dos complementos
-- já validado e calculado pelo create_public_order legado.

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
  v_sale_quantity numeric;
  v_sale_unit text;
  v_line_quantity numeric;
  v_base_price numeric;
  v_original_base_price numeric;
  v_option_delta numeric;
  v_final_unit_price numeric;
  v_subtotal numeric;
  v_total numeric;
  v_fixed_option jsonb;
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
    -- create_public_order já colocou base + complementos no unit_price.
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

  v_total := greatest(0, v_subtotal - coalesce(v_order.discount_amount,0) + coalesce(v_order.delivery_fee,0));
  update public.orders set subtotal = round(v_subtotal,2), total = round(v_total,2), updated_at = now() where id = v_order.id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'public_code', v_order.public_code,
    'subtotal', round(v_subtotal,2),
    'discount_amount', coalesce(v_order.discount_amount,0),
    'delivery_fee', coalesce(v_order.delivery_fee,0),
    'total', round(v_total,2)
  );
end;
$$;

revoke all on function public.delivery_simple_finalize_public_order(uuid,text,jsonb) from public;
grant execute on function public.delivery_simple_finalize_public_order(uuid,text,jsonb) to anon, authenticated;
