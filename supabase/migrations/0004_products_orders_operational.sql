-- MercadoFood v0.5: operações reais de produtos e pedidos
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists public_code text unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

create index if not exists idx_categories_company_active on public.categories(company_id, is_active, sort_order);
create index if not exists idx_products_company_active on public.products(company_id, is_active, availability_status);
create index if not exists idx_order_items_order on public.order_items(order_id);

alter table public.categories enable row level security;
alter table public.customers enable row level security;
alter table public.order_items enable row level security;
alter table public.branches enable row level security;

do $$ begin
  create policy "company categories" on public.categories for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "company customers" on public.customers for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "company order items" on public.order_items for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "company branches" on public.branches for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
