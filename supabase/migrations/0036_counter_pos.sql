-- PDV de balcão: identifica a sessão de caixa e separa débito de crédito.
alter table public.orders
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null;

create index if not exists orders_cash_session_idx
  on public.orders(cash_session_id, paid_at desc);

alter table public.order_payments
  drop constraint if exists order_payments_method_check;

alter table public.order_payments
  add constraint order_payments_method_check
  check (method in ('pix','cash','debit_card','credit_card','card_on_delivery','online_card','other'));

alter table public.cash_movements
  drop constraint if exists cash_movements_payment_method_check;

alter table public.cash_movements
  add constraint cash_movements_payment_method_check
  check (payment_method in ('pix','cash','debit_card','credit_card','card_on_delivery','online_card','other'));

comment on column public.orders.cash_session_id is
  'Sessão de caixa responsável pela venda presencial.';
