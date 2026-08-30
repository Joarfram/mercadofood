-- Gestão Delivery Simples: valida o checkout final depois de preço por peso, cupom e zona.
-- Garante retirada sem taxa, endereço obrigatório no delivery, mínimo por região
-- e formas de pagamento aceitas pelo plano simples.

create or replace function public.delivery_simple_validate_public_checkout(
  p_order_id uuid,
  p_public_code text,
  p_zone_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_company public.companies%rowtype;
  v_zone public.delivery_zones%rowtype;
  v_address jsonb;
  v_minimum numeric := 0;
  v_total numeric;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
    and public_code = p_public_code
    and channel = 'public_menu'
    and created_at >= now() - interval '15 minutes'
  for update;

  if not found then
    raise exception 'Pedido público inválido ou expirado para validação.';
  end if;

  select * into v_company from public.companies where id = v_order.company_id;
  if not found then raise exception 'Empresa do pedido não encontrada.'; end if;

  if v_order.service_type not in ('delivery','pickup') then
    raise exception 'Tipo de atendimento inválido.';
  end if;

  if v_order.payment_method not in ('pix','cash','card_on_delivery') then
    raise exception 'Forma de pagamento não disponível neste plano.';
  end if;

  if v_order.service_type = 'pickup' then
    if coalesce(v_order.delivery_fee,0) <> 0 then
      update public.orders
      set delivery_fee = 0,
          total = greatest(0, round(coalesce(subtotal,0) - coalesce(discount_amount,0),2)),
          updated_at = now()
      where id = v_order.id;

      update public.order_payments
      set amount = greatest(0, round(coalesce(v_order.subtotal,0) - coalesce(v_order.discount_amount,0),2)),
          updated_at = now()
      where order_id = v_order.id and status = 'pending';

      select * into v_order from public.orders where id = p_order_id;
    end if;

    return jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'public_code', v_order.public_code,
      'subtotal', v_order.subtotal,
      'discount_amount', v_order.discount_amount,
      'delivery_fee', 0,
      'total', v_order.total,
      'service_type', v_order.service_type,
      'payment_method', v_order.payment_method
    );
  end if;

  if coalesce(v_company.delivery_enabled,true) = false then
    raise exception 'A loja não está recebendo pedidos para entrega.';
  end if;

  v_address := coalesce(v_order.delivery_address,'{}'::jsonb);
  if nullif(trim(v_address->>'street'),'') is null
     or nullif(trim(v_address->>'number'),'') is null
     or nullif(trim(v_address->>'neighborhood'),'') is null
     or nullif(trim(v_address->>'city'),'') is null then
    raise exception 'Informe rua, número, bairro e cidade para entrega.';
  end if;

  if p_zone_id is not null then
    select * into v_zone
    from public.delivery_zones
    where id = p_zone_id
      and company_id = v_order.company_id
      and is_active = true;

    if not found then raise exception 'A região de entrega selecionada não está disponível.'; end if;

    v_minimum := greatest(coalesce(v_company.delivery_minimum,0), coalesce(v_zone.minimum_order,0));

    if coalesce(v_order.delivery_fee,0) <> coalesce(v_zone.delivery_fee,0) then
      raise exception 'A taxa de entrega não corresponde à região selecionada.';
    end if;
  else
    if exists (
      select 1 from public.delivery_zones
      where company_id = v_order.company_id and is_active = true
    ) then
      raise exception 'Selecione uma região atendida pela loja.';
    end if;
    v_minimum := coalesce(v_company.delivery_minimum,0);
  end if;

  if coalesce(v_order.subtotal,0) < v_minimum then
    raise exception 'O pedido mínimo para esta entrega é R$ %.', to_char(v_minimum,'FM999999990D00');
  end if;

  v_total := greatest(0, round(coalesce(v_order.subtotal,0) - coalesce(v_order.discount_amount,0) + coalesce(v_order.delivery_fee,0),2));
  if coalesce(v_order.total,0) <> v_total then
    update public.orders set total=v_total, updated_at=now() where id=v_order.id;
    update public.order_payments set amount=v_total, updated_at=now()
      where order_id=v_order.id and status='pending';
    v_order.total := v_total;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'public_code', v_order.public_code,
    'subtotal', v_order.subtotal,
    'discount_amount', v_order.discount_amount,
    'delivery_fee', v_order.delivery_fee,
    'total', v_order.total,
    'service_type', v_order.service_type,
    'payment_method', v_order.payment_method
  );
end;
$$;

revoke all on function public.delivery_simple_validate_public_checkout(uuid,text,uuid) from public;
grant execute on function public.delivery_simple_validate_public_checkout(uuid,text,uuid) to anon, authenticated;

comment on function public.delivery_simple_validate_public_checkout(uuid,text,uuid) is
  'Valida o checkout final da Gestão Delivery Simples após preço, cupom e taxa de entrega.';
