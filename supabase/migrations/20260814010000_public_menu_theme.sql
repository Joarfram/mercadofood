alter table public.companies
  add column if not exists menu_theme text not null default 'light'
    check (menu_theme in ('light', 'dark'));

create or replace function public.get_public_menu(p_slug text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'company', jsonb_build_object(
      'id', c.id, 'name', c.name, 'slug', c.slug,
      'logo_url', c.logo_url, 'banner_url', c.banner_url,
      'primary_color', c.primary_color, 'accent_color', c.accent_color,
      'menu_theme', c.menu_theme, 'menu_message', c.menu_message,
      'delivery_minimum', c.delivery_minimum, 'default_delivery_fee', c.default_delivery_fee,
      'is_open', coalesce((select bool_or(b.is_open) from branches b where b.company_id = c.id), false)
    ),
    'categories', coalesce((select jsonb_agg(jsonb_build_object(
      'id', cat.id, 'name', cat.name, 'description', cat.description, 'sort_order', cat.sort_order,
      'products', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'description', p.description, 'image_url', p.image_url,
        'image_fit', p.image_fit, 'image_position', p.image_position,
        'price', coalesce(p.promotional_price, p.base_price),
        'original_price', case when p.promotional_price is not null then p.base_price else null end,
        'preparation_time', p.preparation_time, 'is_featured', p.is_featured,
        'option_groups', coalesce((select jsonb_agg(jsonb_build_object(
          'id', g.id, 'name', g.name, 'description', g.description, 'group_type', g.group_type,
          'min_selection', g.min_selection, 'max_selection', g.max_selection, 'free_selection', g.free_selection,
          'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'price_delta', o.price_delta, 'max_quantity', o.max_quantity) order by o.sort_order, o.name) from product_options o where o.group_id = g.id and o.is_active = true), '[]'::jsonb)
        ) order by g.sort_order, g.name) from product_option_groups g where g.product_id = p.id and g.is_active = true), '[]'::jsonb)
      ) order by p.is_featured desc, p.name) from products p where p.category_id = cat.id and p.company_id = c.id and p.is_active = true and p.availability_status = 'available'), '[]'::jsonb)
    ) order by cat.sort_order, cat.name) from categories cat where cat.company_id = c.id and cat.is_active = true), '[]'::jsonb),
    'promotions', coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'title', pr.title, 'description', pr.description, 'promotion_type', pr.promotion_type, 'image_url', pr.image_url) order by pr.created_at desc) from promotions pr where pr.company_id = c.id and pr.is_active = true and (pr.starts_at is null or pr.starts_at <= now()) and (pr.ends_at is null or pr.ends_at >= now())), '[]'::jsonb)
  ) into result from companies c where c.slug = p_slug and c.status = 'active' and c.menu_is_active = true;
  return result;
end;
$$;

grant execute on function public.get_public_menu(text) to anon, authenticated;
