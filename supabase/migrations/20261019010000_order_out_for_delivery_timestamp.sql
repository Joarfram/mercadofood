-- Store the exact time when the order is marked as out for delivery.
alter table public.orders
  add column if not exists out_for_delivery_at timestamptz;
