-- Gestão Delivery Simples: limpeza e confirmação segura de reservas expiradas.

create or replace function public.delivery_simple_expire_stock_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.product_stock_reservations
  set status='released', released_at=now(), release_reason='Reserva expirada', updated_at=now()
  where status='reserved' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.delivery_simple_expire_stock_reservations() from public;

create or replace function public.delivery_simple_confirm_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  r record;
  v_product public.products%rowtype;
  v_before numeric;
  v_after numeric;
  v_other_reserved numeric;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if auth.uid() is not null and not public.is_company_member(v_order.company_id) then
    raise exception 'Sem permissão para confirmar estoque.';
  end if;

  -- Reservas vencidas de outros pedidos deixam de bloquear estoque.
  update public.product_stock_reservations
  set status='released', released_at=now(), release_reason='Reserva expirada', updated_at=now()
  where status='reserved' and expires_at <= now() and order_id <> p_order_id;

  for r in
    select * from public.product_stock_reservations
    where order_id = p_order_id and status = 'reserved'
    order by created_at
    for update
  loop
    select * into v_product from public.products
    where id = r.product_id and company_id = r.company_id for update;
    if not found then raise exception 'Produto da reserva não encontrado.'; end if;

    select coalesce(sum(quantity),0) into v_other_reserved
    from public.product_stock_reservations
    where product_id=r.product_id
      and status='reserved'
      and order_id<>p_order_id
      and expires_at>now();

    v_before := coalesce(v_product.stock_quantity,0);
    v_after := v_before - r.quantity;
    if v_after < v_other_reserved then
      raise exception 'Estoque insuficiente para confirmar %. A reserva expirou e o saldo foi comprometido por outro pedido.', v_product.name;
    end if;

    update public.products
    set stock_quantity = v_after,
        availability_status = case when v_after <= 0 then 'unavailable' else availability_status end,
        updated_at = now()
    where id = v_product.id and company_id = v_product.company_id;

    if not exists (
      select 1 from public.product_stock_movements
      where order_item_id = r.order_item_id and movement_type = 'sale_delivery'
    ) then
      insert into public.product_stock_movements(
        company_id, product_id, order_id, order_item_id,
        movement_type, quantity, unit, stock_before, stock_after, notes
      ) values (
        r.company_id, r.product_id, r.order_id, r.order_item_id,
        'sale_delivery', -r.quantity, r.unit, v_before, v_after,
        case when r.expires_at<=now()
          then 'Baixa confirmada após revalidação de reserva expirada'
          else 'Baixa confirmada após reserva do pedido delivery'
        end
      );
    end if;

    update public.product_stock_reservations
    set status='confirmed', confirmed_at=now(), updated_at=now()
    where id=r.id;
  end loop;
end;
$$;
