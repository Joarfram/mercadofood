-- Gestão Delivery Simples: reserva de estoque antes da confirmação do pagamento/aceite.
-- Mantém stock_quantity como estoque físico e evita baixa definitiva em pedidos abandonados.

create table if not exists public.product_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  status text not null default 'reserved' check (status in ('reserved','confirmed','released')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_item_id)
);

create index if not exists product_stock_reservations_product_status_idx
  on public.product_stock_reservations(product_id, status);
create index if not exists product_stock_reservations_order_idx
  on public.product_stock_reservations(order_id);

alter table public.product_stock_reservations enable row level security;
drop policy if exists "company members read stock reservations" on public.product_stock_reservations;
create policy "company members read stock reservations"
on public.product_stock_reservations for select to authenticated
using (public.is_company_member(company_id));

-- Substitui a baixa imediata por reserva idempotente.
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
begin
  select * into v_item from public.order_items where id = p_order_item_id for update;
  if not found then raise exception 'Item do pedido não encontrado.'; end if;

  select * into v_product
  from public.products
  where id = v_item.product_id and company_id = v_item.company_id
  for update;
  if not found then raise exception 'Produto do item não encontrado.'; end if;
  if coalesce(v_product.track_stock, false) = false then return; end if;

  if exists (select 1 from public.product_stock_reservations where order_item_id = v_item.id) then
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

  select coalesce(sum(quantity),0) into v_reserved
  from public.product_stock_reservations
  where product_id = v_product.id and status = 'reserved' and expires_at > now();

  v_available := coalesce(v_product.stock_quantity,0) - v_reserved;
  if v_available < v_stock_quantity then
    raise exception 'Estoque insuficiente para %.', v_product.name;
  end if;

  insert into public.product_stock_reservations(
    company_id, product_id, order_id, order_item_id, quantity, unit
  ) values (
    v_item.company_id, v_product.id, v_item.order_id, v_item.id,
    v_stock_quantity, coalesce(v_product.stock_unit, v_sale_unit)
  );
end;
$$;

revoke all on function public.delivery_simple_apply_order_item_stock(uuid) from public;

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
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if auth.uid() is not null and not public.is_company_member(v_order.company_id) then
    raise exception 'Sem permissão para confirmar estoque.';
  end if;

  for r in
    select * from public.product_stock_reservations
    where order_id = p_order_id and status = 'reserved'
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

create or replace function public.delivery_simple_release_order_stock(p_order_id uuid, p_reason text default 'Pedido cancelado')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_company_id uuid;
begin
  select company_id into v_company_id from public.orders where id=p_order_id;
  if v_company_id is null then raise exception 'Pedido não encontrado.'; end if;
  if auth.uid() is not null and not public.is_company_member(v_company_id) then
    raise exception 'Sem permissão para liberar estoque.';
  end if;
  update public.product_stock_reservations
  set status='released', released_at=now(), release_reason=left(coalesce(p_reason,'Liberada'),250), updated_at=now()
  where order_id=p_order_id and status='reserved';
end;
$$;

create or replace function public.delivery_simple_confirm_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if not public.is_company_member(v_order.company_id) then raise exception 'Sem permissão.'; end if;
  perform public.delivery_simple_confirm_order_stock(p_order_id);
  update public.orders set payment_status='paid', updated_at=now() where id=p_order_id;
end;
$$;

create or replace function public.delivery_simple_accept_cash_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if not public.is_company_member(v_order.company_id) then raise exception 'Sem permissão.'; end if;
  perform public.delivery_simple_confirm_order_stock(p_order_id);
end;
$$;

grant execute on function public.delivery_simple_confirm_payment(uuid) to authenticated;
grant execute on function public.delivery_simple_accept_cash_order(uuid) to authenticated;
grant execute on function public.delivery_simple_release_order_stock(uuid,text) to authenticated;

comment on table public.product_stock_reservations is
  'Reservas temporárias de estoque do Gestão Delivery Simples; estoque físico só baixa após confirmação.';