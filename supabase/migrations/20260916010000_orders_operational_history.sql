-- MercadoFood: fila operacional, historico e metadados preservados.
-- Nenhum pedido e removido ou movido de tabela; as telas usam o estado do pedido.

alter table public.customers
  add column if not exists cpf text,
  add column if not exists address jsonb not null default '{}'::jsonb;

alter table public.orders
  add column if not exists cancellation_reason text,
  add column if not exists canceled_by uuid references auth.users(id) on delete set null,
  add column if not exists canceled_by_name text;

create index if not exists idx_orders_company_operational
  on public.orders(company_id, status, payment_status, created_at desc);

create index if not exists idx_orders_company_history
  on public.orders(company_id, created_at desc)
  where status in ('delivered', 'canceled');

create index if not exists idx_customers_company_cpf
  on public.customers(company_id, cpf)
  where cpf is not null;


