-- MercadoFood v1.0: fila e histórico de notificações por WhatsApp

create table if not exists public.whatsapp_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('driver', 'customer')),
  recipient_name text,
  recipient_phone text not null,
  template_key text not null,
  message_body text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_notifications_company_created_idx
  on public.whatsapp_notifications(company_id, created_at desc);

create index if not exists whatsapp_notifications_delivery_idx
  on public.whatsapp_notifications(delivery_id, created_at desc);

alter table public.whatsapp_notifications enable row level security;

drop policy if exists "company members read whatsapp notifications" on public.whatsapp_notifications;
create policy "company members read whatsapp notifications"
on public.whatsapp_notifications for select
to authenticated
using (public.is_company_member(company_id));

drop policy if exists "company members create whatsapp notifications" on public.whatsapp_notifications;
create policy "company members create whatsapp notifications"
on public.whatsapp_notifications for insert
to authenticated
with check (public.is_company_member(company_id));

drop policy if exists "company members update whatsapp notifications" on public.whatsapp_notifications;
create policy "company members update whatsapp notifications"
on public.whatsapp_notifications for update
to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));
