-- MercadoFood v2.3: combos completos e escolhas por etapa.

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  base_price numeric(12,2) not null default 0 check (base_price >= 0),
  promotional_price numeric(12,2) check (promotional_price is null or promotional_price >= 0),
  preparation_time integer not null default 0 check (preparation_time >= 0),
  is_active boolean not null default true,
  availability_status text not null default 'available' check (availability_status in ('available','unavailable')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.combo_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  combo_id uuid not null references public.combos(id) on delete cascade,
  name text not null,
  description text,
  min_selection integer not null default 1 check (min_selection >= 0),
  max_selection integer not null default 1 check (max_selection >= min_selection),
  free_selection integer not null default 1 check (free_selection >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.combo_group_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  group_id uuid not null references public.combo_groups(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price_delta numeric(12,2) not null default 0,
  max_quantity integer not null default 1 check (max_quantity >= 1),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(group_id, product_id)
);

create table if not exists public.order_item_combo_choices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  combo_id uuid not null references public.combos(id) on delete restrict,
  group_id uuid not null references public.combo_groups(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  group_name text not null,
  product_name text not null,
  unit_price numeric(12,2) not null default 0,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  free_quantity numeric(12,3) not null default 0 check (free_quantity >= 0),
  charged_quantity numeric(12,3) not null default 0 check (charged_quantity >= 0),
  total_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists combos_company_idx on public.combos(company_id, is_active, sort_order);
create index if not exists combo_groups_combo_idx on public.combo_groups(combo_id, is_active, sort_order);
create index if not exists combo_group_products_group_idx on public.combo_group_products(group_id, is_active, sort_order);
create index if not exists order_item_combo_choices_item_idx on public.order_item_combo_choices(order_item_id);

alter table public.combos enable row level security;
alter table public.combo_groups enable row level security;
alter table public.combo_group_products enable row level security;
alter table public.order_item_combo_choices enable row level security;

do $$ begin
  create policy "company combos" on public.combos for all
    using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "company combo groups" on public.combo_groups for all
    using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "company combo products" on public.combo_group_products for all
    using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "company order combo choices" on public.order_item_combo_choices for all
    using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

-- O catálogo público passa a receber os combos e suas etapas de escolha.
create or replace function public.get_public_combos(p_company_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'description', c.description,
    'image_url', c.image_url,
    'price', coalesce(c.promotional_price, c.base_price),
    'original_price', case when c.promotional_price is not null then c.base_price else null end,
    'preparation_time', c.preparation_time,
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'description', g.description,
        'min_selection', g.min_selection,
        'max_selection', g.max_selection,
        'free_selection', g.free_selection,
        'products', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', gp.product_id,
            'name', p.name,
            'description', p.description,
            'image_url', p.image_url,
            'price_delta', gp.price_delta,
            'max_quantity', gp.max_quantity
          ) order by gp.sort_order, p.name)
          from public.combo_group_products gp
          join public.products p on p.id = gp.product_id
          where gp.group_id = g.id and gp.is_active = true
            and p.is_active = true and p.availability_status = 'available'
        ), '[]'::jsonb)
      ) order by g.sort_order, g.name)
      from public.combo_groups g
      where g.combo_id = c.id and g.is_active = true
    ), '[]'::jsonb)
  ) order by c.sort_order, c.name), '[]'::jsonb)
  from public.combos c
  where c.company_id = p_company_id and c.is_active = true and c.availability_status = 'available';
$$;

grant execute on function public.get_public_combos(uuid) to anon, authenticated;
