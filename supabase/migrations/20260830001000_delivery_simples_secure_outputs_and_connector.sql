-- Protege a criação das saídas do pedido público e liga o Conector MercadoFood
-- à nova fila de impressão da Gestão Delivery Simples.

revoke all on function public.delivery_simple_queue_order_outputs(uuid) from anon, authenticated;

create or replace function public.delivery_simple_queue_public_order_outputs(
  p_order_id uuid,
  p_public_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
begin
  select exists(
    select 1 from public.orders o
    where o.id = p_order_id
      and o.public_code = p_public_code
      and o.channel = 'public_menu'
      and o.created_at >= now() - interval '15 minutes'
  ) into v_valid;

  if not v_valid then
    raise exception 'Pedido público inválido ou expirado para notificações.';
  end if;

  return public.delivery_simple_queue_order_outputs(p_order_id);
end;
$$;

revoke all on function public.delivery_simple_queue_public_order_outputs(uuid,text) from public;
grant execute on function public.delivery_simple_queue_public_order_outputs(uuid,text) to anon, authenticated;

-- Evita enfileirar duas vezes o mesmo aviso de novo pedido para a loja.
create unique index if not exists whatsapp_notifications_order_store_template_uidx
  on public.whatsapp_notifications(order_id, recipient_type, template_key)
  where order_id is not null and recipient_type = 'store';

create or replace function public.claim_delivery_simple_print_job(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_printer public.thermal_printers%rowtype;
  v_job public.delivery_simple_print_jobs%rowtype;
  v_hash text;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_printer
  from public.thermal_printers
  where connector_token_hash = v_hash
    and status = 'active'
  limit 1;

  if not found then return null; end if;

  select * into v_job
  from public.delivery_simple_print_jobs
  where printer_id = v_printer.id
    and company_id = v_printer.company_id
    and status in ('queued','failed')
    and attempts < 5
  order by created_at
  limit 1
  for update skip locked;

  if not found then return null; end if;

  update public.delivery_simple_print_jobs
  set status = 'printing', attempts = attempts + 1, error_message = null, updated_at = now()
  where id = v_job.id;

  return jsonb_build_object(
    'job_id', v_job.id,
    'printer_name', v_printer.windows_printer_name,
    'copies', greatest(1, coalesce(v_printer.copies,1)),
    'payload', v_job.payload
  );
end;
$$;

create or replace function public.finish_delivery_simple_print_job(
  p_token text,
  p_job_id uuid,
  p_success boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_printer_id uuid;
begin
  if p_token is null or length(p_token) < 32 then return false; end if;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select id into v_printer_id
  from public.thermal_printers
  where connector_token_hash = v_hash
  limit 1;
  if v_printer_id is null then return false; end if;

  update public.delivery_simple_print_jobs
  set status = case when p_success then 'printed' else 'failed' end,
      error_message = case when p_success then null else left(coalesce(p_error,'Falha de impressão'),1000) end,
      printed_at = case when p_success then now() else printed_at end,
      updated_at = now()
  where id = p_job_id and printer_id = v_printer_id and status = 'printing';

  if p_success then
    update public.thermal_printers set last_print_at = now(), updated_at = now() where id = v_printer_id;
  end if;

  return found;
end;
$$;

revoke all on function public.claim_delivery_simple_print_job(text) from public;
revoke all on function public.finish_delivery_simple_print_job(text,uuid,boolean,text) from public;
grant execute on function public.claim_delivery_simple_print_job(text) to anon;
grant execute on function public.finish_delivery_simple_print_job(text,uuid,boolean,text) to anon;

comment on function public.claim_delivery_simple_print_job(text) is 'Entrega ao Conector MercadoFood o próximo trabalho autorizado por token.';
comment on function public.finish_delivery_simple_print_job(text,uuid,boolean,text) is 'Confirma sucesso/falha de impressão do Conector MercadoFood.';