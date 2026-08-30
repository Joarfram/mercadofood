-- Confirma pagamento e baixa estoque na mesma transação.
create or replace function public.record_order_payment(
  p_order_id uuid,
  p_method text,
  p_status text,
  p_amount_received numeric default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_total numeric(12,2);
  v_received numeric(12,2);
  v_change numeric(12,2);
  v_paid_at timestamptz;
begin
  if p_method not in ('pix','cash','debit_card','credit_card','card_on_delivery','online_card','other') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_status not in ('pending','paid','canceled','refunded') then
    raise exception 'Status de pagamento inválido.';
  end if;

  select company_id, total
  into v_company_id, v_total
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  v_received := case
    when p_method = 'cash' and coalesce(p_amount_received, 0) > 0 then p_amount_received
    else v_total
  end;
  v_change := case when p_method = 'cash' then greatest(0, v_received - v_total) else 0 end;
  v_paid_at := case when p_status = 'paid' then now() else null end;

  -- O trigger de estoque roda aqui. Se faltar saldo, toda a função é revertida.
  update public.orders
  set payment_method = p_method,
      payment_status = p_status,
      amount_received = v_received,
      change_amount = v_change,
      paid_at = v_paid_at,
      updated_at = now()
  where id = p_order_id;

  insert into public.order_payments(
    company_id, order_id, method, status, amount, amount_received,
    change_amount, paid_at, updated_at
  ) values (
    v_company_id, p_order_id, p_method, p_status, v_total, v_received,
    v_change, v_paid_at, now()
  )
  on conflict (order_id) do update
  set method = excluded.method,
      status = excluded.status,
      amount = excluded.amount,
      amount_received = excluded.amount_received,
      change_amount = excluded.change_amount,
      paid_at = excluded.paid_at,
      updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.record_order_payment(uuid,text,text,numeric) from public, anon;
grant execute on function public.record_order_payment(uuid,text,text,numeric) to authenticated;
