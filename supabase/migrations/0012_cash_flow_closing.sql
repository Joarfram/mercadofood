-- MercadoFood v1.3: caixa, movimentações e fechamento diário
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opened_by uuid references auth.users(id),
  closed_by uuid references auth.users(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_balance numeric(12,2) not null default 0,
  expected_balance numeric(12,2),
  counted_balance numeric(12,2),
  difference numeric(12,2),
  status text not null default 'open' check (status in ('open','closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_cash_sessions_one_open
  on public.cash_sessions(company_id)
  where status = 'open';

create index if not exists idx_cash_sessions_company_date
  on public.cash_sessions(company_id, opened_at desc);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  cash_session_id uuid not null references public.cash_sessions(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  movement_type text not null check (movement_type in ('sale','income','expense','withdrawal','deposit','refund')),
  payment_method text check (payment_method in ('pix','cash','card_on_delivery','online_card','other')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_cash_movements_session
  on public.cash_movements(cash_session_id, occurred_at desc);
create index if not exists idx_cash_movements_company
  on public.cash_movements(company_id, occurred_at desc);

alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;

do $$ begin
  create policy "company cash sessions" on public.cash_sessions
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company cash movements" on public.cash_movements
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
