-- Gestão Delivery Simples: reconcilia subtotal, cupom, taxa e pagamento após o preço final por peso
-- e após a aplicação da zona de entrega. O servidor é a fonte de verdade do total final.

create or replace function public.delivery_simple_reconcile_public_order_totals(
  p_order_id uuid,
  p_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_coupon public.coupons%rowtype;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_old_discount numeric := 0;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
    and public_code = p_public_code
    and channel = 'public_menu'
    and created_at >= now() - interval '20 minutes'
  for update;

  if not found then
    raise exception 'Pedido público inválido ou expirado para conferência de valores.';
  end if;

  select coalesce(sum(oi.total_price), 0)
    into v_subtotal
  from public.order_items oi
  where oi.order_id = v_order.id
    and oi.company_id = v_order.company_id;

  v_old_discount := coalesce(v_order.discount_amount, 0);

  if v_order.coupon_id is not null then
    select * into v_coupon
    from public.coupons
    where id = v_order.coupon_id
      and company_id = v_order.company_id;

    if found
       and coalesce(v_coupon.is_active, false)
       and (v_coupon.starts_at is null or v_coupon.starts_at <= now())
       and (v_coupon.ends_at is null or v_coupon.ends_at >= now())
       and v_subtotal >= coalesce(v_coupon.minimum_order_value, 0) then
      v_discount := case
        when v_coupon.discount_type = 'percentage'
          then v_subtotal * v_coupon.discount_value / 100
        else v_coupon.discount_value
      end;
      if v_coupon.maximum_discount is not null then
        v_discount := least(v_discount, v_coupon.maximum_discount);
      end if;
      v_discount := least(v_subtotal, round(v_discount, 2));
    else
      v_discount := 0;
      delete from public.coupon_redemptions
      where order_id = v_order.id and coupon_id = v_order.coupon_id;

      if found and v_old_discount > 0 then
        update public.coupons
        set usage_count = greatest(0, coalesce(usage_count, 0) - 1), updated_at = now()
        where id = v_order.coupon_id and company_id = v_order.company_id;
      end if;
    end if;
  end if;

  v_total := greatest(0, round(v_subtotal - v_discount + coalesce(v_order.delivery_fee, 0), 2));

  update public.orders
  set subtotal = round(v_subtotal, 2),
      discount_amount = round(v_discount, 2),
      total = v_total,
      coupon_id = case when v_discount > 0 then coupon_id else null end,
      coupon_code = case when v_discount > 0 then coupon_code else null end,
      updated_at = now()
  where id = v_order.id;

  if v_order.coupon_id is not null and v_discount > 0 then
    update public.coupon_redemptions
    set discount_amount = round(v_discount, 2)
    where order_id = v_order.id and coupon_id = v_order.coupon_id;
  end if;

  update public.order_payments
  set amount = v_total, updated_at = now()
  where order_id = v_order.id and status = 'pending';

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'public_code', v_order.public_code,
    'subtotal', round(v_subtotal, 2),
    'discount_amount', round(v_discount, 2),
    'delivery_fee', coalesce(v_order.delivery_fee, 0),
    'total', v_total
  );
end;
$$;

revoke all on function public.delivery_simple_reconcile_public_order_totals(uuid,text) from public;
grant execute on function public.delivery_simple_reconcile_public_order_totals(uuid,text) to anon, authenticated;

comment on function public.delivery_simple_reconcile_public_order_totals(uuid,text) is
  'Reconfere no servidor subtotal final, cupom, taxa de entrega e pagamento pendente do pedido público.';