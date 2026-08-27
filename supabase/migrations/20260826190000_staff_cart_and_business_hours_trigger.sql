-- Corrige o gatilho de horario para consultar o status apenas em pedidos publicos.
create or replace function public.enforce_public_order_business_hours()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.channel = 'public_menu' then
    if not public.is_company_open_now(new.company_id) then
      raise exception 'A loja está fechada no momento. Consulte o horário de funcionamento e tente novamente quando ela abrir.';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_public_order_business_hours() from public, anon, authenticated;

-- Amplia o pedido interno para varios itens, complementos e observacao por item.
create or replace function public.create_staff_order(p_payload jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_company_id uuid := nullif(p_payload->>'company_id','')::uuid;
  v_branch_id uuid; v_customer_id uuid; v_item jsonb; v_option jsonb;
  v_customer_name text := trim(coalesce(p_payload->>'customer_name',''));
  v_customer_phone text := nullif(regexp_replace(coalesce(p_payload->>'customer_phone',''),'[^0-9]','','g'),'');
  v_service_type text := coalesce(nullif(p_payload->>'service_type',''),'delivery');
  v_payment_method text := coalesce(nullif(p_payload->>'payment_method',''),'pix');
  v_product public.products%rowtype; v_customer public.customers%rowtype;
  v_coupon public.coupons%rowtype; v_loyalty public.loyalty_settings%rowtype; v_order public.orders%rowtype;
  v_order_item_id uuid; v_quantity integer; v_unit_price numeric(12,2); v_option_unit_total numeric(12,2);
  v_option_id uuid; v_option_quantity integer; v_option_name text; v_option_price numeric(12,2);
  v_group_id uuid; v_group_name text; v_group_min integer; v_group_max integer; v_group_free integer;
  v_selected integer; v_free_remaining integer; v_free_quantity integer; v_charged_quantity integer;
  v_subtotal numeric(12,2) := 0; v_coupon_discount numeric(12,2) := 0; v_loyalty_discount numeric(12,2) := 0;
  v_points integer := 0; v_total numeric(12,2); v_balance integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessao expirada.'; end if;
  if p_idempotency_key is null then raise exception 'Chave de idempotencia obrigatoria.'; end if;
  if v_company_id is null or not public.can_access_module(v_company_id,'orders') then raise exception 'Acesso negado.'; end if;
  if length(v_customer_name) < 2 then raise exception 'Informe o cliente.'; end if;
  if jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))=0 then raise exception 'Adicione pelo menos um produto.'; end if;
  if v_service_type not in ('delivery','pickup','dine_in','counter') then raise exception 'Tipo de atendimento invalido.'; end if;
  if v_payment_method not in ('pix','cash','debit_card','credit_card','card_on_delivery','online_card','other') then raise exception 'Forma de pagamento invalida.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':' || p_idempotency_key::text,0));
  select * into v_order from public.orders where company_id=v_company_id and idempotency_key=p_idempotency_key;
  if v_order.id is not null then return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'discount_amount',v_order.discount_amount,'replayed',true); end if;

  select id into v_branch_id from public.branches where company_id=v_company_id order by created_at limit 1;
  if v_branch_id is null then insert into public.branches(company_id,name,is_open) values(v_company_id,'Matriz',true) returning id into v_branch_id; end if;
  if v_customer_phone is not null then
    select * into v_customer from public.customers where company_id=v_company_id and phone=v_customer_phone for update;
    if v_customer.id is null then insert into public.customers(company_id,name,phone) values(v_company_id,v_customer_name,v_customer_phone) returning * into v_customer;
    else update public.customers set name=v_customer_name,updated_at=now() where id=v_customer.id; end if;
    v_customer_id:=v_customer.id; v_balance:=coalesce(v_customer.loyalty_points,0);
  end if;

  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into v_product from public.products where id=nullif(v_item->>'product_id','')::uuid and company_id=v_company_id and is_active=true and availability_status='available' for share;
    if v_product.id is null then raise exception 'Um produto esta indisponivel ou nao foi encontrado.'; end if;
    v_quantity:=greatest(1,least(99,coalesce((v_item->>'quantity')::integer,1)));
    v_unit_price:=coalesce(v_product.promotional_price,v_product.base_price); v_option_unit_total:=0;

    if (select count(*)<>count(distinct entry->>'option_id') from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry) then raise exception 'Ha complementos duplicados no item.'; end if;
    for v_group_id,v_group_name,v_group_min,v_group_max,v_group_free in
      select id,name,min_selection,max_selection,coalesce(free_selection,0) from public.product_option_groups where product_id=v_product.id and company_id=v_company_id and is_active=true
    loop
      select coalesce(sum(greatest(1,least(coalesce(o.max_quantity,1),coalesce((entry->>'quantity')::integer,1)))),0)
      into v_selected from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry join public.product_options o on o.id=(entry->>'option_id')::uuid
      where o.group_id=v_group_id and o.company_id=v_company_id and o.is_active=true;
      if v_selected<v_group_min then raise exception 'Escolha pelo menos % unidade(s) em "%".',v_group_min,v_group_name; end if;
      if v_selected>v_group_max then raise exception 'Escolha no maximo % unidade(s) em "%".',v_group_max,v_group_name; end if;
      v_free_remaining:=least(v_group_free,v_selected);
      for v_option in select entry from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry join public.product_options o on o.id=(entry->>'option_id')::uuid where o.group_id=v_group_id and o.company_id=v_company_id and o.is_active=true order by o.price_delta desc loop
        v_option_id:=(v_option->>'option_id')::uuid;
        select name,price_delta,coalesce(max_quantity,1) into v_option_name,v_option_price,v_selected from public.product_options where id=v_option_id;
        v_option_quantity:=greatest(1,coalesce((v_option->>'quantity')::integer,1));
        if v_option_quantity>v_selected then raise exception 'A opcao "%" excedeu a quantidade maxima.',v_option_name; end if;
        v_free_quantity:=least(v_option_quantity,v_free_remaining); v_charged_quantity:=v_option_quantity-v_free_quantity; v_free_remaining:=v_free_remaining-v_free_quantity;
        v_option_unit_total:=v_option_unit_total+round(v_option_price*v_charged_quantity,2);
      end loop;
    end loop;
    if exists(select 1 from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry left join public.product_options o on o.id=(entry->>'option_id')::uuid and o.company_id=v_company_id and o.is_active=true left join public.product_option_groups g on g.id=o.group_id and g.product_id=v_product.id and g.is_active=true where g.id is null) then raise exception 'Um complemento nao pertence ao produto.'; end if;
    v_subtotal:=v_subtotal+round((v_unit_price+v_option_unit_total)*v_quantity,2);
  end loop;

  if nullif(trim(coalesce(p_payload->>'coupon_code','')),'') is not null then
    select * into v_coupon from public.coupons where company_id=v_company_id and code=upper(regexp_replace(p_payload->>'coupon_code','[[:space:]]','','g')) and is_active=true for update;
    if v_coupon.id is null then raise exception 'Cupom invalido ou inativo.'; end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at>now() then raise exception 'Este cupom ainda nao comecou.'; end if;
    if v_coupon.ends_at is not null and v_coupon.ends_at<now() then raise exception 'Este cupom expirou.'; end if;
    if v_coupon.usage_limit is not null and v_coupon.usage_count>=v_coupon.usage_limit then raise exception 'Limite do cupom atingido.'; end if;
    if v_subtotal<v_coupon.minimum_order_value then raise exception 'Pedido abaixo do minimo do cupom.'; end if;
    if v_customer_id is not null and v_coupon.per_customer_limit is not null and (select count(*) from public.coupon_redemptions where coupon_id=v_coupon.id and customer_id=v_customer_id)>=v_coupon.per_customer_limit then raise exception 'Cliente atingiu o limite do cupom.'; end if;
    v_coupon_discount:=case when v_coupon.discount_type='percentage' then v_subtotal*v_coupon.discount_value/100 else v_coupon.discount_value end;
    if v_coupon.maximum_discount is not null then v_coupon_discount:=least(v_coupon_discount,v_coupon.maximum_discount); end if;
    v_coupon_discount:=least(v_subtotal,round(v_coupon_discount,2));
  end if;
  if coalesce((p_payload->>'redeem_loyalty')::boolean,false) then
    if v_customer_id is null then raise exception 'Informe um cliente cadastrado para usar pontos.'; end if;
    select * into v_loyalty from public.loyalty_settings where company_id=v_company_id and is_enabled=true for update;
    if v_loyalty.id is null then raise exception 'Programa de fidelidade inativo.'; end if;
    if v_balance<v_loyalty.reward_points then raise exception 'Pontos insuficientes.'; end if;
    v_points:=v_loyalty.reward_points; v_loyalty_discount:=least(v_subtotal-v_coupon_discount,v_loyalty.reward_value);
  end if;
  v_total:=greatest(0,round(v_subtotal-v_coupon_discount-v_loyalty_discount,2));
  insert into public.orders(company_id,branch_id,customer_id,customer_name,customer_phone,channel,service_type,status,payment_status,payment_method,subtotal,discount_amount,total,coupon_id,coupon_code,loyalty_points_redeemed,loyalty_discount_amount,notes,delivery_address,idempotency_key)
  values(v_company_id,v_branch_id,v_customer_id,v_customer_name,v_customer_phone,'staff',v_service_type,'new','pending',v_payment_method,v_subtotal,v_coupon_discount+v_loyalty_discount,v_total,v_coupon.id,v_coupon.code,v_points,v_loyalty_discount,nullif(trim(p_payload->>'notes'),''),case when v_service_type='delivery' then coalesce(p_payload->'delivery_address','{}'::jsonb) else '{}'::jsonb end,p_idempotency_key) returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid and company_id=v_company_id;
    v_quantity:=greatest(1,least(99,coalesce((v_item->>'quantity')::integer,1))); v_unit_price:=coalesce(v_product.promotional_price,v_product.base_price); v_option_unit_total:=0;
    for v_group_id,v_group_free in select id,coalesce(free_selection,0) from public.product_option_groups where product_id=v_product.id and company_id=v_company_id and is_active=true loop
      select coalesce(sum(coalesce((entry->>'quantity')::integer,1)),0) into v_selected from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry join public.product_options o on o.id=(entry->>'option_id')::uuid where o.group_id=v_group_id;
      v_free_remaining:=least(v_group_free,v_selected);
      for v_option in select entry from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry join public.product_options o on o.id=(entry->>'option_id')::uuid where o.group_id=v_group_id order by o.price_delta desc loop
        v_option_id:=(v_option->>'option_id')::uuid; select name,price_delta into v_option_name,v_option_price from public.product_options where id=v_option_id;
        v_option_quantity:=greatest(1,coalesce((v_option->>'quantity')::integer,1)); v_free_quantity:=least(v_option_quantity,v_free_remaining); v_charged_quantity:=v_option_quantity-v_free_quantity; v_free_remaining:=v_free_remaining-v_free_quantity; v_option_unit_total:=v_option_unit_total+round(v_option_price*v_charged_quantity,2);
      end loop;
    end loop;
    insert into public.order_items(company_id,order_id,product_id,product_name,unit_price,quantity,total_price,notes) values(v_company_id,v_order.id,v_product.id,v_product.name,v_unit_price+v_option_unit_total,v_quantity,round((v_unit_price+v_option_unit_total)*v_quantity,2),nullif(trim(v_item->>'notes'),'')) returning id into v_order_item_id;
    for v_group_id,v_group_free in select id,coalesce(free_selection,0) from public.product_option_groups where product_id=v_product.id and company_id=v_company_id and is_active=true loop
      select coalesce(sum(coalesce((entry->>'quantity')::integer,1)),0) into v_selected from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry join public.product_options o on o.id=(entry->>'option_id')::uuid where o.group_id=v_group_id;
      v_free_remaining:=least(v_group_free,v_selected);
      for v_option in select entry from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry join public.product_options o on o.id=(entry->>'option_id')::uuid where o.group_id=v_group_id order by o.price_delta desc,o.sort_order,o.name loop
        v_option_id:=(v_option->>'option_id')::uuid; v_option_quantity:=greatest(1,coalesce((v_option->>'quantity')::integer,1));
        select name,price_delta into v_option_name,v_option_price from public.product_options where id=v_option_id;
        v_free_quantity:=least(v_option_quantity,v_free_remaining); v_charged_quantity:=v_option_quantity-v_free_quantity; v_free_remaining:=v_free_remaining-v_free_quantity;
        insert into public.order_item_options(company_id,order_item_id,option_id,option_name,unit_price,quantity,free_quantity,charged_quantity,total_price) values(v_company_id,v_order_item_id,v_option_id,v_option_name,v_option_price,v_option_quantity*v_quantity,v_free_quantity*v_quantity,v_charged_quantity*v_quantity,round(v_option_price*v_charged_quantity*v_quantity,2));
      end loop;
    end loop;
  end loop;
  insert into public.order_payments(company_id,order_id,method,status,amount) values(v_company_id,v_order.id,v_payment_method,'pending',v_total);
  if v_coupon.id is not null and v_coupon_discount>0 then insert into public.coupon_redemptions(company_id,coupon_id,customer_id,order_id,discount_amount) values(v_company_id,v_coupon.id,v_customer_id,v_order.id,v_coupon_discount); update public.coupons set usage_count=usage_count+1,updated_at=now() where id=v_coupon.id; end if;
  if v_points>0 then v_balance:=v_balance-v_points; update public.customers set loyalty_points=v_balance,updated_at=now() where id=v_customer_id; insert into public.loyalty_movements(company_id,customer_id,order_id,movement_type,points,balance_after,description,created_by) values(v_company_id,v_customer_id,v_order.id,'redeem',-v_points,v_balance,'Resgate no pedido #'||v_order.order_number,auth.uid()); end if;
  return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'discount_amount',v_order.discount_amount,'replayed',false);
end;
$$;

revoke all on function public.create_staff_order(jsonb,uuid) from public, anon;
grant execute on function public.create_staff_order(jsonb,uuid) to authenticated;
