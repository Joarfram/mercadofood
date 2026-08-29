-- Gestão Delivery Simples: histórico de estoque do produto vendido.
-- Separado do estoque de insumos/ficha técnica para manter o plano simples.

create table if not exists public.product_stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  movement_type text not null,
  quantity numeric(12,3) not null,
  unit text not null,
  stock_before numeric(12,3) not null,
  stock_after numeric(12,3) not null,
  unit_cost numeric(12,4),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_stock_movements_company_created
  on public.product_stock_movements(company_id, created_at desc);
create index if not exists idx_product_stock_movements_product_created
  on public.product_stock_movements(product_id, created_at desc);
create index if not exists idx_product_stock_movements_order
  on public.product_stock_movements(order_id);

alter table public.product_stock_movements enable row level security;
revoke all on table public.product_stock_movements from anon;
grant select, insert on table public.product_stock_movements to authenticated;

do $$ begin
  create policy "company product stock movements select"
  on public.product_stock_movements for select
  using (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company product stock movements insert"
  on public.product_stock_movements for insert
  with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

alter table public.product_stock_movements
  drop constraint if exists product_stock_movements_type_check;
alter table public.product_stock_movements
  add constraint product_stock_movements_type_check
  check (movement_type in ('entry','sale_delivery','sale_store','adjustment_in','adjustment_out','loss','return','reservation','reservation_release'));

alter table public.product_stock_movements
  drop constraint if exists product_stock_movements_unit_check;
alter table public.product_stock_movements
  add constraint product_stock_movements_unit_check
  check (unit in ('unit','g','kg'));

-- Conversão padronizada para movimentar o saldo na unidade de estoque escolhida no produto.
create or replace function public.delivery_simple_convert_quantity(
  p_quantity numeric,
  p_from_unit text,
  p_to_unit text
) returns numeric
language plpgsql immutable set search_path = public
as $$
begin
  if p_quantity is null then return null; end if;
  if p_from_unit = p_to_unit then return p_quantity; end if;
  if p_from_unit = 'kg' and p_to_unit = 'g' then return p_quantity * 1000; end if;
  if p_from_unit = 'g' and p_to_unit = 'kg' then return p_quantity / 1000; end if;
  raise exception 'Conversão de unidade não suportada: % para %.', p_from_unit, p_to_unit;
end;
$$;

comment on table public.product_stock_movements is 'Razão simples do estoque dos produtos vendidos na Gestão Delivery Simples.';
comment on column public.product_stock_movements.quantity is 'Quantidade assinada: entrada positiva e saída negativa.';