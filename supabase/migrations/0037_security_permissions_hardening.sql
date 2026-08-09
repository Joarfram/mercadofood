-- MercadoFood v2.8: endurecimento de privilegios e autorizacao operacional.
-- Aplicar somente depois de backup e validacao em staging.

-- PostgreSQL concede EXECUTE a PUBLIC por padrao. Revogamos esse acesso de
-- todas as funcoes SECURITY DEFINER do schema exposto e reabrimos somente os
-- contratos publicos/autenticados listados explicitamente abaixo.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public', fn.signature);
    execute format('revoke all on function %s from anon', fn.signature);
  end loop;
end $$;

-- APIs realmente publicas do cardapio, checkout, mesa e rastreamento.
grant execute on function public.get_public_menu(text) to anon, authenticated;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;
grant execute on function public.get_public_combos(uuid) to anon, authenticated;
grant execute on function public.create_public_combo_order(jsonb) to anon, authenticated;
grant execute on function public.get_public_table_context(text) to anon, authenticated;
grant execute on function public.create_table_qr_order(text,text,text,jsonb,text) to anon, authenticated;
grant execute on function public.get_public_delivery_tracking(text) to anon, authenticated;
grant execute on function public.get_public_delivery_zones(text) to anon, authenticated;
grant execute on function public.has_public_combos(text) to anon, authenticated;
grant execute on function public.get_public_service_config(text) to anon, authenticated;
grant execute on function public.apply_public_order_delivery_zone(uuid,uuid) to anon, authenticated;
grant execute on function public.preview_public_coupon(text,text,numeric) to anon, authenticated;
grant execute on function public.submit_public_feedback(text,text,text,text,integer,text) to anon, authenticated;
grant execute on function public.get_company_invite(uuid) to anon, authenticated;

-- Contratos que exigem uma sessao autenticada.
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.current_company_role(uuid) to authenticated;
grant execute on function public.has_company_role(uuid,text[]) to authenticated;
grant execute on function public.can_access_module(uuid,text) to authenticated;
grant execute on function public.company_plan_allows(uuid,text) to authenticated;
grant execute on function public.accept_company_invite(uuid,text,text) to authenticated;
grant execute on function public.media_entity_belongs_to_company(uuid,text,uuid) to authenticated;
grant execute on function public.update_own_driver_payout_profile(text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.create_driver_payout(uuid) to authenticated;
grant execute on function public.mark_driver_payout_paid(uuid,text) to authenticated;
grant execute on function public.confirm_own_driver_payout(uuid) to authenticated;
grant execute on function public.cancel_driver_payout(uuid) to authenticated;

-- As politicas antigas separavam empresas, mas davam CRUD completo a qualquer
-- membro. As novas politicas tambem exigem a permissao funcional apropriada.
drop policy if exists "company orders" on public.orders;
drop policy if exists "company order items" on public.order_items;
drop policy if exists "company order payments" on public.order_payments;

create policy "authorized roles read orders" on public.orders
for select to authenticated using (
  public.can_access_module(company_id,'orders')
  or public.can_access_module(company_id,'kitchen')
  or public.can_access_module(company_id,'delivery')
  or public.can_access_module(company_id,'payments')
  or public.can_access_module(company_id,'finance')
  or public.can_access_module(company_id,'reports')
);

create policy "authorized roles create orders" on public.orders
for insert to authenticated with check (public.can_access_module(company_id,'orders'));

create policy "authorized roles update orders" on public.orders
for update to authenticated using (
  public.can_access_module(company_id,'orders')
  or public.can_access_module(company_id,'kitchen')
  or public.can_access_module(company_id,'delivery')
  or public.can_access_module(company_id,'payments')
) with check (
  public.can_access_module(company_id,'orders')
  or public.can_access_module(company_id,'kitchen')
  or public.can_access_module(company_id,'delivery')
  or public.can_access_module(company_id,'payments')
);

create policy "owners delete orders" on public.orders
for delete to authenticated using (public.has_company_role(company_id,array['owner']));

create policy "authorized roles read order items" on public.order_items
for select to authenticated using (
  public.can_access_module(company_id,'orders')
  or public.can_access_module(company_id,'kitchen')
  or public.can_access_module(company_id,'delivery')
  or public.can_access_module(company_id,'payments')
  or public.can_access_module(company_id,'finance')
  or public.can_access_module(company_id,'reports')
);

create policy "authorized roles create order items" on public.order_items
for insert to authenticated with check (public.can_access_module(company_id,'orders'));

create policy "authorized roles update order items" on public.order_items
for update to authenticated using (
  public.can_access_module(company_id,'orders') or public.can_access_module(company_id,'kitchen')
) with check (
  public.can_access_module(company_id,'orders') or public.can_access_module(company_id,'kitchen')
);

create policy "owners delete order items" on public.order_items
for delete to authenticated using (public.has_company_role(company_id,array['owner']));

create policy "authorized roles read order payments" on public.order_payments
for select to authenticated using (
  public.can_access_module(company_id,'payments')
  or public.can_access_module(company_id,'finance')
  or public.can_access_module(company_id,'reports')
  or public.can_access_module(company_id,'orders')
);

create policy "authorized roles create order payments" on public.order_payments
for insert to authenticated with check (
  public.can_access_module(company_id,'payments')
  or public.can_access_module(company_id,'finance')
  or public.can_access_module(company_id,'orders')
);

create policy "authorized roles update order payments" on public.order_payments
for update to authenticated using (
  public.can_access_module(company_id,'payments') or public.can_access_module(company_id,'finance')
) with check (
  public.can_access_module(company_id,'payments') or public.can_access_module(company_id,'finance')
);

create policy "owners delete order payments" on public.order_payments
for delete to authenticated using (public.has_company_role(company_id,array['owner']));

comment on policy "authorized roles update orders" on public.orders is
'Isolamento multiempresa com autorizacao operacional no banco; a interface nao e a barreira de seguranca.';
