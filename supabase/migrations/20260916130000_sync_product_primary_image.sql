-- Mantém products.image_url sincronizado com a foto principal em media_assets.
-- Corrige cadastro/troca de foto feitos pelo centro integrado de produtos.

create or replace function public.sync_product_primary_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_product_id uuid;
  v_public_url text;
begin
  if tg_op = 'DELETE' then
    v_company_id := old.company_id;
    v_product_id := old.entity_id;
  else
    v_company_id := new.company_id;
    v_product_id := new.entity_id;
  end if;

  if (tg_op = 'DELETE' and (old.entity_type <> 'product' or old.kind <> 'gallery'))
     or (tg_op <> 'DELETE' and (new.entity_type <> 'product' or new.kind <> 'gallery')) then
    return coalesce(new, old);
  end if;

  select ma.public_url
    into v_public_url
  from public.media_assets ma
  where ma.company_id = v_company_id
    and ma.entity_type = 'product'
    and ma.entity_id = v_product_id
    and ma.kind = 'gallery'
    and (tg_op <> 'DELETE' or ma.id <> old.id)
  order by ma.sort_order asc, ma.created_at desc
  limit 1;

  if tg_op <> 'DELETE' and new.sort_order = 0 then
    v_public_url := new.public_url;
  end if;

  update public.products
  set image_url = v_public_url,
      updated_at = now()
  where id = v_product_id
    and company_id = v_company_id
    and image_url is distinct from v_public_url;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_product_primary_image on public.media_assets;
create trigger trg_sync_product_primary_image
after insert or update or delete
on public.media_assets
for each row execute function public.sync_product_primary_image();

-- Reconcilia produtos existentes sem apagar nenhuma mídia.
update public.products p
set image_url = (
      select ma.public_url
      from public.media_assets ma
      where ma.company_id = p.company_id
        and ma.entity_type = 'product'
        and ma.entity_id = p.id
        and ma.kind = 'gallery'
      order by ma.sort_order asc, ma.created_at desc
      limit 1
    ),
    updated_at = now()
where exists (
  select 1
  from public.media_assets ma
  where ma.company_id = p.company_id
    and ma.entity_type = 'product'
    and ma.entity_id = p.id
    and ma.kind = 'gallery'
)
and p.image_url is distinct from (
  select ma.public_url
  from public.media_assets ma
  where ma.company_id = p.company_id
    and ma.entity_type = 'product'
    and ma.entity_id = p.id
    and ma.kind = 'gallery'
  order by ma.sort_order asc, ma.created_at desc
  limit 1
);
