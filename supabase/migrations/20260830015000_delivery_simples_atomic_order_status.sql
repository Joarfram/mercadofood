-- Gestão Delivery Simples: transição de status e estoque na mesma transação.
-- Evita liberar/confirmar estoque e falhar antes de persistir o novo status do pedido.

create or replace function public.delivery_simple_transition_order_status(
  p_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_next text;
  v_now timestamptz := now();
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Pedido não encontrado.'; end if;
  if not public.is_company_member(v_order.company_id) then raise exception 'Sem permissão.'; end if;

  if p_status not in ('new','accepted','preparing','ready','out_for_delivery','delivered','canceled') then
    raise exception 'Status de pedido inválido.';
  end if;

  if v_order.status = p_status then return; end if;
  if v_order.status = 'canceled' then raise exception 'Pedido cancelado não pode ser reaberto.'; end if;
  if v_order.status = 'delivered' then raise exception 'Pedido concluído não pode mudar de status.'; end if;

  v_next := case v_order.status
    when 'new' then 'accepted'
    when 'accepted' then 'preparing'
    when 'preparing' then 'ready'
    when 'ready' then 'out_for_delivery'
    when 'out_for_delivery' then 'delivered'
    else null
  end;

  if p_status <> 'canceled' and p_status <> v_next then
    raise exception 'Transição de status inválida: % → %.', v_order.status, p_status;
  end if;

  -- Dinheiro: ao aceitar o pedido, a reserva vira baixa definitiva de estoque.
  if p_status = 'accepted'
     and v_order.payment_status <> 'paid'
     and v_order.payment_method = 'cash' then
    perform public.delivery_simple_accept_cash_order(p_order_id);
  end if;

  -- Cancelamento libera somente reservas ainda não confirmadas.
  if p_status = 'canceled' then
    perform public.delivery_simple_release_order_stock(p_order_id, 'Pedido cancelado');
  end if;

  update public.orders
  set status = p_status,
      accepted_at = case when p_status='accepted' then coalesce(accepted_at,v_now) else accepted_at end,
      started_at = case when p_status='preparing' then coalesce(started_at,v_now) else started_at end,
      ready_at = case when p_status='ready' then coalesce(ready_at,v_now) else ready_at end,
      delivered_at = case when p_status='delivered' then coalesce(delivered_at,v_now) else delivered_at end,
      canceled_at = case when p_status='canceled' then coalesce(canceled_at,v_now) else canceled_at end,
      updated_at = v_now
  where id = p_order_id;
end;
$$;

revoke all on function public.delivery_simple_transition_order_status(uuid,text) from public, anon;
grant execute on function public.delivery_simple_transition_order_status(uuid,text) to authenticated;

comment on function public.delivery_simple_transition_order_status(uuid,text) is
  'Avança ou cancela um pedido em uma única transação, mantendo a reserva/baixa de estoque consistente com o status.';
