-- MercadoFood v1.8: cardápio público, adicionais e checkout do cliente

alter table public.companies add column if not exists menu_is_active boolean not null default true;
alter table public.companies add column if not exists menu_message text;
alter table public.companies add column if not exists delivery_minimum numeric(12,2) not null default 0;
alter table public.companies add column if not exists default_delivery_fee numeric(12,2) not null default 0;

create table if not exists public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  description text,
  min_selection integer not null default 0 check (min_selection >= 0),
  max_selection integer not null default 1 check (max_selection >= 1),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.product_options (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  option_id uuid references public.product_options(id) on delete set null,
  option_name text not null,
  unit_price numeric(12,2) not null default 0,
  quantity numeric(12,3) not null default 1,
  total_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_option_groups_product on public.product_option_groups(product_id, is_active, sort_order);
create index if not exists idx_product_options_group on public.product_options(group_id, is_active, sort_order);
create index if not exists idx_order_item_options_item on public.order_item_options(order_item_id);

alter table public.product_option_groups enable row level security;
alter table public.product_options enable row level security;
alter table public.order_item_options enable row level security;

do $$ begin
  create policy "company option groups" on public.product_option_groups for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company product options" on public.product_options for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company order item options" on public.order_item_options for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

-- Retorna somente dados públicos e ativos do cardápio.
create or replace function public.get_public_menu(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'company', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'slug', c.slug,
      'logo_url', c.logo_url,
      'primary_color', c.primary_color,
      'accent_color', c.accent_color,
      'menu_message', c.menu_message,
      'delivery_minimum', c.delivery_minimum,
      'default_delivery_fee', c.default_delivery_fee,
      'is_open', coalesce((select bool_or(b.is_open) from branches b where b.company_id = c.id), false)
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cat.id,
        'name', cat.name,
        'description', cat.description,
        'sort_order', cat.sort_order,
        'products', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'image_url', p.image_url,
            'price', coalesce(p.promotional_price, p.base_price),
            'original_price', case when p.promotional_price is not null then p.base_price else null end,
            'preparation_time', p.preparation_time,
            'is_featured', p.is_featured,
            'option_groups', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', g.id,
                'name', g.name,
                'description', g.description,
                'min_selection', g.min_selection,
                'max_selection', g.max_selection,
                'options', coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'id', o.id,
                    'name', o.name,
                    'price_delta', o.price_delta
                  ) order by o.sort_order, o.name)
                  from product_options o
                  where o.group_id = g.id and o.is_active = true
                ), '[]'::jsonb)
              ) order by g.sort_order, g.name)
              from product_option_groups g
              where g.product_id = p.id and g.is_active = true
            ), '[]'::jsonb)
          ) order by p.is_featured desc, p.name)
          from products p
          where p.category_id = cat.id
            and p.company_id = c.id
            and p.is_active = true
            and p.availability_status = 'available'
        ), '[]'::jsonb)
      ) order by cat.sort_order, cat.name)
      from categories cat
      where cat.company_id = c.id and cat.is_active = true
    ), '[]'::jsonb),
    'promotions', coalesce((
      select jsonb_agg(jsonb_build_object('id', pr.id, 'title', pr.title, 'description', pr.description, 'promotion_type', pr.promotion_type))
      from promotions pr
      where pr.company_id = c.id and pr.is_active = true
        and (pr.starts_at is null or pr.starts_at <= now())
        and (pr.ends_at is null or pr.ends_at >= now())
    ), '[]'::jsonb)
  ) into result
  from companies c
  where c.slug = p_slug and c.status = 'active' and c.menu_is_active = true;

  return result;
end;
$$;

grant execute on function public.get_public_menu(text) to anon, authenticated;

-- Checkout público. Recalcula preços no servidor e não confia em valores enviados pelo navegador.
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
begin
  select * into v_company from companies
  where slug = nullif(trim(p_payload->>'slug'), '') and status = 'active' and menu_is_active = true;
  if not found then raise exception 'Cardápio indisponível.'; end if;

  select id into v_branch_id from branches where company_id = v_company.id and is_open = true order by created_at limit 1;
  if v_branch_id is null then
    select id into v_branch_id from branches where company_id = v_company.id order by created_at limit 1;
  end if;
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

    for v_option in select * from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) loop
      select price_delta into strict v_discount from product_options o
      join product_option_groups g on g.id=o.group_id
      where o.id=(v_option->>'option_id')::uuid and o.company_id=v_company.id and o.is_active=true and g.product_id=v_product.id and g.is_active=true;
      v_option_total := v_option_total + v_discount;
    end loop;

    insert into order_items(company_id, order_id, product_id, product_name, unit_price, quantity, total_price, notes)
    values(v_company.id, v_order_id, v_product.id, v_product.name, v_unit_price + v_option_total, v_quantity,
      round((v_unit_price + v_option_total) * v_quantity, 2), nullif(trim(v_item->>'notes'), ''))
    returning id into v_order_item_id;

    for v_option in select * from jsonb_array_elements(coalesce(v_item->'options','[]'::jsonb)) loop
      insert into order_item_options(company_id, order_item_id, option_id, option_name, unit_price, quantity, total_price)
      select v_company.id, v_order_item_id, o.id, o.name, o.price_delta, v_quantity, round(o.price_delta*v_quantity,2)
      from product_options o
      join product_option_groups g on g.id=o.group_id
      where o.id=(v_option->>'option_id')::uuid and o.company_id=v_company.id and o.is_active=true and g.product_id=v_product.id and g.is_active=true;
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
  else
    v_discount := 0;
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
