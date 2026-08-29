-- Gestão Delivery Simples: indisponibilidade automática por estoque sem sobrescrever
-- indisponibilidade manual do lojista.

alter table public.products
  add column if not exists stock_auto_unavailable boolean not null default false;

comment on column public.products.stock_auto_unavailable is
  'True somente quando o próprio controle de estoque marcou o produto como indisponível; permite reativação automática segura após nova entrada.';

create or replace function public.delivery_simple_sync_product_availability(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_reserved numeric := 0;
  v_available numeric := 0;
begin
  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then return; end if;

  -- Produto sem controle de estoque nunca deve ficar preso em um estado automático antigo.
  if not coalesce(v_product.track_stock, false) then
    if coalesce(v_product.stock_auto_unavailable, false) then
      update public.products
      set availability_status = 'available',
          stock_auto_unavailable = false,
          updated_at = now()
      where id = v_product.id;
    end if;
    return;
  end if;

  select coalesce(sum(
    public.delivery_simple_convert_quantity(
      r.quantity,
      r.unit,
      coalesce(v_product.stock_unit, 'unit')
    )
  ), 0)
  into v_reserved
  from public.product_stock_reservations r
  where r.product_id = v_product.id
    and r.company_id = v_product.company_id
    and r.status = 'reserved'
    and r.expires_at > now();

  v_available := coalesce(v_product.stock_quantity, 0) - v_reserved;

  if v_available <= 0 then
    -- Só assumimos a autoria da indisponibilidade se o produto estava disponível.
    if v_product.availability_status = 'available' then
      update public.products
      set availability_status = 'unavailable',
          stock_auto_unavailable = true,
          updated_at = now()
      where id = v_product.id;
    end if;
  elsif coalesce(v_product.stock_auto_unavailable, false) then
    -- Reativa apenas o que o estoque havia desativado. Uma pausa manual permanece intacta.
    update public.products
    set availability_status = 'available',
        stock_auto_unavailable = false,
        updated_at = now()
    where id = v_product.id;
  end if;
end;
$$;

revoke all on function public.delivery_simple_sync_product_availability(uuid) from public, anon, authenticated;

create or replace function public.delivery_simple_sync_product_availability_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.delivery_simple_sync_product_availability(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create or replace function public.delivery_simple_sync_reservation_product_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.delivery_simple_sync_product_availability(old.product_id);
  end if;
  perform public.delivery_simple_sync_product_availability(coalesce(new.product_id, old.product_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_delivery_simple_product_stock_availability on public.products;
create trigger trg_delivery_simple_product_stock_availability
after insert or update of stock_quantity, track_stock, stock_unit
on public.products
for each row execute function public.delivery_simple_sync_product_availability_trigger();

drop trigger if exists trg_delivery_simple_reservation_availability on public.product_stock_reservations;
create trigger trg_delivery_simple_reservation_availability
after insert or update of quantity, unit, status, expires_at, product_id or delete
on public.product_stock_reservations
for each row execute function public.delivery_simple_sync_reservation_product_trigger();

-- Ajusta o estado inicial dos produtos já controlados ao aplicar a migration.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.products where coalesce(track_stock, false)
  loop
    perform public.delivery_simple_sync_product_availability(v_id);
  end loop;
end $$;
