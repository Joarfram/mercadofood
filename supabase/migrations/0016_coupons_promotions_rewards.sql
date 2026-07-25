-- MercadoFood v1.7: cupons, promoções e resgate de fidelidade no pedido
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  promotion_type text not null default 'offer' check (promotion_type in ('offer','product_discount','combo','free_delivery','banner')),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order_value numeric(12,2) not null default 0,
  maximum_discount numeric(12,2),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  usage_count integer not null default 0,
  per_customer_limit integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

alter table public.orders add column if not exists discount_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists loyalty_points_redeemed integer not null default 0;
alter table public.orders add column if not exists loyalty_discount_amount numeric(12,2) not null default 0;

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  discount_amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_coupons_company_active on public.coupons(company_id, is_active, code);
create index if not exists idx_promotions_company_active on public.promotions(company_id, is_active, starts_at, ends_at);
create index if not exists idx_coupon_redemptions_customer on public.coupon_redemptions(customer_id, coupon_id);

alter table public.promotions enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

do $$ begin
  create policy "company promotions" on public.promotions for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company coupons" on public.coupons for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company coupon redemptions" on public.coupon_redemptions for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
