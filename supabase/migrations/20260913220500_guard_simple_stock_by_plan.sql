-- Impede novos usos do estoque simples por planos sem o entitlement stock_basic.
-- Não interfere em atualizações internas disparadas por outros triggers, preservando
-- pedidos de empresas históricas durante a transição da matriz de planos.

create or replace function public.company_subscription_entitled(target_company uuid, requested_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select o.enabled
       from public.company_entitlement_overrides o
      where o.company_id = target_company
        and o.module_key = requested_module),
    (select e.enabled
       from public.company_subscriptions s
       join public.plan_entitlements e on e.plan_id = s.plan_id
      where s.company_id = target_company
        and s.status in ('trialing','active')
        and (s.status <> 'trialing' or s.trial_ends_at is null or s.trial_ends_at > now())
        and e.module_key = requested_module),
    false
  );
$$;

revoke all on function public.company_subscription_entitled(uuid,text) from public, anon, authenticated;

create or replace function public.enforce_product_stock_entitlement()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  -- Atualizações feitas dentro de outro trigger, como a baixa automática de uma venda,
  -- continuam funcionando para dados históricos durante a migração dos planos.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.track_stock,false)
       or coalesce(new.stock_quantity,0) <> 0
       or coalesce(new.minimum_stock,0) <> 0 then
      if not public.company_subscription_entitled(new.company_id,'stock_basic') then
        raise exception 'O controle de estoque por produto exige o plano Profissional ou Premium.';
      end if;
    end if;
    return new;
  end if;

  if new.track_stock is distinct from old.track_stock
     or new.stock_quantity is distinct from old.stock_quantity
     or new.minimum_stock is distinct from old.minimum_stock then
    if not public.company_subscription_entitled(new.company_id,'stock_basic') then
      raise exception 'O controle de estoque por produto exige o plano Profissional ou Premium.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_product_stock_entitlement() from public, anon, authenticated;

drop trigger if exists trg_enforce_product_stock_entitlement on public.products;
create trigger trg_enforce_product_stock_entitlement
before insert or update of track_stock, stock_quantity, minimum_stock
on public.products
for each row
execute function public.enforce_product_stock_entitlement();
