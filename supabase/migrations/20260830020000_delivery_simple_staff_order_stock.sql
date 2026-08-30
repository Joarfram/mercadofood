-- Gestão Delivery Simples: corrige o pedido interno para aceitar o carrinho completo
-- e reservar estoque na mesma transação da criação do pedido.

create or replace function public.create_staff_order(p_payload jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid := nullif(p_payload->>'company_id','')::uuid;
  v_branch_id uuid;
  v_customer_id uuid;
  v_customer_name text := trim(coalesce(p_payload->>'customer_name',''));
  v_customer_phone text := nullif(regexp_replace(coalesce(p_payload->>'customer_phone',''),'[^0-9]','','g'),'');
  v_service_type text := coalesce(nullif(p_payload->>'service_type',''),'delivery');
  v_payment_method text := coalesce(nullif(p_payload->>'payment_method',''),'pix');
  v_items jsonb := coalesce(p_payload->'items','[]'::jsonb);
  v_item jsonb;
  v_option jsonb;
  v_product public.products%rowtype;
  v_group public.product_option_groups%rowtype;
  v_customer public.customers%rowtype;
  v_coupon public.coupons%rowtype;
  v_loyalty public.loyalty_settings%rowtype;
  v_order public.orders%rowtype;
  v_order_item_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_option_total numeric;
  v_subtotal numeric(12,2) := 0;
  v_coupon_discount numeric(12,2) := 0;
  v_loyalty_discount numeric(12,2) := 0;
  v_points integer := 0;
  v_total numeric(12,2);
  v_balance integer := 0;
  v_group_count numeric;
  v_selected_quantity numeric;
  v_free_remaining numeric;
  v_free_quantity numeric;
  v_charged_quantity numeric;
  v_option_id uuid;
  v_option_name text;
  v_option_price numeric;
  v_max_quantity numeric;
  v_duplicate_count integer;
begin
  if auth.uid() is null then raise exception 'Sessão expirada.'; end if;
  if p_idempotency_key is null then raise exception 'Chave de idempotência obrigatória.'; end if;
  if v_company_id is null or not public.can_access_module(v_company_id,'orders') then raise exception 'Acesso negado.'; end if;
  if length(v_customer_name) < 2 then raise exception 'Informe o cliente.'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items)=0 then raise exception 'Adicione pelo menos um produto.'; end if;
  if v_service_type not in ('delivery','pickup','dine_in','counter') then raise exception 'Tipo de atendimento inválido.'; end if;
  if v_payment_method not in ('pix','cash','debit_card','credit_card','card_on_delivery','online_card','other') then raise exception 'Forma de pagamento inválida.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':' || p_idempotency_key::text,0));
  select * into v_order from public.orders where company_id=v_company_id and idempotency_key=p_idempotency_key;
  if v_order.id is not null then
    return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'discount_amount',v_order.discount_amount,'replayed',true);
  end if;

  select id into v_branch_id from public.branches where company_id=v_company_id order by is_open desc, created_at limit 1;
  if v_branch_id is null then
    insert into public.branches(company_id,name,is_open) values(v_company_id,'Matriz',true) returning id into v_branch_id;
  end if;

  if v_customer_phone is not null then
    select * into v_customer from public.customers where company_id=v_company_id and phone=v_customer_phone for update;
    if v_customer.id is null then
      insert into public.customers(company_id,name,phone) values(v_company_id,v_customer_name,v_customer_phone) returning * into v_customer;
    else
      update public.customers set name=v_customer_name,updated_at=now() where id=v_customer.id returning * into v_customer;
    end if;
    v_customer_id := v_customer.id;
    v_balance := coalesce(v_customer.loyalty_points,0);
  end if;

  insert into public.orders(
    company_id,branch_id,customer_id,customer_name,customer_phone,channel,service_type,status,payment_status,payment_method,
    subtotal,discount_amount,delivery_fee,total,notes,delivery_address,idempotency_key
  ) values(
    v_company_id,v_branch_id,v_customer_id,v_customer_name,v_customer_phone,'staff',v_service_type,'new','pending',v_payment_method,
    0,0,0,0,nullif(trim(p_payload->>'notes'),''),
    case when v_service_type='delivery' then coalesce(p_payload->'delivery_address','{}'::jsonb) else '{}'::jsonb end,
    p_idempotency_key
  ) returning * into v_order;

  for v_item in select * from jsonb_array_elements(v_items) loop
    select * into v_product from public.products
    where id=nullif(v_item->>'product_id','')::uuid and company_id=v_company_id and is_active=true and availability_status='available'
    for share;
    if v_product.id is null then raise exception 'Um produto do carrinho não está mais disponível.'; end if;
    if coalesce(v_product.selling_mode,'unit') <> 'unit' then
      raise exception 'O pedido interno ainda não permite produto vendido por peso. Use o cardápio público para este item.';
    end if;

    v_quantity := greatest(1,least(99,coalesce((v_item->>'quantity')::numeric,1)));
    v_unit_price := coalesce(v_product.promotional_price,v_product.base_price);
    v_option_total := 0;

    select count(*)-count(distinct entry->>'option_id') into v_duplicate_count
    from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry;
    if v_duplicate_count>0 then raise exception 'Há complementos duplicados no item.'; end if;

    for v_group in
      select g.* from public.product_option_groups g
      join public.product_option_group_links l on l.group_id=g.id and l.product_id=v_product.id and l.company_id=v_company_id and l.is_active=true
      where g.company_id=v_company_id and g.is_active=true
    loop
      select coalesce(sum(greatest(0,least(coalesce(o.max_quantity,1),coalesce((entry->>'quantity')::numeric,1)))),0)
      into v_group_count
      from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry
      join public.product_options o on o.id=nullif(entry->>'option_id','')::uuid
      where o.group_id=v_group.id and o.company_id=v_company_id and o.is_active=true;

      if v_group_count<v_group.min_selection then raise exception 'Escolha pelo menos % item(ns) em “%”.',v_group.min_selection,v_group.name; end if;
      if v_group_count>v_group.max_selection then raise exception 'Escolha no máximo % item(ns) em “%”.',v_group.max_selection,v_group.name; end if;
      if v_group.group_type='single' and v_group_count>1 then raise exception 'O grupo “%” permite somente uma escolha.',v_group.name; end if;

      v_free_remaining := least(v_group.free_selection,v_group_count);
      for v_option in
        select entry from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry
        join public.product_options o on o.id=nullif(entry->>'option_id','')::uuid
        where o.group_id=v_group.id and o.company_id=v_company_id and o.is_active=true
        order by o.price_delta desc,o.sort_order,o.name
      loop
        v_option_id := (v_option->>'option_id')::uuid;
        select o.name,o.price_delta,o.max_quantity into strict v_option_name,v_option_price,v_max_quantity
        from public.product_options o where o.id=v_option_id and o.group_id=v_group.id and o.company_id=v_company_id and o.is_active=true;
        v_selected_quantity := greatest(1,coalesce((v_option->>'quantity')::numeric,1));
        if v_selected_quantity>v_max_quantity then raise exception 'A opção “%” permite no máximo % unidade(s).',v_option_name,v_max_quantity; end if;
        v_free_quantity := least(v_selected_quantity,v_free_remaining);
        v_charged_quantity := v_selected_quantity-v_free_quantity;
        v_free_remaining := v_free_remaining-v_free_quantity;
        v_option_total := v_option_total+round(v_option_price*v_charged_quantity,2);
      end loop;
    end loop;

    if exists (
      select 1 from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry
      left join public.product_options o on o.id=nullif(entry->>'option_id','')::uuid and o.company_id=v_company_id and o.is_active=true
      left join public.product_option_group_links l on l.group_id=o.group_id and l.product_id=v_product.id and l.company_id=v_company_id and l.is_active=true
      where o.id is null or l.id is null
    ) then raise exception 'Um complemento selecionado não está disponível para este produto.'; end if;

    insert into public.order_items(company_id,order_id,product_id,product_name,unit_price,quantity,total_price,notes,selling_mode,sale_quantity,sale_unit)
    values(v_company_id,v_order.id,v_product.id,v_product.name,v_unit_price+v_option_total,v_quantity,
      round((v_unit_price+v_option_total)*v_quantity,2),nullif(trim(v_item->>'notes'),''),'unit',v_quantity,'unit')
    returning id into v_order_item_id;

    for v_group in
      select g.* from public.product_option_groups g
      join public.product_option_group_links l on l.group_id=g.id and l.product_id=v_product.id and l.company_id=v_company_id and l.is_active=true
      where g.company_id=v_company_id and g.is_active=true
    loop
      select coalesce(sum(greatest(0,coalesce((entry->>'quantity')::numeric,1))),0) into v_group_count
      from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry
      join public.product_options o on o.id=nullif(entry->>'option_id','')::uuid
      where o.group_id=v_group.id and o.company_id=v_company_id and o.is_active=true;
      v_free_remaining := least(v_group.free_selection,v_group_count);
      for v_option in
        select entry from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry
        join public.product_options o on o.id=nullif(entry->>'option_id','')::uuid
        where o.group_id=v_group.id and o.company_id=v_company_id and o.is_active=true
        order by o.price_delta desc,o.sort_order,o.name
      loop
        v_option_id := (v_option->>'option_id')::uuid;
        select o.name,o.price_delta into strict v_option_name,v_option_price from public.product_options o where o.id=v_option_id;
        v_selected_quantity := greatest(1,coalesce((v_option->>'quantity')::numeric,1));
        v_free_quantity := least(v_selected_quantity,v_free_remaining);
        v_charged_quantity := v_selected_quantity-v_free_quantity;
        v_free_remaining := v_free_remaining-v_free_quantity;
        insert into public.order_item_options(company_id,order_item_id,option_id,option_name,unit_price,quantity,free_quantity,charged_quantity,total_price)
        values(v_company_id,v_order_item_id,v_option_id,v_option_name,v_option_price,
          v_selected_quantity*v_quantity,v_free_quantity*v_quantity,v_charged_quantity*v_quantity,
          round(v_option_price*v_charged_quantity*v_quantity,2));
      end loop;
    end loop;

    perform public.delivery_simple_apply_order_item_stock(v_order_item_id);
    v_subtotal := v_subtotal+round((v_unit_price+v_option_total)*v_quantity,2);
  end loop;

  if nullif(trim(coalesce(p_payload->>'coupon_code','')),'') is not null then
    select * into v_coupon from public.coupons
    where company_id=v_company_id and code=upper(regexp_replace(p_payload->>'coupon_code','[[:space:]]','','g')) and is_active=true
    for update;
    if v_coupon.id is null then raise exception 'Cupom inválido ou inativo.'; end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at>now() then raise exception 'Este cupom ainda não começou.'; end if;
    if v_coupon.ends_at is not null and v_coupon.ends_at<now() then raise exception 'Este cupom expirou.'; end if;
    if v_coupon.usage_limit is not null and v_coupon.usage_count>=v_coupon.usage_limit then raise exception 'Limite do cupom atingido.'; end if;
    if v_subtotal<v_coupon.minimum_order_value then raise exception 'Pedido abaixo do mínimo do cupom.'; end if;
    if v_customer_id is not null and v_coupon.per_customer_limit is not null and
      (select count(*) from public.coupon_redemptions where coupon_id=v_coupon.id and customer_id=v_customer_id)>=v_coupon.per_customer_limit
    then raise exception 'Cliente atingiu o limite do cupom.'; end if;
    v_coupon_discount := case when v_coupon.discount_type='percentage' then v_subtotal*v_coupon.discount_value/100 else v_coupon.discount_value end;
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
  update public.orders set subtotal=v_subtotal,discount_amount=v_coupon_discount+v_loyalty_discount,total=v_total,
    coupon_id=v_coupon.id,coupon_code=v_coupon.code,loyalty_points_redeemed=v_points,loyalty_discount_amount=v_loyalty_discount,updated_at=now()
  where id=v_order.id;

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

  return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'discount_amount',v_coupon_discount+v_loyalty_discount,'replayed',false);
end;
$$;

revoke all on function public.create_staff_order(jsonb,uuid) from public, anon;
grant execute on function public.create_staff_order(jsonb,uuid) to authenticated;

comment on function public.create_staff_order(jsonb,uuid) is
'Cria o carrinho interno completo e reserva estoque por item na mesma transação, preservando complementos, cupom, fidelidade e idempotência.';
