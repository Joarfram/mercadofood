-- Gestão Delivery Simples: combos passam a respeitar a mesma reserva de estoque
-- dos pedidos normais e o RPC legado deixa de ser chamável diretamente pelo público.

alter table public.product_stock_reservations
  drop constraint if exists product_stock_reservations_order_item_id_key;

alter table public.product_stock_reservations
  add constraint product_stock_reservations_order_item_product_key
  unique (order_item_id, product_id);

create or replace function public.delivery_simple_reserve_combo_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_row record;
  v_product public.products%rowtype;
  v_required numeric;
  v_reserved numeric;
  v_available numeric;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Pedido não encontrado.'; end if;

  -- O construtor de combos atual trabalha apenas com quantidades inteiras.
  -- Produtos por peso/embalagem pronta precisam de uma UI própria dentro do combo.
  if exists (
    select 1
    from public.order_item_combo_choices c
    join public.order_items oi on oi.id = c.order_item_id
    join public.products p on p.id = c.product_id
    where oi.order_id = p_order_id
      and coalesce(p.selling_mode, 'unit') <> 'unit'
  ) then
    raise exception 'Produtos vendidos por peso ainda não podem ser usados dentro de combos.';
  end if;

  for v_row in
    select
      c.order_item_id,
      c.product_id,
      sum(c.quantity * greatest(1, oi.quantity))::numeric as required_quantity
    from public.order_item_combo_choices c
    join public.order_items oi on oi.id = c.order_item_id
    where oi.order_id = p_order_id
    group by c.order_item_id, c.product_id
  loop
    select * into v_product
    from public.products
    where id = v_row.product_id
      and company_id = v_order.company_id
    for update;

    if not found then raise exception 'Produto do combo não encontrado.'; end if;
    if coalesce(v_product.track_stock, false) = false then continue; end if;

    v_required := public.delivery_simple_convert_quantity(
      v_row.required_quantity,
      'unit',
      coalesce(v_product.stock_unit, 'unit')
    );

    select coalesce(sum(r.quantity), 0) into v_reserved
    from public.product_stock_reservations r
    where r.product_id = v_product.id
      and r.status = 'reserved'
      and r.expires_at > now()
      and r.order_id <> p_order_id;

    v_available := coalesce(v_product.stock_quantity, 0) - v_reserved;
    if v_available < v_required then
      raise exception 'Estoque insuficiente para % no combo. Disponível: %, necessário: %.',
        v_product.name, v_available, v_required;
    end if;

    insert into public.product_stock_reservations(
      company_id, product_id, order_id, order_item_id,
      quantity, unit, status, expires_at, confirmed_at, released_at, release_reason, updated_at
    ) values (
      v_order.company_id, v_product.id, p_order_id, v_row.order_item_id,
      v_required, coalesce(v_product.stock_unit, 'unit'), 'reserved', now() + interval '30 minutes',
      null, null, null, now()
    )
    on conflict (order_item_id, product_id) do update
      set quantity = excluded.quantity,
          unit = excluded.unit,
          status = 'reserved',
          expires_at = excluded.expires_at,
          confirmed_at = null,
          released_at = null,
          release_reason = null,
          updated_at = now()
      where public.product_stock_reservations.status <> 'confirmed';
  end loop;
end;
$$;

create or replace function public.delivery_simple_create_public_combo_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_payment_method text;
  v_service_type text;
begin
  v_payment_method := coalesce(nullif(p_payload->>'payment_method',''), 'pix');
  v_service_type := coalesce(nullif(p_payload->>'service_type',''), 'delivery');

  if v_payment_method not in ('pix','cash','card_on_delivery') then
    raise exception 'Forma de pagamento indisponível.';
  end if;
  if v_service_type not in ('delivery','pickup') then
    raise exception 'Escolha entrega ou retirada.';
  end if;

  -- create_public_combo_order já é transacional; qualquer erro abaixo desfaz tudo.
  v_result := public.create_public_combo_order(p_payload);
  v_order_id := nullif(v_result->>'order_id','')::uuid;
  if v_order_id is null then raise exception 'O combo foi criado sem um pedido válido.'; end if;

  perform public.delivery_simple_reserve_combo_order_stock(v_order_id);
  return v_result;
end;
$$;

revoke all on function public.create_public_combo_order(jsonb) from public, anon, authenticated;
revoke all on function public.delivery_simple_reserve_combo_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.delivery_simple_create_public_combo_order(jsonb) from public;
grant execute on function public.delivery_simple_create_public_combo_order(jsonb) to anon, authenticated;

comment on function public.delivery_simple_create_public_combo_order(jsonb) is
  'Cria combo público com validação de forma de pagamento e reserva atômica do estoque dos produtos unitários escolhidos.';
