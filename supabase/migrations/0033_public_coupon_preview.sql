-- Prévia segura de cupom no carrinho público.
create or replace function public.preview_public_coupon(
  p_slug text,
  p_code text,
  p_subtotal numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_coupon public.coupons%rowtype;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  v_subtotal numeric := greatest(0, round(coalesce(p_subtotal, 0), 2));
  v_discount numeric := 0;
begin
  if v_code = '' then
    raise exception 'Informe o código do cupom.';
  end if;

  select id into v_company_id
  from public.companies
  where slug = p_slug and status = 'active'
  limit 1;

  if v_company_id is null then
    raise exception 'Loja não encontrada.';
  end if;

  select * into v_coupon
  from public.coupons
  where company_id = v_company_id
    and code = v_code
    and is_active = true
  limit 1;

  if not found then raise exception 'Cupom inválido ou inativo.'; end if;
  if v_coupon.starts_at is not null and v_coupon.starts_at > now() then raise exception 'Este cupom ainda não começou.'; end if;
  if v_coupon.ends_at is not null and v_coupon.ends_at < now() then raise exception 'Este cupom expirou.'; end if;
  if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then raise exception 'O limite deste cupom foi atingido.'; end if;
  if v_subtotal < v_coupon.minimum_order_value then
    raise exception 'Pedido mínimo para este cupom: R$ %.', to_char(v_coupon.minimum_order_value, 'FM999999990D00');
  end if;

  v_discount := case
    when v_coupon.discount_type = 'percentage' then v_subtotal * v_coupon.discount_value / 100
    else v_coupon.discount_value
  end;
  if v_coupon.maximum_discount is not null then
    v_discount := least(v_discount, v_coupon.maximum_discount);
  end if;
  v_discount := least(v_subtotal, round(v_discount, 2));

  return jsonb_build_object(
    'code', v_coupon.code,
    'name', v_coupon.name,
    'description', v_coupon.description,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'total_after_discount', greatest(0, v_subtotal - v_discount)
  );
end;
$$;

revoke all on function public.preview_public_coupon(text,text,numeric) from public;
grant execute on function public.preview_public_coupon(text,text,numeric) to anon, authenticated;
