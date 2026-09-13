-- MercadoFood: matriz de planos v2.
-- Separa estoque simples de produto acabado das funções Premium de insumos,
-- ficha técnica, custos e relatórios multiunidade.

insert into public.plan_entitlements (plan_id, module_key, enabled)
select p.id, x.module_key, x.enabled
from public.subscription_plans p
join (
  values
    ('basic', 'stock_basic', false),
    ('basic', 'stock_advanced', false),
    ('basic', 'recipes', false),
    ('basic', 'costs', false),
    ('basic', 'multiunit_reports', false),

    ('professional', 'stock_basic', true),
    ('professional', 'stock_advanced', false),
    ('professional', 'recipes', false),
    ('professional', 'costs', false),
    ('professional', 'multiunit_reports', false),

    ('premium', 'stock_basic', true),
    ('premium', 'stock_advanced', true),
    ('premium', 'recipes', true),
    ('premium', 'costs', true),
    ('premium', 'multiunit_reports', true),

    ('delivery-simples', 'stock_basic', false),
    ('delivery-simples', 'stock_advanced', false),
    ('delivery-simples', 'recipes', false),
    ('delivery-simples', 'costs', false),
    ('delivery-simples', 'multiunit_reports', false)
) as x(plan_code, module_key, enabled)
  on x.plan_code = p.code
on conflict (plan_id, module_key)
do update set enabled = excluded.enabled;

create or replace function public.can_access_module(target_company uuid, module_name text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare r text;
begin
  r := public.current_company_role(target_company);
  if r is null then return false; end if;
  if r in ('owner','manager') then return true; end if;

  return case module_name
    when 'dashboard' then r in ('attendant','kitchen','cashier','stock','viewer')
    when 'orders' then r in ('attendant','kitchen','cashier')
    when 'products' then r in ('stock')
    when 'kitchen' then r in ('kitchen','attendant')
    when 'delivery' then r in ('attendant','driver')
    when 'drivers' then r in ('driver','attendant')
    when 'payments' then r in ('cashier','attendant')
    when 'finance' then r in ('cashier')
    when 'reports' then r in ('viewer','cashier')
    when 'stock' then r in ('stock')
    when 'stock_basic' then r in ('stock')
    when 'stock_advanced' then r in ('stock')
    when 'recipes' then r in ('stock')
    when 'costs' then r in ('stock')
    when 'multiunit_reports' then r in ('viewer')
    when 'customers' then r in ('attendant')
    when 'promotions' then false
    when 'marketing' then false
    when 'messages' then r in ('attendant')
    when 'tables' then r in ('attendant')
    when 'settings' then false
    when 'team' then false
    else false
  end;
end;
$$;

revoke all on function public.can_access_module(uuid,text) from public, anon;
grant execute on function public.can_access_module(uuid,text) to authenticated;
