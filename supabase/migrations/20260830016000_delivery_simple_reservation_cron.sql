-- Gestão Delivery Simples: libera reservas vencidas automaticamente no próprio banco.
-- A rotina roda a cada 5 minutos e não depende do painel da loja estar aberto.

create extension if not exists pg_cron;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname = 'delivery-simple-expire-stock-reservations'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'delivery-simple-expire-stock-reservations',
  '*/5 * * * *',
  $cron$select public.delivery_simple_expire_stock_reservations();$cron$
);

comment on function public.delivery_simple_expire_stock_reservations() is
  'Libera reservas de estoque vencidas; executada automaticamente a cada 5 minutos via pg_cron.';