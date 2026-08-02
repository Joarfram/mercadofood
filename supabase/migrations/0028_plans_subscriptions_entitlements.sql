-- MercadoFood: matriz oficial de planos, assinaturas, limites e módulos adicionais.
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('basic','professional','premium')),
  name text not null,
  promise text not null,
  user_limit integer not null check (user_limit > 0),
  branch_limit integer not null check (branch_limit > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default true,
  unique(plan_id, module_key)
);

create table if not exists public.company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','suspended','canceled')),
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz not null default now(),
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_addons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  addon_code text not null check (addon_code in ('online_payments','whatsapp_automation','impulsiona','creative_ai','extra_branch','extra_users')),
  status text not null default 'active' check (status in ('active','past_due','canceled')),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, addon_code)
);

insert into public.subscription_plans(code,name,promise,user_limit,branch_limit) values
  ('basic','Básico','Vender',2,1),
  ('professional','Profissional','Operar',6,1),
  ('premium','Premium','Crescer',15,3)
on conflict(code) do update set name=excluded.name,promise=excluded.promise,user_limit=excluded.user_limit,branch_limit=excluded.branch_limit,updated_at=now();

with matrix(plan_code,module_key) as (values
  ('basic','dashboard'),('basic','orders'),('basic','products'),('basic','promotions'),('basic','settings'),
  ('professional','dashboard'),('professional','orders'),('professional','products'),('professional','kitchen'),('professional','delivery'),('professional','payments'),('professional','finance'),('professional','reports'),('professional','customers'),('professional','promotions'),('professional','tables'),('professional','settings'),('professional','team'),
  ('premium','dashboard'),('premium','orders'),('premium','products'),('premium','kitchen'),('premium','delivery'),('premium','payments'),('premium','finance'),('premium','reports'),('premium','stock'),('premium','customers'),('premium','promotions'),('premium','tables'),('premium','settings'),('premium','team')
)
insert into public.plan_entitlements(plan_id,module_key)
select p.id,m.module_key from matrix m join public.subscription_plans p on p.code=m.plan_code
on conflict(plan_id,module_key) do update set enabled=true;

-- Preserva todas as empresas que já participam do piloto sem bloquear recursos.
insert into public.company_subscriptions(company_id,plan_id,status)
select c.id,p.id,'active' from public.companies c cross join public.subscription_plans p
where p.code='premium' on conflict(company_id) do nothing;

create or replace function public.assign_default_company_subscription()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.company_subscriptions(company_id,plan_id,status,trial_ends_at)
  select new.id,id,'trialing',now()+interval '14 days' from public.subscription_plans where code='basic'
  on conflict(company_id) do nothing;
  return new;
end; $$;

drop trigger if exists companies_default_subscription on public.companies;
create trigger companies_default_subscription after insert on public.companies
for each row execute function public.assign_default_company_subscription();

alter table public.subscription_plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.company_subscriptions enable row level security;
alter table public.subscription_addons enable row level security;

create policy "authenticated read plans" on public.subscription_plans for select to authenticated using (is_active=true);
create policy "authenticated read plan entitlements" on public.plan_entitlements for select to authenticated using (true);
create policy "company reads own subscription" on public.company_subscriptions for select to authenticated using (public.current_company_role(company_id) is not null);
create policy "company reads own addons" on public.subscription_addons for select to authenticated using (public.current_company_role(company_id) is not null);

create or replace function public.company_plan_allows(target_company uuid, requested_module text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(exists(
    select 1 from public.company_subscriptions s
    join public.plan_entitlements e on e.plan_id=s.plan_id and e.enabled=true
    where s.company_id=target_company and s.status in ('trialing','active') and e.module_key=requested_module
  ),false);
$$;
grant execute on function public.company_plan_allows(uuid,text) to authenticated;
