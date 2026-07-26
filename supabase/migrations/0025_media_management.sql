-- MercadoFood v2.6: biblioteca de imagens segura, multiempresa e ordenável.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-media',
  'company-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.promotions add column if not exists image_url text;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('product', 'company', 'promotion', 'combo')),
  entity_id uuid not null,
  kind text not null default 'gallery' check (kind in ('gallery', 'logo', 'banner')),
  storage_path text not null unique,
  public_url text not null,
  alt_text text,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 8388608),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_assets_entity_idx
  on public.media_assets(company_id, entity_type, entity_id, kind, sort_order, created_at);

create unique index if not exists media_assets_singleton_kind_idx
  on public.media_assets(company_id, entity_type, entity_id, kind)
  where kind in ('logo', 'banner');

alter table public.media_assets enable row level security;

create or replace function public.media_entity_belongs_to_company(
  target_company uuid,
  target_entity_type text,
  target_entity_id uuid
)
returns boolean language sql stable security definer set search_path = public as $$
  select case target_entity_type
    when 'company' then target_entity_id = target_company
    when 'product' then exists (
      select 1 from public.products where id = target_entity_id and company_id = target_company
    )
    when 'promotion' then exists (
      select 1 from public.promotions where id = target_entity_id and company_id = target_company
    )
    when 'combo' then exists (
      select 1 from public.combos where id = target_entity_id and company_id = target_company
    )
    else false
  end;
$$;

drop policy if exists "company media readable" on public.media_assets;
create policy "company media readable" on public.media_assets for select
using (
  public.has_company_role(company_id, array['owner','manager','stock'])
);

drop policy if exists "authorized roles insert media" on public.media_assets;
create policy "authorized roles insert media" on public.media_assets for insert
with check (
  created_by = auth.uid()
  and public.has_company_role(company_id, array['owner','manager','stock'])
  and public.media_entity_belongs_to_company(company_id, entity_type, entity_id)
  and (
    (entity_type = 'company' and public.has_company_role(company_id, array['owner','manager']))
    or (entity_type = 'promotion' and public.has_company_role(company_id, array['owner','manager']))
    or (entity_type in ('product','combo') and public.has_company_role(company_id, array['owner','manager','stock']))
  )
);

drop policy if exists "authorized roles update media" on public.media_assets;
create policy "authorized roles update media" on public.media_assets for update
using (
  public.has_company_role(company_id, array['owner','manager','stock'])
)
with check (
  public.media_entity_belongs_to_company(company_id, entity_type, entity_id)
  and (
    (entity_type in ('company','promotion') and public.has_company_role(company_id, array['owner','manager']))
    or (entity_type in ('product','combo') and public.has_company_role(company_id, array['owner','manager','stock']))
  )
);

drop policy if exists "authorized roles delete media" on public.media_assets;
create policy "authorized roles delete media" on public.media_assets for delete
using (
  (entity_type in ('company','promotion') and public.has_company_role(company_id, array['owner','manager']))
  or (entity_type in ('product','combo') and public.has_company_role(company_id, array['owner','manager','stock']))
);

-- A pasta raiz de todo arquivo é obrigatoriamente o UUID da empresa.
drop policy if exists "company members upload media" on storage.objects;
create policy "company members upload media" on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-media'
  and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','manager','stock'])
);

drop policy if exists "company members update media" on storage.objects;
create policy "company members update media" on storage.objects for update to authenticated
using (
  bucket_id = 'company-media'
  and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','manager','stock'])
)
with check (
  bucket_id = 'company-media'
  and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','manager','stock'])
);

drop policy if exists "company members delete media" on storage.objects;
create policy "company members delete media" on storage.objects for delete to authenticated
using (
  bucket_id = 'company-media'
  and public.has_company_role((storage.foldername(name))[1]::uuid, array['owner','manager','stock'])
);

create or replace function public.sync_primary_media_url()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_company uuid;
  target_type text;
  target_id uuid;
  target_kind text;
  first_url text;
begin
  target_company := coalesce(new.company_id, old.company_id);
  target_type := coalesce(new.entity_type, old.entity_type);
  target_id := coalesce(new.entity_id, old.entity_id);
  target_kind := coalesce(new.kind, old.kind);

  select public_url into first_url
  from public.media_assets
  where company_id = target_company
    and entity_type = target_type
    and entity_id = target_id
    and kind = target_kind
  order by sort_order, created_at
  limit 1;

  if target_type = 'product' and target_kind = 'gallery' then
    update public.products set image_url = first_url, updated_at = now()
    where id = target_id and company_id = target_company;
  elsif target_type = 'combo' and target_kind = 'gallery' then
    update public.combos set image_url = first_url, updated_at = now()
    where id = target_id and company_id = target_company;
  elsif target_type = 'promotion' and target_kind = 'gallery' then
    update public.promotions set image_url = first_url, updated_at = now()
    where id = target_id and company_id = target_company;
  elsif target_type = 'company' and target_kind = 'logo' then
    update public.companies set logo_url = first_url, updated_at = now()
    where id = target_id and id = target_company;
  elsif target_type = 'company' and target_kind = 'banner' then
    update public.companies set banner_url = first_url, updated_at = now()
    where id = target_id and id = target_company;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists media_assets_sync_primary on public.media_assets;
create trigger media_assets_sync_primary
after insert or update or delete on public.media_assets
for each row execute function public.sync_primary_media_url();

grant select, insert, update, delete on public.media_assets to authenticated;
grant execute on function public.media_entity_belongs_to_company(uuid, text, uuid) to authenticated;
