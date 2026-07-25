-- MercadoFood v1.5: estoque, ficha técnica e baixa automática por venda
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  unit text not null check (unit in ('un','g','kg','ml','l')),
  current_stock numeric(14,3) not null default 0,
  minimum_stock numeric(14,3) not null default 0,
  unit_cost numeric(12,4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(14,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(product_id, ingredient_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  movement_type text not null check (movement_type in ('entry','sale','adjustment','loss','return')),
  quantity numeric(14,3) not null,
  stock_before numeric(14,3) not null,
  stock_after numeric(14,3) not null,
  unit_cost numeric(12,4),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists stock_applied_at timestamptz;
alter table public.orders add column if not exists stock_reversed_at timestamptz;

create index if not exists idx_ingredients_company_name on public.ingredients(company_id, name);
create index if not exists idx_recipe_items_product on public.recipe_items(product_id);
create index if not exists idx_inventory_movements_company_date on public.inventory_movements(company_id, created_at desc);
create index if not exists idx_inventory_movements_ingredient on public.inventory_movements(ingredient_id, created_at desc);

alter table public.ingredients enable row level security;
alter table public.recipe_items enable row level security;
alter table public.inventory_movements enable row level security;

do $$ begin
  create policy "company ingredients" on public.ingredients for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company recipe items" on public.recipe_items for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company inventory movements" on public.inventory_movements for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

create or replace function public.apply_order_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec record;
  before_qty numeric(14,3);
  used_qty numeric(14,3);
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' and new.stock_applied_at is null then
    for rec in
      select ri.ingredient_id, sum(ri.quantity * oi.quantity) as total_quantity
      from public.order_items oi
      join public.recipe_items ri on ri.product_id = oi.product_id
      where oi.order_id = new.id
      group by ri.ingredient_id
    loop
      select current_stock into before_qty from public.ingredients where id = rec.ingredient_id for update;
      used_qty := coalesce(rec.total_quantity, 0);
      update public.ingredients set current_stock = current_stock - used_qty, updated_at = now() where id = rec.ingredient_id;
      insert into public.inventory_movements(company_id, ingredient_id, order_id, movement_type, quantity, stock_before, stock_after, notes)
      values(new.company_id, rec.ingredient_id, new.id, 'sale', -used_qty, before_qty, before_qty-used_qty, 'Baixa automática do pedido #'||new.order_number);
    end loop;
    new.stock_applied_at := now();
  end if;

  if new.status = 'canceled' and old.status is distinct from 'canceled' and new.stock_applied_at is not null and new.stock_reversed_at is null then
    for rec in
      select ingredient_id, sum(abs(quantity)) as total_quantity
      from public.inventory_movements
      where order_id = new.id and movement_type = 'sale'
      group by ingredient_id
    loop
      select current_stock into before_qty from public.ingredients where id = rec.ingredient_id for update;
      update public.ingredients set current_stock = current_stock + rec.total_quantity, updated_at = now() where id = rec.ingredient_id;
      insert into public.inventory_movements(company_id, ingredient_id, order_id, movement_type, quantity, stock_before, stock_after, notes)
      values(new.company_id, rec.ingredient_id, new.id, 'return', rec.total_quantity, before_qty, before_qty+rec.total_quantity, 'Estorno do pedido cancelado #'||new.order_number);
    end loop;
    new.stock_reversed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_order_stock on public.orders;
create trigger trg_apply_order_stock
before update of status on public.orders
for each row execute function public.apply_order_stock();
