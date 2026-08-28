-- MercadoFood: grupos de complementos reutilizáveis em vários produtos.

alter table public.product_option_groups
  drop constraint if exists product_option_groups_product_id_fkey;

alter table public.product_option_groups
  alter column product_id drop not null;

alter table public.product_option_groups
  add constraint product_option_groups_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

create table if not exists public.product_option_group_links (
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (product_id, group_id)
);

create index if not exists idx_option_group_links_group
  on public.product_option_group_links(group_id, is_active);
create index if not exists idx_option_group_links_product
  on public.product_option_group_links(product_id, is_active, sort_order);

alter table public.product_option_group_links enable row level security;

revoke all on table public.product_option_group_links from anon;
grant select, insert, update, delete on table public.product_option_group_links to authenticated;

do $$ begin
  create policy "company option group links" on public.product_option_group_links for all
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

create or replace function public.validate_product_option_group_link()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.products p
    where p.id = new.product_id and p.company_id = new.company_id
  ) then
    raise exception 'Produto inválido para esta empresa.';
  end if;
  if not exists (
    select 1 from public.product_option_groups g
    where g.id = new.group_id and g.company_id = new.company_id
  ) then
    raise exception 'Grupo de complementos inválido para esta empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_product_option_group_link_trigger on public.product_option_group_links;
create trigger validate_product_option_group_link_trigger
before insert or update on public.product_option_group_links
for each row execute function public.validate_product_option_group_link();

insert into public.product_option_group_links(company_id, product_id, group_id, sort_order, is_active)
select company_id, product_id, id, sort_order, true
from public.product_option_groups
where product_id is not null
on conflict (product_id, group_id) do nothing;

create or replace function public.link_option_group_to_legacy_product()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.product_id is not null then
    insert into public.product_option_group_links(company_id, product_id, group_id, sort_order, is_active)
    values(new.company_id, new.product_id, new.id, new.sort_order, true)
    on conflict (product_id, group_id) do update
      set sort_order = excluded.sort_order;
  end if;
  return new;
end;
$$;

drop trigger if exists link_option_group_to_legacy_product_trigger on public.product_option_groups;
create trigger link_option_group_to_legacy_product_trigger
after insert or update of product_id, sort_order on public.product_option_groups
for each row execute function public.link_option_group_to_legacy_product();

revoke all on function public.validate_product_option_group_link() from public;
revoke all on function public.link_option_group_to_legacy_product() from public;


create or replace function public.get_public_menu(p_slug text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'company', jsonb_build_object(
      'id', c.id, 'name', c.name, 'slug', c.slug,
      'logo_url', c.logo_url, 'banner_url', c.banner_url,
      'default_product_image_url', c.default_product_image_url,
      'default_category_image_url', c.default_category_image_url,
      'primary_color', c.primary_color, 'accent_color', c.accent_color,
      'menu_theme', c.menu_theme, 'menu_message', c.menu_message,
      'delivery_minimum', c.delivery_minimum, 'default_delivery_fee', c.default_delivery_fee,
      'is_open', coalesce((select bool_or(b.is_open) from branches b where b.company_id = c.id), false)
    ),
    'categories', coalesce((select jsonb_agg(jsonb_build_object(
      'id', cat.id, 'name', cat.name, 'description', cat.description,
      'image_url', c.default_category_image_url, 'sort_order', cat.sort_order,
      'products', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'description', p.description,
        'image_url', coalesce(p.image_url, c.default_product_image_url),
        'image_fit', p.image_fit, 'image_position', p.image_position,
        'price', coalesce(p.promotional_price, p.base_price),
        'original_price', case when p.promotional_price is not null then p.base_price else null end,
        'preparation_time', p.preparation_time, 'is_featured', p.is_featured,
        'option_groups', coalesce((select jsonb_agg(jsonb_build_object(
          'id', g.id, 'name', g.name, 'description', g.description, 'group_type', g.group_type,
          'min_selection', g.min_selection, 'max_selection', g.max_selection, 'free_selection', g.free_selection,
          'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price_delta', o.price_delta, 'max_quantity', o.max_quantity) order by o.sort_order, o.name) from product_options o where o.group_id = g.id and o.is_active = true), '[]'::jsonb)
        ) order by g.sort_order, g.name) from product_option_group_links pgl join product_option_groups g on g.id = pgl.group_id where pgl.product_id = p.id and pgl.company_id = c.id and pgl.is_active = true and g.is_active = true), '[]'::jsonb)
      ) order by p.is_featured desc, p.name) from products p where p.category_id = cat.id and p.company_id = c.id and p.is_active = true and p.availability_status = 'available'), '[]'::jsonb)
    ) order by cat.sort_order, cat.name) from categories cat where cat.company_id = c.id and cat.is_active = true), '[]'::jsonb),
    'promotions', coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'title', pr.title, 'description', pr.description, 'promotion_type', pr.promotion_type, 'image_url', pr.image_url) order by pr.created_at desc) from promotions pr where pr.company_id = c.id and pr.is_active = true and (pr.starts_at is null or pr.starts_at <= now()) and (pr.ends_at is null or pr.ends_at >= now())), '[]'::jsonb)
  ) into result from companies c where c.slug = p_slug and c.status = 'active' and c.menu_is_active = true;
  return result;
end;
$$;

revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;



create or replace function public.create_public_order(p_payload jsonb)
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
  v_option jsonb;
  v_product products%rowtype;
  v_group product_option_groups%rowtype;
  v_order_item_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_option_total numeric;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_coupon coupons%rowtype;
  v_customer_phone text;
  v_customer_name text;
  v_service_type text;
  v_payment_method text;
  v_coupon_code text;
  v_now timestamptz := now();
  v_group_count numeric;
  v_selected_quantity numeric;
  v_max_quantity numeric;
  v_free_remaining numeric;
  v_free_quantity numeric;
  v_charged_quantity numeric;
  v_option_price numeric;
  v_option_name text;
  v_option_id uuid;
  v_duplicate_count integer;
begin
  select * into v_company from companies
  where slug = nullif(trim(p_payload->>'slug'), '') and status = 'active' and menu_is_active = true;
  if not found then raise exception 'Cardápio indisponível.'; end if;

  select id into v_branch_id from branches where company_id = v_company.id and is_open = true order by created_at limit 1;
  if v_branch_id is null then select id into v_branch_id from branches where company_id = v_company.id order by created_at limit 1; end if;
  if v_branch_id is null then raise exception 'A loja ainda não possui uma unidade configurada.'; end if;

  v_customer_name := nullif(trim(p_payload->>'customer_name'), '');
  v_customer_phone := regexp_replace(coalesce(p_payload->>'customer_phone',''), '\D', '', 'g');
  v_service_type := coalesce(nullif(p_payload->>'service_type',''), 'delivery');
  v_payment_method := coalesce(nullif(p_payload->>'payment_method',''), 'pix');
  v_coupon_code := upper(regexp_replace(coalesce(p_payload->>'coupon_code',''), '\s+', '', 'g'));

  if v_customer_name is null or length(v_customer_phone) < 10 then raise exception 'Informe nome e WhatsApp válidos.'; end if;
  if v_service_type not in ('delivery','pickup') then raise exception 'Tipo de atendimento inválido.'; end if;
  if v_payment_method not in ('pix','cash','card_on_delivery','card_online','other') then raise exception 'Forma de pagamento inválida.'; end if;
  if jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb)) = 0 then raise exception 'O carrinho está vazio.'; end if;

  select id into v_customer_id from customers where company_id = v_company.id and phone = v_customer_phone limit 1;
  if v_customer_id is null then
    insert into customers(company_id, name, phone, marketing_consent)
    values(v_company.id, v_customer_name, v_customer_phone, coalesce((p_payload->>'marketing_consent')::boolean, false))
    returning id into v_customer_id;
  else
    update customers set name = v_customer_name, updated_at = now() where id = v_customer_id;
  end if;

  insert into orders(company_id, branch_id, customer_id, customer_name, customer_phone, channel, service_type, status,
    payment_status, payment_method, subtotal, discount_amount, delivery_fee, total, notes, delivery_address)
  values(v_company.id, v_branch_id, v_customer_id, v_customer_name, v_customer_phone, 'public_menu', v_service_type, 'new',
    'pending', v_payment_method, 0, 0, 0, 0, nullif(trim(p_payload->>'notes'), ''),
    case when v_service_type='delivery' then coalesce(p_payload->'delivery_address','{}'::jsonb) else '{}'::jsonb end)
  returning id, order_number, public_code into v_order_id, v_order_number, v_public_code;

  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into v_product from products
    where id = (v_item->>'product_id')::uuid and company_id = v_company.id and is_active=true and availability_status='available';
    if not found then raise exception 'Um produto do carrinho não está mais disponível.'; end if;

    v_quantity := greatest(1, least(99, coalesce((v_item->>'quantity')::numeric, 1)));
    v_unit_price := coalesce(v_product.promotional_price, v_product.base_price);
    v_option_total := 0;

    -- Não permite o mesmo option_id mais de uma vez no JSON.
    select count(*) - count(distinct entry->>'option_id') into v_duplicate_count
    from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry;
    if v_duplicate_count > 0 then raise exception 'Há complementos duplicados no item.'; end if;

    -- Valida todos os grupos ativos, inclusive os obrigatórios sem seleção.
    for v_group in
      select g.* from product_option_group_links pgl
      join product_option_groups g on g.id = pgl.group_id
      where pgl.product_id = v_product.id and pgl.company_id = v_company.id
        and pgl.is_active = true and g.company_id = v_company.id and g.is_active = true
    loop
      select coalesce(sum(greatest(0, least(coalesce(o.max_quantity,1), coalesce((entry->>'quantity')::numeric,1)))),0)
      into v_group_count
      from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry
      join product_options o on o.id=(entry->>'option_id')::uuid
      where o.group_id=v_group.id and o.company_id=v_company.id and o.is_active=true;

      if v_group_count < v_group.min_selection then
        raise exception 'Escolha pelo menos % unidade(s) em “%”.', v_group.min_selection, v_group.name;
      end if;
      if v_group_count > v_group.max_selection then
        raise exception 'Escolha no máximo % unidade(s) em “%”.', v_group.max_selection, v_group.name;
      end if;
      if v_group.group_type='single' and v_group_count > 1 then
        raise exception 'O grupo “%” permite somente uma escolha.', v_group.name;
      end if;

      v_free_remaining := least(v_group.free_selection, v_group_count);

      -- Processa opções de maior preço primeiro para aplicar a gratuidade de forma previsível e favorável ao cliente.
      for v_option in
        select entry
        from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry
        join product_options o on o.id=(entry->>'option_id')::uuid
        where o.group_id=v_group.id and o.company_id=v_company.id and o.is_active=true
        order by o.price_delta desc, o.sort_order, o.name
      loop
        v_option_id := (v_option->>'option_id')::uuid;
        select o.name, o.price_delta, o.max_quantity
          into strict v_option_name, v_option_price, v_max_quantity
        from product_options o where o.id=v_option_id and o.group_id=v_group.id and o.company_id=v_company.id and o.is_active=true;

        v_selected_quantity := greatest(1, coalesce((v_option->>'quantity')::numeric,1));
        if v_selected_quantity > v_max_quantity then
          raise exception 'A opção “%” permite no máximo % unidade(s).', v_option_name, v_max_quantity;
        end if;

        v_free_quantity := least(v_selected_quantity, v_free_remaining);
        v_charged_quantity := v_selected_quantity - v_free_quantity;
        v_free_remaining := v_free_remaining - v_free_quantity;
        v_option_total := v_option_total + round(v_option_price * v_charged_quantity, 2);
      end loop;
    end loop;

    -- Rejeita opção que não pertença a grupo ativo do produto.
    if exists (
      select 1 from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry
      left join product_options o on o.id=(entry->>'option_id')::uuid and o.company_id=v_company.id and o.is_active=true
      left join product_option_groups g on g.id=o.group_id and g.company_id=v_company.id and g.is_active=true
      left join product_option_group_links pgl on pgl.group_id=g.id and pgl.product_id=v_product.id
        and pgl.company_id=v_company.id and pgl.is_active=true
      where o.id is null or g.id is null or pgl.group_id is null
    ) then raise exception 'Um complemento selecionado não está disponível para este produto.'; end if;

    insert into order_items(company_id, order_id, product_id, product_name, unit_price, quantity, total_price, notes)
    values(v_company.id, v_order_id, v_product.id, v_product.name, v_unit_price + v_option_total, v_quantity,
      round((v_unit_price + v_option_total) * v_quantity, 2), nullif(trim(v_item->>'notes'), ''))
    returning id into v_order_item_id;

    for v_group in
      select g.* from product_option_group_links pgl
      join product_option_groups g on g.id = pgl.group_id
      where pgl.product_id = v_product.id and pgl.company_id = v_company.id
        and pgl.is_active = true and g.company_id = v_company.id and g.is_active = true
    loop
      select coalesce(sum(greatest(0, coalesce((entry->>'quantity')::numeric,1))),0) into v_group_count
      from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry
      join product_options o on o.id=(entry->>'option_id')::uuid
      where o.group_id=v_group.id and o.company_id=v_company.id and o.is_active=true;
      v_free_remaining := least(v_group.free_selection, v_group_count);

      for v_option in
        select entry
        from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) entry
        join product_options o on o.id=(entry->>'option_id')::uuid
        where o.group_id=v_group.id and o.company_id=v_company.id and o.is_active=true
        order by o.price_delta desc, o.sort_order, o.name
      loop
        v_option_id := (v_option->>'option_id')::uuid;
        select o.name, o.price_delta into strict v_option_name, v_option_price from product_options o where o.id=v_option_id;
        v_selected_quantity := greatest(1, coalesce((v_option->>'quantity')::numeric,1));
        v_free_quantity := least(v_selected_quantity, v_free_remaining);
        v_charged_quantity := v_selected_quantity - v_free_quantity;
        v_free_remaining := v_free_remaining - v_free_quantity;

        insert into order_item_options(company_id, order_item_id, option_id, option_name, unit_price, quantity, free_quantity, charged_quantity, total_price)
        values(v_company.id, v_order_item_id, v_option_id, v_option_name, v_option_price,
          v_selected_quantity * v_quantity, v_free_quantity * v_quantity, v_charged_quantity * v_quantity,
          round(v_option_price * v_charged_quantity * v_quantity,2));
      end loop;
    end loop;

    v_subtotal := v_subtotal + round((v_unit_price + v_option_total) * v_quantity, 2);
  end loop;

  if v_service_type='delivery' then
    if v_subtotal < v_company.delivery_minimum then raise exception 'O pedido mínimo para entrega é R$ %.', to_char(v_company.delivery_minimum,'FM999999990D00'); end if;
    v_delivery_fee := v_company.default_delivery_fee;
  end if;

  if v_coupon_code <> '' then
    select * into v_coupon from coupons where company_id=v_company.id and code=v_coupon_code and is_active=true;
    if not found then raise exception 'Cupom inválido ou inativo.'; end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at > v_now then raise exception 'Este cupom ainda não começou.'; end if;
    if v_coupon.ends_at is not null and v_coupon.ends_at < v_now then raise exception 'Este cupom expirou.'; end if;
    if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then raise exception 'O limite deste cupom foi atingido.'; end if;
    if v_subtotal < v_coupon.minimum_order_value then raise exception 'O pedido não atingiu o valor mínimo do cupom.'; end if;
    if (select count(*) from coupon_redemptions where coupon_id=v_coupon.id and customer_id=v_customer_id) >= v_coupon.per_customer_limit then raise exception 'Você já atingiu o limite deste cupom.'; end if;
    v_discount := case when v_coupon.discount_type='percentage' then v_subtotal*v_coupon.discount_value/100 else v_coupon.discount_value end;
    if v_coupon.maximum_discount is not null then v_discount := least(v_discount, v_coupon.maximum_discount); end if;
    v_discount := least(v_subtotal, round(v_discount,2));
  else v_discount := 0;
  end if;

  v_total := greatest(0, round(v_subtotal - v_discount + v_delivery_fee, 2));
  update orders set subtotal=v_subtotal, discount_amount=v_discount, delivery_fee=v_delivery_fee, total=v_total,
    coupon_id=case when v_coupon.id is not null then v_coupon.id else null end,
    coupon_code=case when v_coupon.id is not null then v_coupon.code else null end,
    updated_at=now()
  where id=v_order_id;

  insert into order_payments(company_id, order_id, method, status, amount)
  values(v_company.id, v_order_id, v_payment_method, 'pending', v_total);

  if v_coupon.id is not null and v_discount > 0 then
    insert into coupon_redemptions(company_id, coupon_id, customer_id, order_id, discount_amount)
    values(v_company.id, v_coupon.id, v_customer_id, v_order_id, v_discount);
    update coupons set usage_count=usage_count+1, updated_at=now() where id=v_coupon.id;
  end if;

  return jsonb_build_object('order_id',v_order_id,'order_number',v_order_number,'public_code',v_public_code,'total',v_total);
exception when others then
  if v_order_id is not null then delete from orders where id=v_order_id; end if;
  raise;
end;
$$;

grant execute on function public.create_public_order(jsonb) to anon, authenticated;


