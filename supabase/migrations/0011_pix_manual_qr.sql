-- MercadoFood v1.2: configuração PIX e cobrança manual por QR Code
create table if not exists public.company_pix_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  pix_key text not null,
  merchant_name text not null,
  merchant_city text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_payments add column if not exists pix_payload text;
alter table public.order_payments add column if not exists pix_txid text;
alter table public.order_payments add column if not exists pix_generated_at timestamptz;
alter table public.order_payments add column if not exists pix_expires_at timestamptz;

create index if not exists idx_order_payments_pix_txid on public.order_payments(pix_txid);

alter table public.company_pix_settings enable row level security;
do $$ begin
  create policy "company pix settings" on public.company_pix_settings
  for all using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
