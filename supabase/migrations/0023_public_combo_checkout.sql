-- MercadoFood v2.4: combos no cardápio público e checkout seguro.

create or replace function public.create_public_combo_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company companies%rowtype;
  v_branch_id uuid;
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number bigint;
  v_public_code text;
  v_item jsonb;
  v_choice jsonb;
  v_combo combos%rowtype;
  v_group combo_groups%rowtype;
  v_order_item_id uuid;
  v_quantity numeric;
  v_base_price numeric;
  v_extras numeric;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_total numeric := 0;
  v_customer_name text;
  v_customer_phone text;
  v_service_type text;
  v_payment_method text;
  v_group_count numeric;
  v_selected_quantity numeric;
  v_free_remaining numeric;
  v_free_quantity numeric;
  v_charged_quantity numeric;
  v_product_id uuid;
  v_product_name text;
  v_price_delta numeric;
  v_max_quantity integer;
  v_duplicate_count integer;
begin
  select * into v_company from companies
  where slug = nullif(trim(p_payload->>'slug'), '') and status = 'active' and menu_is_active = true;
  if not found then raise exception 'Cardápio indisponível.'; end if;

  select id into v_branch_id from branches where company_id=v_company.id and is_open=true order by created_at limit 1;
  if v_branch_id is null then select id into v_branch_id from branches where company_id=v_company.id order by created_at limit 1; end if;
  if v_branch_id is null then raise exception 'A loja ainda não possui uma unidade configurada.'; end if;

  v_customer_name := nullif(trim(p_payload->>'customer_name'), '');
  v_customer_phone := regexp_replace(coalesce(p_payload->>'customer_phone',''), '\D', '', 'g');
  v_service_type := coalesce(nullif(p_payload->>'service_type',''), 'delivery');
  v_payment_method := coalesce(nullif(p_payload->>'payment_method',''), 'pix');

  if v_customer_name is null or length(v_customer_phone) < 10 then raise exception 'Informe nome e WhatsApp válidos.'; end if;
  if v_service_type not in ('delivery','pickup') then raise exception 'Tipo de atendimento inválido.'; end if;
  if v_payment_method not in ('pix','cash','card_on_delivery','card_online','other') then raise exception 'Forma de pagamento inválida.'; end if;
  if jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb)) = 0 then raise exception 'O carrinho está vazio.'; end if;

  select id into v_customer_id from customers where company_id=v_company.id and phone=v_customer_phone limit 1;
  if v_customer_id is null then
    insert into customers(company_id,name,phone,marketing_consent)
    values(v_company.id,v_customer_name,v_customer_phone,coalesce((p_payload->>'marketing_consent')::boolean,false))
    returning id into v_customer_id;
  else
    update customers set name=v_customer_name, updated_at=now() where id=v_customer_id;
  end if;

  insert into orders(company_id,branch_id,customer_id,customer_name,customer_phone,channel,service_type,status,
    payment_status,payment_method,subtotal,discount_amount,delivery_fee,total,notes,delivery_address)
  values(v_company.id,v_branch_id,v_customer_id,v_customer_name,v_customer_phone,'public_menu','delivery','new',
    'pending',v_payment_method,0,0,0,0,nullif(trim(p_payload->>'notes'),''),
    case when v_service_type='delivery' then coalesce(p_payload->'delivery_address','{}'::jsonb) else '{}'::jsonb end)
  returning id,order_number,public_code into v_order_id,v_order_number,v_public_code;

  update orders set service_type=v_service_type where id=v_order_id;

  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into v_combo from combos
      where id=(v_item->>'combo_id')::uuid and company_id=v_company.id and is_active=true and availability_status='available';
    if not found then raise exception 'Um combo do carrinho não está mais disponível.'; end if;

    v_quantity := greatest(1,least(99,coalesce((v_item->>'quantity')::numeric,1)));
    v_base_price := coalesce(v_combo.promotional_price,v_combo.base_price);
    v_extras := 0;

    select count(*) - count(distinct concat(entry->>'group_id',':',entry->>'product_id')) into v_duplicate_count
    from jsonb_array_elements(coalesce(v_item->'choices','[]'::jsonb)) entry;
    if v_duplicate_count > 0 then raise exception 'Há escolhas duplicadas no combo.'; end if;

    for v_group in select * from combo_groups where combo_id=v_combo.id and company_id=v_company.id and is_active=true loop
      select coalesce(sum(greatest(0,least(gp.max_quantity,coalesce((entry->>'quantity')::numeric,1)))),0)
      into v_group_count
      from jsonb_array_elements(coalesce(v_item->'choices','[]'::jsonb)) entry
      join combo_group_products gp on gp.group_id=v_group.id and gp.product_id=(entry->>'product_id')::uuid
      join products p on p.id=gp.product_id
      where entry->>'group_id'=v_group.id::text and gp.company_id=v_company.id and gp.is_active=true
        and p.is_active=true and p.availability_status='available';

      if v_group_count < v_group.min_selection then raise exception 'Escolha pelo menos % item(ns) em “%”.',v_group.min_selection,v_group.name; end if;
      if v_group_count > v_group.max_selection then raise exception 'Escolha no máximo % item(ns) em “%”.',v_group.max_selection,v_group.name; end if;

      v_free_remaining := least(v_group.free_selection,v_group_count);
      for v_choice in
        select entry
        from jsonb_array_elements(coalesce(v_item->'choices','[]'::jsonb)) entry
        join combo_group_products gp on gp.group_id=v_group.id and gp.product_id=(entry->>'product_id')::uuid
        where entry->>'group_id'=v_group.id::text and gp.company_id=v_company.id and gp.is_active=true
        order by gp.price_delta desc,gp.sort_order
      loop
        v_product_id := (v_choice->>'product_id')::uuid;
        select p.name,gp.price_delta,gp.max_quantity into strict v_product_name,v_price_delta,v_max_quantity
        from combo_group_products gp join products p on p.id=gp.product_id
        where gp.group_id=v_group.id and gp.product_id=v_product_id and gp.company_id=v_company.id and gp.is_active=true
          and p.is_active=true and p.availability_status='available';
        v_selected_quantity := greatest(1,coalesce((v_choice->>'quantity')::numeric,1));
        if v_selected_quantity > v_max_quantity then raise exception 'A opção “%” permite no máximo % unidade(s).',v_product_name,v_max_quantity; end if;
        v_free_quantity := least(v_selected_quantity,v_free_remaining);
        v_charged_quantity := v_selected_quantity-v_free_quantity;
        v_free_remaining := v_free_remaining-v_free_quantity;
        v_extras := v_extras + round(v_price_delta*v_charged_quantity,2);
      end loop;
    end loop;

    if exists (
      select 1 from jsonb_array_elements(coalesce(v_item->'choices','[]'::jsonb)) entry
      left join combo_groups g on g.id=(entry->>'group_id')::uuid and g.combo_id=v_combo.id and g.is_active=true
      left join combo_group_products gp on gp.group_id=g.id and gp.product_id=(entry->>'product_id')::uuid and gp.is_active=true
      where g.id is null or gp.id is null
    ) then raise exception 'Uma escolha do combo não está mais disponível.'; end if;

    insert into order_items(company_id,order_id,product_id,product_name,unit_price,quantity,total_price,notes)
    values(v_company.id,v_order_id,null,v_combo.name,v_base_price+v_extras,v_quantity,round((v_base_price+v_extras)*v_quantity,2),nullif(trim(v_item->>'notes'),''))
    returning id into v_order_item_id;

    for v_group in select * from combo_groups where combo_id=v_combo.id and company_id=v_company.id and is_active=true loop
      select coalesce(sum(greatest(0,coalesce((entry->>'quantity')::numeric,1))),0) into v_group_count
      from jsonb_array_elements(coalesce(v_item->'choices','[]'::jsonb)) entry
      where entry->>'group_id'=v_group.id::text;
      v_free_remaining := least(v_group.free_selection,v_group_count);

      for v_choice in
        select entry
        from jsonb_array_elements(coalesce(v_item->'choices','[]'::jsonb)) entry
        join combo_group_products gp on gp.group_id=v_group.id and gp.product_id=(entry->>'product_id')::uuid
        where entry->>'group_id'=v_group.id::text and gp.is_active=true
        order by gp.price_delta desc,gp.sort_order
      loop
        v_product_id := (v_choice->>'product_id')::uuid;
        select p.name,gp.price_delta into strict v_product_name,v_price_delta
        from combo_group_products gp join products p on p.id=gp.product_id
        where gp.group_id=v_group.id and gp.product_id=v_product_id;
        v_selected_quantity := greatest(1,coalesce((v_choice->>'quantity')::numeric,1));
        v_free_quantity := least(v_selected_quantity,v_free_remaining);
        v_charged_quantity := v_selected_quantity-v_free_quantity;
        v_free_remaining := v_free_remaining-v_free_quantity;
        insert into order_item_combo_choices(company_id,order_item_id,combo_id,group_id,product_id,group_name,product_name,
          unit_price,quantity,free_quantity,charged_quantity,total_price)
        values(v_company.id,v_order_item_id,v_combo.id,v_group.id,v_product_id,v_group.name,v_product_name,v_price_delta,
          v_selected_quantity,v_free_quantity,v_charged_quantity,round(v_price_delta*v_charged_quantity,2));
      end loop;
    end loop;

    v_subtotal := v_subtotal + round((v_base_price+v_extras)*v_quantity,2);
  end loop;

  if v_service_type='delivery' then v_delivery_fee := coalesce(v_company.default_delivery_fee,0); end if;
  if v_service_type='delivery' and v_subtotal < coalesce(v_company.delivery_minimum,0) then
    raise exception 'O pedido mínimo para entrega é %.',to_char(v_company.delivery_minimum,'FM999G999D00');
  end if;

  v_total := round(v_subtotal+v_delivery_fee,2);
  update orders set subtotal=v_subtotal,delivery_fee=v_delivery_fee,total=v_total where id=v_order_id;
  insert into order_payments(company_id,order_id,method,status,amount) values(v_company.id,v_order_id,v_payment_method,'pending',v_total);

  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'public_code',v_public_code,'total',v_total);
exception when others then
  if v_order_id is not null then delete from orders where id=v_order_id; end if;
  raise;
end;
$$;

grant execute on function public.create_public_combo_order(jsonb) to anon, authenticated;
