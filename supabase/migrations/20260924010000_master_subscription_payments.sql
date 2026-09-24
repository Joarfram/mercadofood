-- Pagamentos da assinatura MercadoFood. Não contém pagamentos de pedidos das lojas.
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  subscription_id uuid not null references public.company_subscriptions(id) on delete restrict,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null check (status in ('pending','paid','failed','refunded','canceled')),
  payment_method text,
  provider text not null default 'manual',
  provider_reference text,
  due_at timestamptz,
  paid_at timestamptz,
  period_starts_at timestamptz,
  period_ends_at timestamptz,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_reference)
);

create index if not exists subscription_payments_company_time_idx
  on public.subscription_payments(company_id, created_at desc);
create index if not exists subscription_payments_status_due_idx
  on public.subscription_payments(status, due_at);

alter table public.subscription_payments enable row level security;
revoke all on table public.subscription_payments from anon, authenticated;
grant select, insert, update, delete on table public.subscription_payments to service_role;

comment on table public.subscription_payments is
  'Cobranças e pagamentos da licença SaaS MercadoFood; separado de pagamentos de pedidos.';
