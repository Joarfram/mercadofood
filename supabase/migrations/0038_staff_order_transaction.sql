-- MercadoFood v2.8: pedido interno atomico e idempotente.

alter table public.orders add column if not exists idempotency_key uuid;
create unique index if not exists orders_company_idempotency_unique
on public.orders(company_id,idempotency_key) where idempotency_key is not null;

create or replace function public.create_staff_order(p_payload jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid := nullif(p_payload->>'company_id','')::uuid;
  v_product_id uuid := nullif(p_payload->>'product_id','')::uuid;
  v_branch_id uuid;
  v_customer_id uuid;
  v_customer_name text := trim(coalesce(p_payload->>'customer_name',''));
  v_customer_phone text := nullif(regexp_replace(coalesce(p_payload->>'customer_phone',''),'[^0-9]','','g'),'');
  v_quantity integer := greatest(1,least(99,coalesce((p_payload->>'quantity')::integer,1)));
  v_service_type text := coalesce(nullif(p_payload->>'service_type',''),'delivery');
  v_payment_method text := coalesce(nullif(p_payload->>'payment_method',''),'pix');
  v_product public.products%rowtype;
  v_customer public.customers%rowtype;
  v_coupon public.coupons%rowtype;
  v_loyalty public.loyalty_settings%rowtype;
  v_order public.orders%rowtype;
  v_subtotal numeric(12,2);
  v_coupon_discount numeric(12,2) := 0;
  v_loyalty_discount numeric(12,2) := 0;
  v_points integer := 0;
  v_total numeric(12,2);
  v_balance integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessao expirada.'; end if;
  if p_idempotency_key is null then raise exception 'Chave de idempotencia obrigatoria.'; end if;
  if v_company_id is null or not public.can_access_module(v_company_id,'orders') then raise exception 'Acesso negado.'; end if;
  if length(v_customer_name) < 2 or v_product_id is null then raise exception 'Informe cliente e produto.'; end if;
  if v_service_type not in ('delivery','pickup','dine_in','counter') then raise exception 'Tipo de atendimento invalido.'; end if;
  if v_payment_method not in ('pix','cash','debit_card','credit_card','card_on_delivery','online_card','other') then raise exception 'Forma de pagamento invalida.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':' || p_idempotency_key::text,0));
  select * into v_order from public.orders where company_id=v_company_id and idempotency_key=p_idempotency_key;
  if v_order.id is not null then
    return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'discount_amount',v_order.discount_amount,'replayed',true);
  end if;

  select * into v_product from public.products
  where id=v_product_id and company_id=v_company_id and is_active=true and availability_status='available'
  for share;
  if v_product.id is null then raise exception 'Produto indisponivel ou nao encontrado.'; end if;

  select id into v_branch_id from public.branches where company_id=v_company_id order by created_at limit 1;
  if v_branch_id is null then
    insert into public.branches(company_id,name,is_open) values(v_company_id,'Matriz',true) returning id into v_branch_id;
  end if;

  if v_customer_phone is not null then
    select * into v_customer from public.customers
    where company_id=v_company_id and phone=v_customer_phone for update;
    if v_customer.id is null then
      insert into public.customers(company_id,name,phone)
      values(v_company_id,v_customer_name,v_customer_phone) returning * into v_customer;
    end if;
    v_customer_id := v_customer.id;
    v_balance := coalesce(v_customer.loyalty_points,0);
  end if;

  v_subtotal := round(v_product.base_price * v_quantity,2);
  if nullif(trim(coalesce(p_payload->>'coupon_code','')),'') is not null then
    select * into v_coupon from public.coupons
    where company_id=v_company_id and code=upper(regexp_replace(p_payload->>'coupon_code','[[:space:]]','','g')) and is_active=true
    for update;
    if v_coupon.id is null then raise exception 'Cupom invalido ou inativo.'; end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at>now() then raise exception 'Este cupom ainda nao comecou.'; end if;
    if v_coupon.ends_at is not null and v_coupon.ends_at<now() then raise exception 'Este cupom expirou.'; end if;
    if v_coupon.usage_limit is not null and v_coupon.usage_count>=v_coupon.usage_limit then raise exception 'Limite do cupom atingido.'; end if;
    if v_subtotal<v_coupon.minimum_order_value then raise exception 'Pedido abaixo do minimo do cupom.'; end if;
    if v_customer_id is not null and v_coupon.per_customer_limit is not null and
      (select count(*) from public.coupon_redemptions where coupon_id=v_coupon.id and customer_id=v_customer_id)>=v_coupon.per_customer_limit
    then raise exception 'Cliente atingiu o limite do cupom.'; end if;
    v_coupon_discount := case when v_coupon.discount_type='percentage'
      then v_subtotal*v_coupon.discount_value/100 else v_coupon.discount_value end;
    if v_coupon.maximum_discount is not null then v_coupon_discount:=least(v_coupon_discount,v_coupon.maximum_discount); end if;
    v_coupon_discount:=least(v_subtotal,round(v_coupon_discount,2));
  end if;

  if coalesce((p_payload->>'redeem_loyalty')::boolean,false) then
    if v_customer_id is null then raise exception 'Informe um cliente cadastrado para usar pontos.'; end if;
    select * into v_loyalty from public.loyalty_settings where company_id=v_company_id and is_enabled=true for update;
    if v_loyalty.id is null then raise exception 'Programa de fidelidade inativo.'; end if;
    if v_balance<v_loyalty.reward_points then raise exception 'Pontos insuficientes.'; end if;
    v_points:=v_loyalty.reward_points;
    v_loyalty_discount:=least(v_subtotal-v_coupon_discount,v_loyalty.reward_value);
  end if;

  v_total:=greatest(0,round(v_subtotal-v_coupon_discount-v_loyalty_discount,2));
  insert into public.orders(
    company_id,branch_id,customer_id,customer_name,customer_phone,service_type,status,payment_status,payment_method,
    subtotal,discount_amount,total,coupon_id,coupon_code,loyalty_points_redeemed,loyalty_discount_amount,notes,delivery_address,idempotency_key
  ) values(
    v_company_id,v_branch_id,v_customer_id,v_customer_name,v_customer_phone,v_service_type,'new','pending',v_payment_method,
    v_subtotal,v_coupon_discount+v_loyalty_discount,v_total,v_coupon.id,v_coupon.code,v_points,v_loyalty_discount,
    nullif(trim(p_payload->>'notes'),''),
    case when v_service_type='delivery' then coalesce(p_payload->'delivery_address','{}'::jsonb) else '{}'::jsonb end,
    p_idempotency_key
  ) returning * into v_order;

  insert into public.order_items(company_id,order_id,product_id,product_name,unit_price,quantity,total_price)
  values(v_company_id,v_order.id,v_product.id,v_product.name,v_product.base_price,v_quantity,v_subtotal);
  insert into public.order_payments(company_id,order_id,method,status,amount)
  values(v_company_id,v_order.id,v_payment_method,'pending',v_total);

  if v_coupon.id is not null and v_coupon_discount>0 then
    insert into public.coupon_redemptions(company_id,coupon_id,customer_id,order_id,discount_amount)
    values(v_company_id,v_coupon.id,v_customer_id,v_order.id,v_coupon_discount);
    update public.coupons set usage_count=usage_count+1,updated_at=now() where id=v_coupon.id;
  end if;
  if v_points>0 then
    v_balance:=v_balance-v_points;
    update public.customers set loyalty_points=v_balance,updated_at=now() where id=v_customer_id;
    insert into public.loyalty_movements(company_id,customer_id,order_id,movement_type,points,balance_after,description,created_by)
    values(v_company_id,v_customer_id,v_order.id,'redeem',-v_points,v_balance,'Resgate no pedido #'||v_order.order_number,auth.uid());
  end if;

  return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'discount_amount',v_order.discount_amount,'replayed',false);
end;
$$;

revoke all on function public.create_staff_order(jsonb,uuid) from public, anon;
grant execute on function public.create_staff_order(jsonb,uuid) to authenticated;

comment on function public.create_staff_order(jsonb,uuid) is
'Cria pedido interno, itens, pagamento, cupom e fidelidade na mesma transacao, com idempotencia por empresa.';
