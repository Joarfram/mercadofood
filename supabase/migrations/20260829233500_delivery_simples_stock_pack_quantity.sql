-- Corrige a baixa de estoque para produtos por peso fechado.
-- sale_quantity representa a medida de uma seleção/embalagem; order_items.quantity representa quantas seleções foram compradas.

create or replace function public.delivery_simple_apply_order_item_stock(p_order_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.order_items%rowtype;
  v_product public.products%rowtype;
  v_sale_quantity numeric;
  v_sale_unit text;
  v_stock_quantity numeric;
  v_before numeric;
  v_after numeric;
begin
  select * into v_item
  from public.order_items
  where id = p_order_item_id
  for update;

  if not found then
    raise exception 'Item do pedido não encontrado.';
  end if;

  select * into v_product
  from public.products
  where id = v_item.product_id
    and company_id = v_item.company_id
  for update;

  if not found then
    raise exception 'Produto do item não encontrado.';
  end if;

  if coalesce(v_product.track_stock, false) = false then
    return;
  end if;

  if exists (
    select 1 from public.product_stock_movements
    where order_item_id = v_item.id and movement_type = 'sale_delivery'
  ) then
    return;
  end if;

  if v_item.selling_mode = 'unit' then
    v_sale_quantity := coalesce(v_item.sale_quantity, v_item.quantity, 1);
    v_sale_unit := 'unit';
  else
    if v_item.sale_quantity is null or v_item.sale_quantity <= 0 or v_item.sale_unit is null then
      raise exception 'Item por peso sem medida de venda válida.';
    end if;
    v_sale_quantity := v_item.sale_quantity * greatest(1, coalesce(v_item.quantity, 1));
    v_sale_unit := v_item.sale_unit;
  end if;

  v_stock_quantity := public.delivery_simple_convert_quantity(
    v_sale_quantity,
    v_sale_unit,
    coalesce(v_product.stock_unit, case when v_item.selling_mode = 'unit' then 'unit' else 'g' end)
  );

  v_before := coalesce(v_product.stock_quantity, 0);
  v_after := v_before - v_stock_quantity;

  if v_after < 0 then
    raise exception 'Estoque insuficiente para %.', v_product.name;
  end if;

  update public.products
  set stock_quantity = v_after,
      availability_status = case
        when v_after <= 0 then 'unavailable'
        else availability_status
      end,
      updated_at = now()
  where id = v_product.id and company_id = v_product.company_id;

  insert into public.product_stock_movements(
    company_id, product_id, order_id, order_item_id,
    movement_type, quantity, unit, stock_before, stock_after, notes
  ) values (
    v_item.company_id, v_product.id, v_item.order_id, v_item.id,
    'sale_delivery', -v_stock_quantity, coalesce(v_product.stock_unit, v_sale_unit),
    v_before, v_after, 'Baixa automática do pedido delivery'
  );
end;
$$;

revoke all on function public.delivery_simple_apply_order_item_stock(uuid) from public;
comment on function public.delivery_simple_apply_order_item_stock(uuid) is
  'Baixa idempotente de estoque; considera quantidade de unidades/embalagens compradas.';