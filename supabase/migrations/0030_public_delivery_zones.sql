-- Restaura bairros públicos e aplica a taxa escolhida de forma segura no servidor.
create or replace function public.get_public_delivery_zones(p_slug text)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',z.id,'name',z.name,'delivery_fee',z.delivery_fee,'minimum_order',z.minimum_order,'estimated_minutes',z.estimated_minutes) order by z.name),'[]'::jsonb)
  from delivery_zones z join companies c on c.id=z.company_id
  where c.slug=p_slug and c.status='active' and c.menu_is_active=true and z.is_active=true;
$$;
create or replace function public.has_public_combos(p_slug text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from combos x join companies c on c.id=x.company_id where c.slug=p_slug and c.status='active' and c.menu_is_active=true and x.is_active=true);
$$;
create or replace function public.get_public_service_config(p_slug text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('delivery_enabled',delivery_enabled,'pickup_enabled',pickup_enabled,'average_delivery_minutes',average_delivery_minutes)
  from companies where slug=p_slug and status='active' and menu_is_active=true;
$$;
create or replace function public.apply_public_order_delivery_zone(p_order_id uuid,p_zone_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order orders%rowtype; v_zone delivery_zones%rowtype; v_total numeric;
begin
  select * into v_order from orders where id=p_order_id and service_type='delivery' and status='new' and created_at > now()-interval '15 minutes' for update;
  if not found then raise exception 'Pedido inválido para alteração da entrega.'; end if;
  select * into v_zone from delivery_zones where id=p_zone_id and company_id=v_order.company_id and is_active=true;
  if not found then raise exception 'Bairro não atendido.'; end if;
  if v_order.subtotal < v_zone.minimum_order then raise exception 'O pedido mínimo para % é R$ %.',v_zone.name,to_char(v_zone.minimum_order,'FM999999990D00'); end if;
  v_total:=greatest(0,round(v_order.subtotal-v_order.discount_amount+v_zone.delivery_fee,2));
  update orders set delivery_fee=v_zone.delivery_fee,total=v_total,delivery_address=jsonb_set(coalesce(delivery_address,'{}'::jsonb),'{neighborhood}',to_jsonb(v_zone.name)),updated_at=now() where id=v_order.id;
  update order_payments set amount=v_total,updated_at=now() where order_id=v_order.id and status='pending';
  return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'public_code',v_order.public_code,'total',v_total);
end;$$;
grant execute on function public.get_public_delivery_zones(text),public.has_public_combos(text),public.get_public_service_config(text),public.apply_public_order_delivery_zone(uuid,uuid) to anon,authenticated;
