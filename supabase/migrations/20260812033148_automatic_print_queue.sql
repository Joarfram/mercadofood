alter table public.thermal_printers add column if not exists connector_token_hash text;
alter table public.thermal_printers add column if not exists connector_last_seen_at timestamptz;

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  printer_id uuid not null references public.thermal_printers(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','processing','printed','failed')),
  attempts smallint not null default 0,
  available_at timestamptz not null default (now() + interval '5 seconds'),
  printed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(printer_id,order_id)
);
create index print_jobs_pending_idx on public.print_jobs(printer_id,status,available_at);
alter table public.print_jobs enable row level security;
create policy "company reads print jobs" on public.print_jobs for select to authenticated
using (public.has_company_role(company_id,array['owner','manager']));
grant select on public.print_jobs to authenticated;

create or replace function public.enqueue_order_print() returns trigger language plpgsql security invoker as $$
begin
  if new.status <> 'canceled' and (
    new.payment_method in ('cash','card_on_delivery','debit_card','credit_card')
    or new.payment_status = 'paid'
  ) then
    insert into public.print_jobs(company_id,printer_id,order_id)
    select new.company_id,p.id,new.id from public.thermal_printers p
    where p.company_id=new.company_id and p.status='active' and p.auto_print=true
    on conflict(printer_id,order_id) do nothing;
  end if;
  return new;
end $$;
create trigger orders_enqueue_print after insert or update of payment_status,payment_method,status on public.orders
for each row execute function public.enqueue_order_print();

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
  select jsonb_build_object('job_id',v_job.id,'printer_name',v_printer.windows_printer_name,'paper_width',v_printer.paper_width,'company_name',c.name,'order',to_jsonb(o),'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('options',coalesce((select jsonb_agg(to_jsonb(op)) from public.order_item_options op where op.order_item_id=i.id),'[]'::jsonb))) from public.order_items i where i.order_id=o.id),'[]'::jsonb)) into v_order
  from public.orders o join public.companies c on c.id=o.company_id where o.id=v_job.order_id;
  return v_order;
end $$;

create or replace function public.finish_print_job(p_token text,p_job_id uuid,p_success boolean,p_error text default null) returns boolean
language plpgsql security definer set search_path=public,extensions as $$
declare v_printer_id uuid;
begin
  select id into v_printer_id from public.thermal_printers where connector_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') limit 1;
  if v_printer_id is null then return false; end if;
  update public.print_jobs set status=case when p_success then 'printed' else 'failed' end,printed_at=case when p_success then now() else null end,last_error=case when p_success then null else left(p_error,500) end,available_at=case when p_success then available_at else now()+interval '30 seconds' end,updated_at=now() where id=p_job_id and printer_id=v_printer_id;
  return found;
end $$;
revoke all on function public.claim_print_job(text) from public;
revoke all on function public.finish_print_job(text,uuid,boolean,text) from public;
grant execute on function public.claim_print_job(text) to anon,authenticated;
grant execute on function public.finish_print_job(text,uuid,boolean,text) to anon,authenticated;
