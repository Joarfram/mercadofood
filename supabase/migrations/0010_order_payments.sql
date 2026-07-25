-- MercadoFood v1.1: formas de pagamento e controle financeiro do pedido
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists amount_received numeric(12,2);
alter table public.orders add column if not exists change_amount numeric(12,2) not null default 0;
alter table public.orders add column if not exists paid_at timestamptz;

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null check (method in ('pix','cash','card_on_delivery','online_card','other')),
  status text not null default 'pending' check (status in ('pending','paid','canceled','refunded')),
  amount numeric(12,2) not null check (amount >= 0),
  amount_received numeric(12,2),
  change_amount numeric(12,2) not null default 0,
  external_reference text,
  notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_order_payments_order on public.order_payments(order_id);
create index if not exists idx_order_payments_company_status on public.order_payments(company_id, status, created_at desc);

alter table public.order_payments enable row level security;
do $$ begin
  create policy "company order payments" on public.order_payments
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
