-- MercadoFood Impulsiona: campanhas locais com criativo próprio ou serviço de IA.
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  content_type text not null default 'product' check (content_type in ('product','combo','promotion','menu','custom')),
  content_id uuid,
  objective text not null default 'orders' check (objective in ('orders','whatsapp','menu','promotion','profile')),
  creative_mode text not null default 'own' check (creative_mode in ('own','ai')),
  caption text,
  call_to_action text not null default 'Pedir agora',
  destination_url text,
  radius_km integer not null default 5 check (radius_km between 1 and 50),
  daily_budget numeric(12,2) not null check (daily_budget >= 10),
  duration_days integer not null check (duration_days between 1 and 30),
  media_budget numeric(12,2) not null,
  platform_fee numeric(12,2) not null default 9.90,
  ai_fee numeric(12,2) not null default 0,
  total_due numeric(12,2) not null,
  status text not null default 'draft' check (status in ('draft','awaiting_creative','awaiting_payment','ready','published','paused','rejected','canceled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_campaigns_company_idx on public.marketing_campaigns(company_id, created_at desc);
alter table public.marketing_campaigns enable row level security;
drop policy if exists "company manages marketing campaigns" on public.marketing_campaigns;
create policy "company manages marketing campaigns" on public.marketing_campaigns for all to authenticated
using (public.has_company_role(company_id, array['owner','manager']))
with check (public.has_company_role(company_id, array['owner','manager']) and created_by = auth.uid());
grant select, insert, update, delete on public.marketing_campaigns to authenticated;

alter table public.media_assets drop constraint if exists media_assets_entity_type_check;
alter table public.media_assets add constraint media_assets_entity_type_check check (entity_type in ('product','company','promotion','combo','campaign'));

create or replace function public.media_entity_belongs_to_company(target_company uuid, target_entity_type text, target_entity_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case target_entity_type
    when 'company' then target_entity_id = target_company
    when 'product' then exists (select 1 from public.products where id = target_entity_id and company_id = target_company)
    when 'promotion' then exists (select 1 from public.promotions where id = target_entity_id and company_id = target_company)
    when 'combo' then exists (select 1 from public.combos where id = target_entity_id and company_id = target_company)
    when 'campaign' then exists (select 1 from public.marketing_campaigns where id = target_entity_id and company_id = target_company)
    else false end;
$$;

drop policy if exists "authorized roles insert media" on public.media_assets;
create policy "authorized roles insert media" on public.media_assets for insert with check (
  created_by = auth.uid() and public.media_entity_belongs_to_company(company_id, entity_type, entity_id) and
  ((entity_type in ('company','promotion','campaign') and public.has_company_role(company_id,array['owner','manager'])) or
   (entity_type in ('product','combo') and public.has_company_role(company_id,array['owner','manager','stock'])))
);
drop policy if exists "authorized roles update media" on public.media_assets;
create policy "authorized roles update media" on public.media_assets for update using (public.has_company_role(company_id,array['owner','manager','stock'])) with check (
  public.media_entity_belongs_to_company(company_id, entity_type, entity_id) and
  ((entity_type in ('company','promotion','campaign') and public.has_company_role(company_id,array['owner','manager'])) or
   (entity_type in ('product','combo') and public.has_company_role(company_id,array['owner','manager','stock'])))
);
drop policy if exists "authorized roles delete media" on public.media_assets;
create policy "authorized roles delete media" on public.media_assets for delete using (
  (entity_type in ('company','promotion','campaign') and public.has_company_role(company_id,array['owner','manager'])) or
  (entity_type in ('product','combo') and public.has_company_role(company_id,array['owner','manager','stock']))
);
