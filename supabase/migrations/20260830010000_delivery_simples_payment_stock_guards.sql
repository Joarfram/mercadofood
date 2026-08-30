-- Gestão Delivery Simples: reforça transições de pagamento/estoque e permite revalidar reserva expirada.

create or replace function public.delivery_simple_revalidate_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  r record;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if not public.is_company_member(v_order.company_id) then raise exception 'Sem permissão.'; end if;
  if v_order.status = 'canceled' then raise exception 'Pedido cancelado não pode reservar estoque.'; end if;
  if v_order.payment_status = 'paid' then return; end if;

  for r in
    select id from public.order_items
    where order_id=p_order_id and company_id=v_order.company_id
    order by created_at, id
  loop
    perform public.delivery_simple_apply_order_item_stock(r.id);
  end loop;
end;
$$;

create or replace function public.delivery_simple_confirm_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if not public.is_company_member(v_order.company_id) then raise exception 'Sem permissão.'; end if;
  if v_order.status = 'canceled' then raise exception 'Não é possível confirmar pagamento de pedido cancelado.'; end if;
  if v_order.payment_status = 'paid' then return; end if;

  perform public.delivery_simple_confirm_order_stock(p_order_id);
  update public.orders set payment_status='paid', updated_at=now() where id=p_order_id;
end;
$$;

create or replace function public.delivery_simple_accept_cash_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if not public.is_company_member(v_order.company_id) then raise exception 'Sem permissão.'; end if;
  if v_order.status = 'canceled' then raise exception 'Pedido cancelado não pode consumir estoque.'; end if;
  if v_order.payment_method <> 'cash' then raise exception 'Este pedido não está configurado para pagamento em dinheiro.'; end if;

  perform public.delivery_simple_confirm_order_stock(p_order_id);
end;
$$;

grant execute on function public.delivery_simple_revalidate_order_stock(uuid) to authenticated;
grant execute on function public.delivery_simple_confirm_payment(uuid) to authenticated;
grant execute on function public.delivery_simple_accept_cash_order(uuid) to authenticated;

comment on function public.delivery_simple_revalidate_order_stock(uuid) is
  'Recria de forma atômica as reservas de estoque do pedido quando expiraram e ainda existe disponibilidade.';
