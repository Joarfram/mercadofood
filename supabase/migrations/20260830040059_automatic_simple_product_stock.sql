-- Baixa automática de produtos simples e reforço da integridade do estoque.
-- Pedidos históricos são marcados como já processados para evitar baixa retroativa.

alter table public.orders
  add column if not exists product_stock_applied_at timestamptz,
  add column if not exists product_stock_reversed_at timestamptz;

update public.orders
set product_stock_applied_at = coalesce(stock_applied_at, updated_at, created_at)
where status <> 'new'
  and product_stock_applied_at is null;

update public.orders
set product_stock_reversed_at = coalesce(stock_reversed_at, canceled_at, updated_at, created_at)
where status = 'canceled'
  and product_stock_reversed_at is null;

alter table public.inventory_movements
  add column if not exists product_id uuid references public.products(id) on delete set null;

alter table public.inventory_movements
  alter column ingredient_id drop not null;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_stock_source_check;

alter table public.inventory_movements
  add constraint inventory_movements_stock_source_check
  check (
    num_nonnulls(ingredient_id, product_id) <= 1
    and (ingredient_id is not null or product_id is not null or order_id is not null)
  );

alter table public.products
  drop constraint if exists products_stock_quantity_nonnegative;

alter table public.products
  add constraint products_stock_quantity_nonnegative
  check (stock_quantity >= 0);

alter table public.ingredients
  drop constraint if exists ingredients_current_stock_nonnegative;

alter table public.ingredients
  add constraint ingredients_current_stock_nonnegative
  check (current_stock >= 0);

alter table public.order_items
  drop constraint if exists order_items_quantity_positive;

alter table public.order_items
  add constraint order_items_quantity_positive
  check (quantity > 0);

alter table public.recipe_items
  drop constraint if exists recipe_items_quantity_positive;

alter table public.recipe_items
  add constraint recipe_items_quantity_positive
  check (quantity > 0);

create index if not exists idx_inventory_movements_product
  on public.inventory_movements(product_id, created_at desc)
  where product_id is not null;

create unique index if not exists idx_inventory_sale_once_per_ingredient
  on public.inventory_movements(order_id, ingredient_id)
  where movement_type = 'sale' and order_id is not null and ingredient_id is not null;

create unique index if not exists idx_inventory_return_once_per_ingredient
  on public.inventory_movements(order_id, ingredient_id)
  where movement_type = 'return' and order_id is not null and ingredient_id is not null;

create unique index if not exists idx_inventory_sale_once_per_product
  on public.inventory_movements(order_id, product_id)
  where movement_type = 'sale' and order_id is not null and product_id is not null;

create unique index if not exists idx_inventory_return_once_per_product
  on public.inventory_movements(order_id, product_id)
  where movement_type = 'return' and order_id is not null and product_id is not null;

create or replace function public.apply_order_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  before_qty numeric(14,3);
  used_qty numeric(14,3);
  stock_name text;
  stock_is_confirmed boolean;
begin
  stock_is_confirmed := new.payment_status = 'paid'
    and new.status in ('accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered');

  -- Ingredientes das fichas técnicas.
  if stock_is_confirmed and new.stock_applied_at is null then
    for rec in
      select ri.ingredient_id, sum(ri.quantity * oi.quantity) as total_quantity
      from public.order_items oi
      join public.recipe_items ri
        on ri.product_id = oi.product_id
       and ri.company_id = new.company_id
      where oi.order_id = new.id
        and oi.company_id = new.company_id
      group by ri.ingredient_id
    loop
      select current_stock, name
      into before_qty, stock_name
      from public.ingredients
      where id = rec.ingredient_id and company_id = new.company_id
      for update;

      used_qty := coalesce(rec.total_quantity, 0);
      if before_qty is null then
        raise exception 'Insumo da ficha técnica não encontrado para o pedido %.', new.order_number;
      end if;
      if before_qty < used_qty then
        raise exception 'Estoque insuficiente de %. Disponível: %, necessário: %.', stock_name, before_qty, used_qty;
      end if;

      update public.ingredients
      set current_stock = current_stock - used_qty, updated_at = now()
      where id = rec.ingredient_id and company_id = new.company_id;

      insert into public.inventory_movements(
        company_id, ingredient_id, order_id, movement_type, quantity,
        stock_before, stock_after, notes
      ) values (
        new.company_id, rec.ingredient_id, new.id, 'sale', -used_qty,
        before_qty, before_qty - used_qty,
        'Baixa automática do pedido #' || new.order_number
      );
    end loop;
    new.stock_applied_at := now();
  end if;

  -- Produtos simples controlados diretamente por unidade.
  if stock_is_confirmed and new.product_stock_applied_at is null then
    for rec in
      select p.id as product_id, sum(oi.quantity) as total_quantity
      from public.order_items oi
      join public.products p
        on p.id = oi.product_id
       and p.company_id = new.company_id
       and p.track_stock = true
      where oi.order_id = new.id
        and oi.company_id = new.company_id
      group by p.id
    loop
      select stock_quantity, name
      into before_qty, stock_name
      from public.products
      where id = rec.product_id and company_id = new.company_id
      for update;

      used_qty := coalesce(rec.total_quantity, 0);
      if before_qty < used_qty then
        raise exception 'Estoque insuficiente de %. Disponível: %, necessário: %.', stock_name, before_qty, used_qty;
      end if;

      update public.products
      set stock_quantity = stock_quantity - used_qty, updated_at = now()
      where id = rec.product_id and company_id = new.company_id;

      insert into public.inventory_movements(
        company_id, product_id, order_id, movement_type, quantity,
        stock_before, stock_after, notes
      ) values (
        new.company_id, rec.product_id, new.id, 'sale', -used_qty,
        before_qty, before_qty - used_qty,
        'Baixa automática do pedido #' || new.order_number
      );
    end loop;
    new.product_stock_applied_at := now();
  end if;

  if new.status = 'canceled' and old.status is distinct from 'canceled' then
    if new.stock_applied_at is not null and new.stock_reversed_at is null then
      for rec in
        select ingredient_id, sum(abs(quantity)) as total_quantity
        from public.inventory_movements
        where order_id = new.id
          and movement_type = 'sale'
          and ingredient_id is not null
        group by ingredient_id
      loop
        select current_stock into before_qty
        from public.ingredients
        where id = rec.ingredient_id and company_id = new.company_id
        for update;

        update public.ingredients
        set current_stock = current_stock + rec.total_quantity, updated_at = now()
        where id = rec.ingredient_id and company_id = new.company_id;

        insert into public.inventory_movements(
          company_id, ingredient_id, order_id, movement_type, quantity,
          stock_before, stock_after, notes
        ) values (
          new.company_id, rec.ingredient_id, new.id, 'return', rec.total_quantity,
          before_qty, before_qty + rec.total_quantity,
          'Estorno do pedido cancelado #' || new.order_number
        );
      end loop;
      new.stock_reversed_at := now();
    end if;

    if new.product_stock_applied_at is not null and new.product_stock_reversed_at is null then
      for rec in
        select product_id, sum(abs(quantity)) as total_quantity
        from public.inventory_movements
        where order_id = new.id
          and movement_type = 'sale'
          and product_id is not null
        group by product_id
      loop
        select stock_quantity into before_qty
        from public.products
        where id = rec.product_id and company_id = new.company_id
        for update;

        update public.products
        set stock_quantity = stock_quantity + rec.total_quantity, updated_at = now()
        where id = rec.product_id and company_id = new.company_id;

        insert into public.inventory_movements(
          company_id, product_id, order_id, movement_type, quantity,
          stock_before, stock_after, notes
        ) values (
          new.company_id, rec.product_id, new.id, 'return', rec.total_quantity,
          before_qty, before_qty + rec.total_quantity,
          'Estorno do pedido cancelado #' || new.order_number
        );
      end loop;
      new.product_stock_reversed_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_order_stock on public.orders;
create trigger trg_apply_order_stock
before update of status, payment_status on public.orders
for each row execute function public.apply_order_stock();

revoke all on function public.apply_order_stock() from public, anon, authenticated;
