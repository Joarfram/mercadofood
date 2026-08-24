alter table public.subscription_plans
  add column if not exists description text,
  add column if not exists monthly_price numeric(12,2),
  add column if not exists annual_monthly_price numeric(12,2),
  add column if not exists visibility text not null default 'public',
  add column if not exists trial_days integer not null default 14,
  add column if not exists product_limit integer,
  add column if not exists order_limit integer;

alter table public.subscription_plans drop constraint if exists subscription_plans_code_check;
alter table public.subscription_plans drop constraint if exists subscription_plans_visibility_check;
alter table public.subscription_plans add constraint subscription_plans_visibility_check check (visibility in ('public','hidden','internal'));
alter table public.subscription_plans drop constraint if exists subscription_plans_trial_days_check;
alter table public.subscription_plans add constraint subscription_plans_trial_days_check check (trial_days >= 0);
alter table public.subscription_plans drop constraint if exists subscription_plans_product_limit_check;
alter table public.subscription_plans add constraint subscription_plans_product_limit_check check (product_limit is null or product_limit >= 0);
alter table public.subscription_plans drop constraint if exists subscription_plans_order_limit_check;
alter table public.subscription_plans add constraint subscription_plans_order_limit_check check (order_limit is null or order_limit >= 0);

update public.subscription_plans set
  description=case code when 'basic' then 'Para colocar o cardápio online e começar a receber pedidos.' when 'professional' then 'Para organizar equipe, cozinha, salão e entregas.' when 'premium' then 'Para controlar custos, estoque, unidades e decisões de crescimento.' else description end,
  monthly_price=case code when 'basic' then 75 when 'professional' then 150 when 'premium' then 225 else monthly_price end,
  annual_monthly_price=case code when 'basic' then 49.90 when 'professional' then 99.90 when 'premium' then 149.90 else annual_monthly_price end
where code in ('basic','professional','premium');

insert into public.subscription_plans(code,name,promise,description,user_limit,branch_limit,is_active,visibility,trial_days,monthly_price)
values ('delivery-simples','Gestão Delivery Simples','Gerenciar delivery','Gestão essencial de cardápio, produtos, pedidos, clientes, delivery e retirada.',2,1,true,'hidden',14,null)
on conflict(code) do update set name=excluded.name,promise=excluded.promise,description=excluded.description,visibility='hidden',updated_at=now();

alter table public.plan_entitlements
  add column if not exists config jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

with feature_matrix(module_key,enabled) as (values
  ('dashboard',true),('orders',true),('products',true),('customers',true),('delivery',true),('payments',true),('messages',true),('settings',true),
  ('kitchen',false),('stock',false),('finance',false),('drivers',false),('team',false),('marketing',false),('reports',false),('tables',false),('promotions',false)
)
insert into public.plan_entitlements(plan_id,module_key,enabled)
select p.id,m.module_key,m.enabled from feature_matrix m join public.subscription_plans p on p.code='delivery-simples'
on conflict(plan_id,module_key) do update set enabled=excluded.enabled,updated_at=now();

insert into public.plan_entitlements(plan_id,module_key,enabled)
select id,'drivers',true from public.subscription_plans where code in ('professional','premium')
on conflict(plan_id,module_key) do update set enabled=true,updated_at=now();

create index if not exists plan_entitlements_plan_enabled_idx on public.plan_entitlements(plan_id,module_key) where enabled;
create index if not exists company_subscriptions_plan_idx on public.company_subscriptions(plan_id);

drop policy if exists "authenticated read plans" on public.subscription_plans;
create policy "authenticated read visible or assigned plans" on public.subscription_plans for select to authenticated using (
  is_active and (visibility='public' or exists(select 1 from public.company_subscriptions s where s.plan_id=subscription_plans.id and public.current_company_role(s.company_id) is not null))
);
drop policy if exists "authenticated read plan entitlements" on public.plan_entitlements;
create policy "companies read relevant plan entitlements" on public.plan_entitlements for select to authenticated using (
  exists(select 1 from public.company_subscriptions s where s.plan_id=plan_entitlements.plan_id and public.current_company_role(s.company_id) is not null)
);

revoke insert,update,delete on public.subscription_plans from anon,authenticated;
revoke insert,update,delete on public.plan_entitlements from anon,authenticated;
revoke insert,update,delete on public.company_subscriptions from anon,authenticated;
revoke insert,update,delete on public.company_entitlement_overrides from anon,authenticated;

create or replace function public.company_plan_allows(target_company uuid, requested_module text)
returns boolean language sql stable security definer set search_path='' as $$
  select case when public.current_company_role(target_company) is null then false else coalesce(
    (select o.enabled from public.company_entitlement_overrides o where o.company_id=target_company and o.module_key=requested_module),
    (select e.enabled from public.company_subscriptions s join public.plan_entitlements e on e.plan_id=s.plan_id
      where s.company_id=target_company and s.status in ('trialing','active')
        and (s.status<>'trialing' or s.trial_ends_at is null or s.trial_ends_at>now()) and e.module_key=requested_module),
    false) end;
$$;
revoke all on function public.company_plan_allows(uuid,text) from public,anon;
grant execute on function public.company_plan_allows(uuid,text) to authenticated;

-- Defesa em profundidade: acesso direto pela Data API também respeita o plano.
drop policy if exists "authorized roles read drivers" on public.drivers;
drop policy if exists "authorized roles manage drivers" on public.drivers;
create policy "plan and role read drivers" on public.drivers for select to authenticated using (
  public.can_access_module(company_id,'delivery') and public.company_plan_allows(company_id,'drivers')
);
create policy "plan and role manage drivers" on public.drivers for all to authenticated using (
  public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'drivers')
) with check (
  public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'drivers')
);

drop policy if exists "authorized roles read deliveries" on public.deliveries;
drop policy if exists "authorized roles manage deliveries" on public.deliveries;
create policy "plan and role read deliveries" on public.deliveries for select to authenticated using (
  public.can_access_module(company_id,'delivery') and public.company_plan_allows(company_id,'delivery')
);
create policy "plan and role manage deliveries" on public.deliveries for all to authenticated using (
  public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'delivery')
) with check (
  public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'delivery')
);

comment on column public.subscription_plans.visibility is 'public: comercial; hidden: somente Master; internal: testes internos.';
comment on column public.plan_entitlements.config is 'Limites e configuração específica do recurso no plano.';

