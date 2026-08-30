-- Gestão Delivery Simples: torna a fila de impressão resiliente a falhas e travamentos do conector.

alter table public.delivery_simple_print_jobs
  add column if not exists claimed_at timestamptz,
  add column if not exists next_attempt_at timestamptz not null default now();

create index if not exists delivery_simple_print_jobs_retry_idx
  on public.delivery_simple_print_jobs(printer_id, status, next_attempt_at, created_at);

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

  update public.delivery_simple_print_jobs
  set status = 'failed',
      error_message = coalesce(error_message, 'Conector interrompido durante a impressão'),
      next_attempt_at = now(),
      updated_at = now()
  where printer_id = v_printer.id
    and company_id = v_printer.company_id
    and status = 'printing'
    and claimed_at < now() - interval '2 minutes';

  select * into v_job
  from public.delivery_simple_print_jobs
  where printer_id = v_printer.id
    and company_id = v_printer.company_id
    and status in ('queued','failed')
    and attempts < 5
    and next_attempt_at <= now()
  order by created_at
  limit 1
  for update skip locked;

  if not found then return null; end if;

  update public.delivery_simple_print_jobs
  set status = 'printing',
      attempts = attempts + 1,
      claimed_at = now(),
      error_message = null,
      updated_at = now()
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
  v_attempts integer;
begin
  if p_token is null or length(p_token) < 32 then return false; end if;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select id into v_printer_id
  from public.thermal_printers
  where connector_token_hash = v_hash
    and status = 'active'
  limit 1;
  if v_printer_id is null then return false; end if;

  select attempts into v_attempts
  from public.delivery_simple_print_jobs
  where id = p_job_id and printer_id = v_printer_id and status = 'printing'
  for update;
  if not found then return false; end if;

  update public.delivery_simple_print_jobs
  set status = case when p_success then 'printed' else 'failed' end,
      error_message = case when p_success then null else left(coalesce(p_error,'Falha de impressão'),1000) end,
      printed_at = case when p_success then now() else printed_at end,
      claimed_at = null,
      next_attempt_at = case
        when p_success then now()
        when v_attempts >= 5 then now()
        else now() + make_interval(secs => least(300, 15 * power(2, greatest(v_attempts - 1, 0))))
      end,
      updated_at = now()
  where id = p_job_id and printer_id = v_printer_id and status = 'printing';

  if p_success then
    update public.thermal_printers
    set last_print_at = now(), updated_at = now()
    where id = v_printer_id;
  end if;

  return found;
end;
$$;

create or replace function public.retry_delivery_simple_print_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id
  from public.delivery_simple_print_jobs
  where id = p_job_id;

  if v_company_id is null then raise exception 'Trabalho de impressão não encontrado.'; end if;
  if not public.is_company_member(v_company_id) then raise exception 'Sem permissão.'; end if;

  update public.delivery_simple_print_jobs
  set status = 'queued',
      attempts = 0,
      error_message = null,
      claimed_at = null,
      next_attempt_at = now(),
      printed_at = null,
      updated_at = now()
  where id = p_job_id
    and company_id = v_company_id
    and status in ('failed','cancelled');
end;
$$;

revoke all on function public.retry_delivery_simple_print_job(uuid) from public;
grant execute on function public.retry_delivery_simple_print_job(uuid) to authenticated;

comment on function public.retry_delivery_simple_print_job(uuid) is
  'Recoloca manualmente na fila um trabalho de impressão com falha, validando a empresa do usuário.';