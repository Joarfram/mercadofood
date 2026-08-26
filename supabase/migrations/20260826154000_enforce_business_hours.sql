-- Faz o cardápio público e o checkout respeitarem os horários da empresa.

create or replace function public.is_company_open_now(p_company_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  with local_clock as (
    select
      (current_timestamp at time zone 'America/Sao_Paulo')::time as local_time,
      extract(dow from current_timestamp at time zone 'America/Sao_Paulo')::integer as local_weekday
  ), schedule_state as (
    select
      count(*) as configured_days,
      coalesce(bool_or(
        h.is_open
        and h.opens_at is not null
        and h.closes_at is not null
        and (
          (
            h.weekday = clock.local_weekday
            and (
              h.opens_at = h.closes_at
              or (h.opens_at < h.closes_at and clock.local_time >= h.opens_at and clock.local_time < h.closes_at)
              or (h.opens_at > h.closes_at and clock.local_time >= h.opens_at)
            )
          )
          or (
            h.weekday = ((clock.local_weekday + 6) % 7)
            and h.opens_at > h.closes_at
            and clock.local_time < h.closes_at
          )
        )
      ), false) as scheduled_open
    from public.business_hours h
    cross join local_clock clock
    where h.company_id = p_company_id
  )
  select
    exists (
      select 1
      from public.branches b
      where b.company_id = p_company_id
        and b.is_open = true
    )
    and case
      when schedule_state.configured_days = 0 then true
      else schedule_state.scheduled_open
    end
  from schedule_state;
$$;

revoke all on function public.is_company_open_now(uuid) from public, anon, authenticated;

-- Mantém o JSON público atual e troca somente a origem do status aberto/fechado.
do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(p.oid)
  into function_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_public_menu'
    and pg_get_function_identity_arguments(p.oid) = 'p_slug text';

  if function_definition is null then
    raise exception 'A função public.get_public_menu(text) não foi encontrada.';
  end if;

  function_definition := replace(
    function_definition,
    'coalesce((select bool_or(b.is_open) from branches b where b.company_id = c.id), false)',
    'public.is_company_open_now(c.id)'
  );

  if position('public.is_company_open_now(c.id)' in function_definition) = 0 then
    raise exception 'Não foi possível atualizar a regra de funcionamento em get_public_menu.';
  end if;

  execute function_definition;
end;
$migration$;

create or replace function public.enforce_public_order_business_hours()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.channel = 'public_menu' and not public.is_company_open_now(new.company_id) then
    raise exception 'A loja está fechada no momento. Consulte o horário de funcionamento e tente novamente quando ela abrir.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_public_order_business_hours() from public, anon, authenticated;

drop trigger if exists enforce_public_order_business_hours on public.orders;
create trigger enforce_public_order_business_hours
before insert on public.orders
for each row
execute function public.enforce_public_order_business_hours();

