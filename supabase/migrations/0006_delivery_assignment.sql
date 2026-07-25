-- MercadoFood v0.7: cadastro real de motoboys e atribuição de pedidos prontos
alter table public.orders add column if not exists delivery_address jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists assigned_driver_id uuid references public.drivers(id) on delete set null;

create index if not exists idx_orders_company_ready_delivery
  on public.orders(company_id, service_type, status, created_at);

create index if not exists idx_drivers_company_availability
  on public.drivers(company_id, availability_status, registration_status);

-- Garante que cada pedido tenha no máximo uma entrega.
create unique index if not exists idx_deliveries_order_unique on public.deliveries(order_id);

-- Políticas para localização e eventos, restritas à empresa do entregador/entrega.
do $$ begin
  create policy "company driver locations" on public.driver_locations
  for all using (
    exists (
      select 1 from public.drivers d
      where d.id = driver_id and public.is_company_member(d.company_id)
    )
  ) with check (
    exists (
      select 1 from public.drivers d
      where d.id = driver_id and public.is_company_member(d.company_id)
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company delivery events" on public.delivery_events
  for all using (
    exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and public.is_company_member(d.company_id)
    )
  ) with check (
    exists (
      select 1 from public.deliveries d
      where d.id = delivery_id and public.is_company_member(d.company_id)
    )
  );
exception when duplicate_object then null; end $$;

-- Tempo real para entregadores e entregas.
do $$ begin
  alter publication supabase_realtime add table public.drivers;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.deliveries;
exception when duplicate_object then null; end $$;
