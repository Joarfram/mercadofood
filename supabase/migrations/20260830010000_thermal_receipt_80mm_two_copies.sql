-- Padroniza a comanda MercadoFood em bobina 80 mm, duas vias e impressão automática.
update public.thermal_printers
set paper_width = 80, copies = 2, auto_print = true, updated_at = now()
where paper_width <> 80 or copies <> 2 or auto_print = false;

create or replace function public.claim_print_job(p_token text) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare v_printer public.thermal_printers; v_job public.print_jobs; v_order jsonb;
begin
  if p_token is null or length(p_token)<32 then return null; end if;
  select * into v_printer from public.thermal_printers
  where connector_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and status='active' limit 1;
  if v_printer.id is null then return null; end if;
  update public.thermal_printers set connector_last_seen_at=now() where id=v_printer.id;
  select * into v_job from public.print_jobs where printer_id=v_printer.id and status in ('pending','failed') and attempts<5 and available_at<=now() order by created_at for update skip locked limit 1;
  if v_job.id is null then return null; end if;
  update public.print_jobs set status='processing',attempts=attempts+1,updated_at=now() where id=v_job.id;
  select jsonb_build_object(
    'job_id',v_job.id,'printer_name',v_printer.windows_printer_name,
    'paper_width',80,'copies',2,'print_customer',v_printer.print_customer,
    'print_address',v_printer.print_address,'print_payment',v_printer.print_payment,
    'company_name',c.name,'order',to_jsonb(o),
    'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('options',coalesce((select jsonb_agg(to_jsonb(op)) from public.order_item_options op where op.order_item_id=i.id),'[]'::jsonb))) from public.order_items i where i.order_id=o.id),'[]'::jsonb)
  ) into v_order
  from public.orders o join public.companies c on c.id=o.company_id where o.id=v_job.order_id;
  return v_order;
end $$;

revoke all on function public.claim_print_job(text) from public;
grant execute on function public.claim_print_job(text) to anon,authenticated;

create or replace function private.enqueue_order_print() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'canceled' then
    insert into public.print_jobs(company_id,printer_id,order_id)
    select new.company_id,p.id,new.id
    from public.thermal_printers p
    where p.company_id=new.company_id and p.status='active' and p.auto_print=true
    on conflict(printer_id,order_id) do nothing;
  end if;
  return new;
end $$;

revoke all on function private.enqueue_order_print() from public,anon,authenticated;
