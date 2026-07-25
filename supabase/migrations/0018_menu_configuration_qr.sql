-- MercadoFood v1.9: configuração do cardápio, horários, bairros e QR Code

alter table public.companies add column if not exists banner_url text;
alter table public.companies add column if not exists secondary_color text default '#F97316';
alter table public.companies add column if not exists menu_layout text not null default 'cards' check (menu_layout in ('cards','compact'));
alter table public.companies add column if not exists whatsapp text;
alter table public.companies add column if not exists address_line text;
alter table public.companies add column if not exists city text;
alter table public.companies add column if not exists state text;
alter table public.companies add column if not exists postal_code text;
alter table public.companies add column if not exists pickup_enabled boolean not null default true;
alter table public.companies add column if not exists delivery_enabled boolean not null default true;
alter table public.companies add column if not exists average_delivery_minutes integer not null default 45 check (average_delivery_minutes between 5 and 300);

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  is_open boolean not null default true,
  opens_at time,
  closes_at time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, weekday)
);

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  estimated_minutes integer not null default 45 check (estimated_minutes between 5 and 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_hours_company on public.business_hours(company_id, weekday);
create index if not exists idx_delivery_zones_company on public.delivery_zones(company_id, is_active, name);

alter table public.business_hours enable row level security;
alter table public.delivery_zones enable row level security;

do $$ begin
  create policy "company business hours" on public.business_hours for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company delivery zones" on public.delivery_zones for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

-- Atualiza o retorno público com aparência e opções de atendimento.
create or replace function public.get_public_menu(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'company', jsonb_build_object(
      'id', c.id, 'name', c.name, 'slug', c.slug, 'logo_url', c.logo_url,
      'banner_url', c.banner_url, 'primary_color', c.primary_color,
      'accent_color', c.accent_color, 'secondary_color', c.secondary_color,
      'menu_layout', c.menu_layout, 'menu_message', c.menu_message,
      'delivery_minimum', c.delivery_minimum, 'default_delivery_fee', c.default_delivery_fee,
      'pickup_enabled', c.pickup_enabled, 'delivery_enabled', c.delivery_enabled,
      'average_delivery_minutes', c.average_delivery_minutes,
      'is_open', coalesce((select bool_or(b.is_open) from branches b where b.company_id = c.id), false),
      'business_hours', coalesce((select jsonb_agg(jsonb_build_object(
        'weekday', h.weekday, 'is_open', h.is_open, 'opens_at', h.opens_at, 'closes_at', h.closes_at
      ) order by h.weekday) from business_hours h where h.company_id = c.id), '[]'::jsonb),
      'delivery_zones', coalesce((select jsonb_agg(jsonb_build_object(
        'id', z.id, 'name', z.name, 'delivery_fee', z.delivery_fee,
        'minimum_order', z.minimum_order, 'estimated_minutes', z.estimated_minutes
      ) order by z.name) from delivery_zones z where z.company_id = c.id and z.is_active = true), '[]'::jsonb)
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cat.id, 'name', cat.name, 'description', cat.description, 'sort_order', cat.sort_order,
        'products', coalesce((select jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name, 'description', p.description, 'image_url', p.image_url,
          'price', coalesce(p.promotional_price, p.base_price),
          'original_price', case when p.promotional_price is not null then p.base_price else null end,
          'preparation_time', p.preparation_time, 'is_featured', p.is_featured,
          'option_groups', coalesce((select jsonb_agg(jsonb_build_object(
            'id', g.id, 'name', g.name, 'description', g.description,
            'min_selection', g.min_selection, 'max_selection', g.max_selection,
            'options', coalesce((select jsonb_agg(jsonb_build_object(
              'id', o.id, 'name', o.name, 'price_delta', o.price_delta
            ) order by o.sort_order, o.name) from product_options o where o.group_id=g.id and o.is_active=true), '[]'::jsonb)
          ) order by g.sort_order, g.name) from product_option_groups g where g.product_id=p.id and g.is_active=true), '[]'::jsonb)
        ) order by p.is_featured desc, p.name) from products p
        where p.category_id=cat.id and p.company_id=c.id and p.is_active=true and p.availability_status='available'), '[]'::jsonb)
      ) order by cat.sort_order, cat.name) from categories cat where cat.company_id=c.id and cat.is_active=true
    ), '[]'::jsonb),
    'promotions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', pr.id, 'title', pr.title, 'description', pr.description, 'promotion_type', pr.promotion_type
    )) from promotions pr where pr.company_id=c.id and pr.is_active=true
      and (pr.starts_at is null or pr.starts_at <= now()) and (pr.ends_at is null or pr.ends_at >= now())), '[]'::jsonb)
  ) into result from companies c where c.slug=p_slug and c.status='active' and c.menu_is_active=true;
  return result;
end;
$$;

grant execute on function public.get_public_menu(text) to anon, authenticated;
