-- Gestão Delivery Simples: fila de saída do novo pedido para WhatsApp da loja e impressão automática.

alter table public.whatsapp_notifications
  add column if not exists order_id uuid references public.orders(id) on delete cascade;

alter table public.whatsapp_notifications
  drop constraint if exists whatsapp_notifications_recipient_type_check;

alter table public.whatsapp_notifications
  add constraint whatsapp_notifications_recipient_type_check
  check (recipient_type in ('driver','customer','store'));

alter table public.whatsapp_integrations
  add column if not exists order_notifications_enabled boolean not null default false,
  add column if not exists order_notification_phone text;

create table if not exists public.delivery_simple_print_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  printer_id uuid not null references public.thermal_printers(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','printing','printed','failed','cancelled')),
  attempts integer not null default 0,
  error_message text,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, printer_id)
);

create index if not exists delivery_simple_print_jobs_company_status_idx
  on public.delivery_simple_print_jobs(company_id, status, created_at);

alter table public.delivery_simple_print_jobs enable row level security;

drop policy if exists "company members read delivery simple print jobs" on public.delivery_simple_print_jobs;
create policy "company members read delivery simple print jobs"
on public.delivery_simple_print_jobs for select to authenticated
using (public.is_company_member(company_id));

create or replace function public.delivery_simple_queue_order_outputs(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_company public.companies%rowtype;
  v_integration public.whatsapp_integrations%rowtype;
  v_item record;
  v_items_text text := '';
  v_measure text;
  v_message text;
  v_print_payload jsonb;
  v_whatsapp_queued boolean := false;
  v_print_jobs integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'Pedido não encontrado.'; end if;

  select * into v_company from public.companies where id = v_order.company_id;

  for v_item in
    select oi.product_name, oi.quantity, oi.sale_quantity, oi.sale_unit, oi.selling_mode, oi.total_price
    from public.order_items oi
    where oi.order_id = v_order.id
    order by oi.created_at, oi.id
  loop
    v_measure := case
      when v_item.selling_mode = 'unit' then v_item.quantity::text || ' un'
      when v_item.quantity > 1 then v_item.quantity::text || ' x ' || trim(to_char(v_item.sale_quantity, 'FM999999990.###')) || ' ' || v_item.sale_unit
      else trim(to_char(v_item.sale_quantity, 'FM999999990.###')) || ' ' || v_item.sale_unit
    end;
    v_items_text := v_items_text || E'\n- ' || v_item.product_name || ' | ' || v_measure || ' | R$ ' || replace(to_char(v_item.total_price, 'FM999999990.00'), '.', ',');
  end loop;

  v_message := 'NOVO PEDIDO MERCADOFOOD #' || v_order.order_number || E'\n'
    || 'Cliente: ' || coalesce(v_order.customer_name, 'Não informado') || E'\n'
    || 'Telefone: ' || coalesce(v_order.customer_phone, 'Não informado') || E'\n\nPedido:' || v_items_text || E'\n\n'
    || 'Subtotal: R$ ' || replace(to_char(v_order.subtotal, 'FM999999990.00'), '.', ',') || E'\n'
    || case when coalesce(v_order.delivery_fee,0) > 0 then 'Taxa de entrega: R$ ' || replace(to_char(v_order.delivery_fee, 'FM999999990.00'), '.', ',') || E'\n' else '' end
    || 'Total: R$ ' || replace(to_char(v_order.total, 'FM999999990.00'), '.', ',') || E'\n'
    || 'Atendimento: ' || case when v_order.service_type = 'delivery' then 'Entrega' else 'Retirada' end || E'\n'
    || 'Pagamento: ' || upper(coalesce(v_order.payment_method, 'não informado')) || E'\n'
    || 'Status: aguardando pagamento';

  select * into v_integration
  from public.whatsapp_integrations
  where company_id = v_order.company_id
  limit 1;

  if found and coalesce(v_integration.order_notifications_enabled,false)
     and nullif(regexp_replace(coalesce(v_integration.order_notification_phone,''), '\D','','g'),'') is not null then
    insert into public.whatsapp_notifications(
      company_id, order_id, recipient_type, recipient_name, recipient_phone,
      template_key, message_body, metadata
    ) values (
      v_order.company_id, v_order.id, 'store', v_company.name,
      regexp_replace(v_integration.order_notification_phone, '\D','','g'),
      'new_order_store', v_message,
      jsonb_build_object('order_number',v_order.order_number,'service_type',v_order.service_type)
    )
    on conflict do nothing;
    v_whatsapp_queued := true;
  end if;

  v_print_payload := jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'company_name', v_company.name,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone,
    'service_type', v_order.service_type,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'delivery_address', v_order.delivery_address,
    'subtotal', v_order.subtotal,
    'delivery_fee', v_order.delivery_fee,
    'total', v_order.total,
    'notes', v_order.notes,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'sale_quantity', oi.sale_quantity,
        'sale_unit', oi.sale_unit,
        'selling_mode', oi.selling_mode,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price,
        'notes', oi.notes
      ) order by oi.created_at, oi.id), '[]'::jsonb)
      from public.order_items oi where oi.order_id = v_order.id
    )
  );

  insert into public.delivery_simple_print_jobs(company_id, order_id, printer_id, payload)
  select v_order.company_id, v_order.id, tp.id, v_print_payload
  from public.thermal_printers tp
  where tp.company_id = v_order.company_id
    and tp.status = 'active'
    and tp.auto_print = true
  on conflict(order_id, printer_id) do nothing;

  get diagnostics v_print_jobs = row_count;

  return jsonb_build_object('whatsapp_queued',v_whatsapp_queued,'print_jobs',v_print_jobs);
end;
$$;

revoke all on function public.delivery_simple_queue_order_outputs(uuid) from public;
grant execute on function public.delivery_simple_queue_order_outputs(uuid) to anon, authenticated;

comment on function public.delivery_simple_queue_order_outputs(uuid) is
  'Enfileira notificação da loja e impressão automática do pedido da Gestão Delivery Simples.';