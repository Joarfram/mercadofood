-- Corrige o ciclo de reservas expiradas no Gestão Delivery Simples.
-- Reservas vencidas deixam de bloquear nova reserva do mesmo item e não podem ser confirmadas.

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
  v_reserved numeric;
  v_available numeric;
  v_existing public.product_stock_reservations%rowtype;
begin
  select * into v_item from public.order_items where id = p_order_item_id for update;
  if not found then raise exception 'Item do pedido não encontrado.'; end if;

  select * into v_product
  from public.products
  where id = v_item.product_id and company_id = v_item.company_id
  for update;
  if not found then raise exception 'Produto do item não encontrado.'; end if;
  if coalesce(v_product.track_stock, false) = false then return; end if;

  select * into v_existing
  from public.product_stock_reservations
  where order_item_id = v_item.id
  for update;

  if found and v_existing.status = 'confirmed' then
    return;
  end if;

  if found and v_existing.status = 'reserved' and v_existing.expires_at > now() then
    return;
  end if;

  if found and v_existing.status = 'reserved' and v_existing.expires_at <= now() then
    update public.product_stock_reservations
    set status='released', released_at=now(), release_reason='Reserva expirada', updated_at=now()
    where id=v_existing.id;
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

  select coalesce(sum(quantity),0) into v_reserved
  from public.product_stock_reservations
  where product_id = v_product.id and status = 'reserved' and expires_at > now();

  v_available := coalesce(v_product.stock_quantity,0) - v_reserved;
  if v_available < v_stock_quantity then
    raise exception 'Estoque insuficiente para %.', v_product.name;
  end if;

  insert into public.product_stock_reservations(
    company_id, product_id, order_id, order_item_id, quantity, unit,
    status, expires_at, confirmed_at, released_at, release_reason, updated_at
  ) values (
    v_item.company_id, v_product.id, v_item.order_id, v_item.id,
    v_stock_quantity, coalesce(v_product.stock_unit, v_sale_unit),
    'reserved', now() + interval '30 minutes', null, null, null, now()
  )
  on conflict (order_item_id) do update
  set company_id=excluded.company_id,
      product_id=excluded.product_id,
      order_id=excluded.order_id,
      quantity=excluded.quantity,
      unit=excluded.unit,
      status='reserved',
      expires_at=excluded.expires_at,
      confirmed_at=null,
      released_at=null,
      release_reason=null,
      updated_at=now();
end;
$$;

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
  v_expired_count integer;
  v_reserved_count integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if auth.uid() is not null and not public.is_company_member(v_order.company_id) then
    raise exception 'Sem permissão para confirmar estoque.';
  end if;

  select count(*) into v_expired_count
  from public.product_stock_reservations
  where order_id=p_order_id and status='reserved' and expires_at <= now();

  if v_expired_count > 0 then
    update public.product_stock_reservations
    set status='released', released_at=now(), release_reason='Reserva expirada antes da confirmação', updated_at=now()
    where order_id=p_order_id and status='reserved' and expires_at <= now();
    raise exception 'A reserva de estoque deste pedido expirou. Revalide o pedido antes de confirmar.';
  end if;

  select count(*) into v_reserved_count
  from public.product_stock_reservations
  where order_id=p_order_id and status='reserved' and expires_at > now();

  if v_reserved_count = 0 then
    if exists (
      select 1 from public.product_stock_reservations
      where order_id=p_order_id and status='confirmed'
    ) then
      return;
    end if;
    raise exception 'Este pedido não possui reserva de estoque ativa.';
  end if;

  for r in
    select * from public.product_stock_reservations
    where order_id = p_order_id and status = 'reserved' and expires_at > now()
    order by created_at
    for update
  loop
    select * into v_product from public.products
    where id = r.product_id and company_id = r.company_id for update;
    if not found then raise exception 'Produto da reserva não encontrado.'; end if;

    v_before := coalesce(v_product.stock_quantity,0);
    v_after := v_before - r.quantity;
    if v_after < 0 then raise exception 'Estoque insuficiente para %.', v_product.name; end if;

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
        'Baixa confirmada após reserva do pedido delivery'
      );
    end if;

    update public.product_stock_reservations
    set status='confirmed', confirmed_at=now(), updated_at=now()
    where id=r.id;
  end loop;
end;
$$;

comment on function public.delivery_simple_apply_order_item_stock(uuid) is
  'Cria ou renova reserva idempotente e ignora reservas vencidas como disponibilidade.';
comment on function public.delivery_simple_confirm_order_stock(uuid) is
  'Confirma somente reservas ativas; reservas expiradas são liberadas e exigem revalidação.';
