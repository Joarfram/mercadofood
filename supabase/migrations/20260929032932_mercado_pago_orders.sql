-- Mercado Pago Orders API: credenciais por empresa e tentativas de pagamento.
-- Tokens são cifrados pela aplicação antes de chegar ao banco e nunca são lidos
-- pelo cliente. As tabelas não possuem políticas para usuários finais.

create table public.company_mercado_pago_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  mp_user_id text,
  account_name text,
  account_email text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  access_token_expires_at timestamptz,
  public_key text,
  scope text,
  live_mode boolean not null default false,
  status text not null default 'disconnected' check (status in ('connected','disconnected','reconnect_required')),
  pix_enabled boolean not null default true,
  card_enabled boolean not null default false,
  auto_release_orders boolean not null default true,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mercado_pago_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  internal_order_id uuid not null references public.orders(id) on delete cascade,
  mp_order_id text unique,
  mp_transaction_id text,
  external_reference text not null unique,
  payment_type text not null check (payment_type in ('pix','card')),
  order_status text not null default 'pending',
  order_status_detail text,
  transaction_status text,
  transaction_status_detail text,
  transaction_amount numeric(12,2) not null check (transaction_amount >= 0),
  installments integer,
  payment_method_id text,
  idempotency_key uuid not null unique,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  approved_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mercado_pago_webhook_events (
  id uuid primary key default gen_random_uuid(),
  mp_order_id text not null,
  event_id text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  unique(mp_order_id, event_id)
);

create table public.mercado_pago_oauth_states (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  state_hash text not null unique,
  code_verifier_encrypted text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index mercado_pago_attempts_order_idx on public.mercado_pago_payment_attempts(internal_order_id, created_at desc);
create index mercado_pago_attempts_company_status_idx on public.mercado_pago_payment_attempts(company_id, order_status, created_at desc);

alter table public.company_mercado_pago_integrations enable row level security;
alter table public.mercado_pago_payment_attempts enable row level security;
alter table public.mercado_pago_webhook_events enable row level security;
alter table public.mercado_pago_oauth_states enable row level security;

-- Apenas metadados de tentativas ficam visíveis a pessoas autorizadas da empresa.
create policy "authorized roles read Mercado Pago attempts" on public.mercado_pago_payment_attempts
for select to authenticated using (
  public.can_access_module(company_id,'payments')
  or public.can_access_module(company_id,'finance')
  or public.can_access_module(company_id,'orders')
);

-- order_payments continua sendo o resumo compatível para financeiro existente.
alter table public.order_payments drop constraint if exists order_payments_status_check;
alter table public.order_payments add constraint order_payments_status_check
check (status in ('pending','paid','canceled','refunded','approved','rejected','expired','in_process','charged_back'));

-- Somente o backend com service_role pode liberar a operação. A atualização é
-- idempotente: a primeira aprovação muda o pedido para accepted; as seguintes
-- não repetem estoque, impressão ou cozinha (os triggers existentes já protegem isso).
create or replace function public.finalize_mercado_pago_attempt(p_attempt_id uuid, p_approved_at timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare attempt public.mercado_pago_payment_attempts; integration public.company_mercado_pago_integrations;
begin
  select * into attempt from public.mercado_pago_payment_attempts where id=p_attempt_id for update;
  if attempt.id is null or attempt.released_at is not null then return false; end if;
  -- Defesa no banco: nenhuma rota consegue liberar uma tentativa ainda pendente.
  if attempt.order_status <> 'processed' or attempt.transaction_status not in ('approved','processed') then return false; end if;
  select * into integration from public.company_mercado_pago_integrations where company_id=attempt.company_id;
  if integration.auto_release_orders is not true then return false; end if;
  update public.mercado_pago_payment_attempts set approved_at=coalesce(approved_at,p_approved_at),released_at=now(),updated_at=now() where id=attempt.id;
  update public.orders set payment_status='paid',payment_method=case when attempt.payment_type='card' then 'online_card' else 'pix' end,paid_at=coalesce(paid_at,p_approved_at),status=case when status in ('new','awaiting_payment') then 'accepted' else status end,updated_at=now()
  where id=attempt.internal_order_id and company_id=attempt.company_id and status <> 'canceled';
  update public.order_payments set status='paid',paid_at=coalesce(paid_at,p_approved_at),updated_at=now()
  where order_id=attempt.internal_order_id and company_id=attempt.company_id;
  return true;
end;
$$;
revoke all on function public.finalize_mercado_pago_attempt(uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_mercado_pago_attempt(uuid,timestamptz) to service_role;

-- Pedidos online aguardam pagamento fora da fila operacional. A única transição
-- para "accepted" é a função idempotente acima, depois da consulta oficial à Order.
create or replace function private.enqueue_order_print() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'canceled'
     and new.status <> 'awaiting_payment'
     and (new.payment_method not in ('pix','online_card') or new.payment_status = 'paid') then
    insert into public.print_jobs(company_id,printer_id,order_id)
    select new.company_id,p.id,new.id
    from public.thermal_printers p
    where p.company_id=new.company_id and p.status='active' and p.auto_print=true
    on conflict(printer_id,order_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function private.enqueue_order_print() from public,anon,authenticated;
