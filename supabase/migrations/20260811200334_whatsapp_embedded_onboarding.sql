-- WhatsApp Cloud API: conexão por empresa, chatbot e caixa de conversas.
create table if not exists public.whatsapp_integrations (
  company_id uuid primary key references public.companies(id) on delete cascade,
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
  waba_id text unique,
  phone_number_id text unique,
  display_phone_number text,
  encrypted_access_token text,
  token_iv text,
  token_tag text,
  chatbot_enabled boolean not null default true,
  greeting_message text not null default 'Olá! 👋 Como podemos ajudar?\n\n1 — Ver cardápio\n2 — Acompanhar pedido\n3 — Horários e endereço\n4 — Falar com atendente',
  handoff_message text not null default 'Certo! Um atendente continuará a conversa por aqui.',
  owner_notification_enabled boolean not null default true,
  owner_notification_phone text,
  last_error text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(greeting_message) between 10 and 2000),
  check (char_length(handoff_message) between 5 and 1000)
);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  status text not null default 'bot' check (status in ('bot','attendant','closed')),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,customer_phone)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  meta_message_id text unique,
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null check (sender_type in ('customer','bot','attendant','system')),
  message_type text not null default 'text',
  body text not null check (char_length(body) between 1 and 4000),
  delivery_status text not null default 'received' check (delivery_status in ('received','queued','sent','delivered','read','failed')),
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_conversations_company_last_idx
  on public.whatsapp_conversations(company_id,last_message_at desc);
create index if not exists whatsapp_messages_conversation_created_idx
  on public.whatsapp_messages(conversation_id,created_at);

alter table public.whatsapp_integrations enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy "company manages whatsapp integration" on public.whatsapp_integrations
for all to authenticated
using (public.has_company_role(company_id,array['owner','manager']))
with check (public.has_company_role(company_id,array['owner','manager']));

create policy "company reads whatsapp conversations" on public.whatsapp_conversations
for select to authenticated
using (public.has_company_role(company_id,array['owner','manager','attendant']));
create policy "company updates whatsapp conversations" on public.whatsapp_conversations
for update to authenticated
using (public.has_company_role(company_id,array['owner','manager','attendant']))
with check (public.has_company_role(company_id,array['owner','manager','attendant']));

create policy "company reads whatsapp messages" on public.whatsapp_messages
for select to authenticated
using (public.has_company_role(company_id,array['owner','manager','attendant']));
create policy "company sends whatsapp messages" on public.whatsapp_messages
for insert to authenticated
with check (public.has_company_role(company_id,array['owner','manager','attendant']) and direction = 'outbound');

revoke all on public.whatsapp_integrations from authenticated;
grant select (company_id,status,waba_id,phone_number_id,display_phone_number,chatbot_enabled,greeting_message,handoff_message,owner_notification_enabled,owner_notification_phone,last_error,connected_at,created_at,updated_at)
  on public.whatsapp_integrations to authenticated;
grant insert (company_id,chatbot_enabled,greeting_message,handoff_message,owner_notification_enabled,owner_notification_phone)
  on public.whatsapp_integrations to authenticated;
grant update (chatbot_enabled,greeting_message,handoff_message,owner_notification_enabled,owner_notification_phone,updated_at)
  on public.whatsapp_integrations to authenticated;
grant select,update on public.whatsapp_conversations to authenticated;
grant select,insert on public.whatsapp_messages to authenticated;

insert into public.plan_entitlements(plan_id,module_key,enabled)
select id,'messages',true from public.subscription_plans
on conflict(plan_id,module_key) do update set enabled=true;
