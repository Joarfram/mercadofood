alter table public.orders
  add column if not exists delivery_assigned_at timestamptz,
  add column if not exists delivery_status text;

create index if not exists orders_driver_active_idx
  on public.orders(company_id, branch_id, assigned_driver_id, delivery_status)
  where assigned_driver_id is not null;
