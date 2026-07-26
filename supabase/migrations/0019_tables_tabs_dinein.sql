-- MercadoFood v2.0: mesas, comandas e pedidos pelo QR Code
create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  code text not null,
  seats integer not null default 4 check (seats > 0),
  public_token text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  status text not null default 'available' check (status in ('available','occupied','reserved','disabled')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.table_tabs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  table_id uuid not null references public.restaurant_tables(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  guest_count integer not null default 1 check (guest_count > 0),
  status text not null default 'open' check (status in ('open','requested_closing','closed','canceled')),
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  service_charge numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  opened_at timestamptz not null default now(),
  requested_closing_at timestamptz,
  closed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies
  add column if not exists dine_in_service_charge_percent numeric(5,2) not null default 0,
  add column if not exists allow_table_qr_orders boolean not null default true;

alter table public.orders add column if not exists table_id uuid references public.restaurant_tables(id) on delete set null;
alter table public.orders add column if not exists table_tab_id uuid references public.table_tabs(id) on delete set null;
alter table public.orders add column if not exists ordering_source text not null default 'staff' check (ordering_source in ('staff','public_menu','table_qr'));

create unique index if not exists uq_open_tab_per_table on public.table_tabs(table_id) where status in ('open','requested_closing');
create index if not exists idx_restaurant_tables_company on public.restaurant_tables(company_id, status, is_active);
create index if not exists idx_table_tabs_company_status on public.table_tabs(company_id, status, opened_at desc);
create index if not exists idx_orders_table_tab on public.orders(table_tab_id, created_at);

alter table public.restaurant_tables enable row level security;
alter table public.table_tabs enable row level security;

do $$ begin
  create policy "company restaurant tables" on public.restaurant_tables for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company table tabs" on public.table_tabs for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

create or replace function public.recalculate_table_tab(p_tab_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_subtotal numeric(12,2);
  v_discount numeric(12,2);
  v_service numeric(12,2);
begin
  select coalesce(sum(subtotal),0), coalesce(sum(discount_amount),0)
  into v_subtotal, v_discount
  from public.orders
  where table_tab_id = p_tab_id and status <> 'canceled';

  select round(greatest(0, v_subtotal - v_discount) * coalesce(c.dine_in_service_charge_percent,0) / 100, 2)
  into v_service
  from public.table_tabs tt
  join public.companies c on c.id = tt.company_id
  where tt.id = p_tab_id;

  update public.table_tabs
  set subtotal = v_subtotal,
      discount_amount = v_discount,
      service_charge = coalesce(v_service,0),
      total = greatest(0, v_subtotal - v_discount) + coalesce(v_service,0),
      updated_at = now()
  where id = p_tab_id;
end;
$$;

create or replace function public.get_public_table_context(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'table', jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code, 'status', t.status, 'seats', t.seats),
    'company', jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug),
    'tab', case when tt.id is null then null else jsonb_build_object('id', tt.id, 'customer_name', tt.customer_name, 'status', tt.status, 'subtotal', tt.subtotal, 'service_charge', tt.service_charge, 'total', tt.total) end,
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description, 'price', p.base_price, 'category_id', p.category_id) order by p.name) from public.products p where p.company_id=t.company_id and p.is_active=true and p.availability_status='available'), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', ca.id, 'name', ca.name) order by ca.sort_order, ca.name) from public.categories ca where ca.company_id=t.company_id and ca.is_active=true), '[]'::jsonb)
  ) into v_result
  from public.restaurant_tables t
  join public.companies c on c.id=t.company_id
  left join lateral (select * from public.table_tabs x where x.table_id=t.id and x.status in ('open','requested_closing') order by x.opened_at desc limit 1) tt on true
  where t.public_token=upper(p_token) and t.is_active=true and c.allow_table_qr_orders=true;
  return v_result;
end;
$$;

grant execute on function public.get_public_table_context(text) to anon, authenticated;

create or replace function public.create_table_qr_order(
  p_token text,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_table public.restaurant_tables;
  v_tab public.table_tabs;
  v_branch uuid;
  v_order public.orders;
  v_item jsonb;
  v_product public.products;
  v_qty integer;
  v_subtotal numeric(12,2) := 0;
begin
  select * into v_table from public.restaurant_tables where public_token=upper(p_token) and is_active=true;
  if v_table.id is null then raise exception 'Mesa não encontrada'; end if;
  select id into v_branch from public.branches where company_id=v_table.company_id order by created_at limit 1;
  select * into v_tab from public.table_tabs where table_id=v_table.id and status in ('open','requested_closing') limit 1;
  if v_tab.id is null then
    insert into public.table_tabs(company_id,branch_id,table_id,customer_name,customer_phone,created_by)
    values(v_table.company_id,v_branch,v_table.id,nullif(trim(p_customer_name),''),nullif(regexp_replace(coalesce(p_customer_phone,''),'\D','','g'),''),null)
    returning * into v_tab;
    update public.restaurant_tables set status='occupied', updated_at=now() where id=v_table.id;
  end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'Adicione ao menos um item'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer,1));
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and company_id=v_table.company_id and is_active=true and availability_status='available';
    if v_product.id is null then raise exception 'Produto indisponível'; end if;
    v_subtotal := v_subtotal + (v_product.base_price * v_qty);
  end loop;
  insert into public.orders(company_id,branch_id,customer_name,customer_phone,service_type,status,payment_status,subtotal,total,notes,table_id,table_tab_id,ordering_source)
  values(v_table.company_id,v_branch,nullif(trim(p_customer_name),''),nullif(regexp_replace(coalesce(p_customer_phone,''),'\D','','g'),''),'dine_in','new','pending',v_subtotal,v_subtotal,nullif(trim(p_notes),''),v_table.id,v_tab.id,'table_qr')
  returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, coalesce((v_item->>'quantity')::integer,1));
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid;
    insert into public.order_items(company_id,order_id,product_id,product_name,unit_price,quantity,total_price,notes)
    values(v_table.company_id,v_order.id,v_product.id,v_product.name,v_product.base_price,v_qty,v_product.base_price*v_qty,nullif(v_item->>'notes',''));
  end loop;
  perform public.recalculate_table_tab(v_tab.id);
  return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'tab_id',v_tab.id,'table_name',v_table.name);
end;
$$;

grant execute on function public.create_table_qr_order(text,text,text,jsonb,text) to anon, authenticated;
