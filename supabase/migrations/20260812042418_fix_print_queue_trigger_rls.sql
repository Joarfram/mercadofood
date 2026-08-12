-- O checkout público grava o pedido como anon. O trigger anterior herdava esse
-- papel e era corretamente bloqueado pela RLS de print_jobs. A função interna
-- fica fora do schema exposto, possui search_path vazio e não é executável por
-- clientes; ela somente reage a INSERT/UPDATE já autorizados em orders.
drop trigger if exists orders_enqueue_print on public.orders;
drop function if exists public.enqueue_order_print();
create schema if not exists private;

create or replace function private.enqueue_order_print() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'canceled' and (
    new.payment_method in ('cash','card_on_delivery','debit_card','credit_card')
    or new.payment_status = 'paid'
  ) then
    insert into public.print_jobs(company_id,printer_id,order_id)
    select new.company_id,p.id,new.id
    from public.thermal_printers p
    where p.company_id=new.company_id
      and p.status='active'
      and p.auto_print=true
    on conflict(printer_id,order_id) do nothing;
  end if;
  return new;
end $$;

revoke all on function private.enqueue_order_print() from public,anon,authenticated;
create trigger orders_enqueue_print
after insert or update of payment_status,payment_method,status on public.orders
for each row execute function private.enqueue_order_print();
