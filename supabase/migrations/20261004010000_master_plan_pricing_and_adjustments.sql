-- Central comercial do Master. Preços do catálogo e preços contratados ficam
-- separados para que alterações futuras não reajustem clientes existentes.
alter table public.subscription_plans
  add column if not exists annual_price numeric(12,2),
  add column if not exists annual_discount_percent numeric(5,2),
  add column if not exists promotional_monthly_price numeric(12,2),
  add column if not exists promotional_annual_price numeric(12,2),
  add column if not exists promotion_starts_at timestamptz,
  add column if not exists promotion_ends_at timestamptz,
  add column if not exists display_order integer not null default 0,
  add column if not exists highlight_label text,
  add column if not exists annual_adjustment_enabled boolean not null default false,
  add column if not exists annual_adjustment_month smallint,
  add column if not exists annual_adjustment_percent numeric(5,2),
  add column if not exists annual_adjustment_mode text not null default 'manual',
  add column if not exists annual_notice_days integer not null default 30,
  add column if not exists annual_adjustment_policy text;

alter table public.subscription_plans
  drop constraint if exists subscription_plans_annual_adjustment_mode_check,
  add constraint subscription_plans_annual_adjustment_mode_check check (annual_adjustment_mode in ('manual','automatic')),
  drop constraint if exists subscription_plans_annual_adjustment_month_check,
  add constraint subscription_plans_annual_adjustment_month_check check (annual_adjustment_month is null or annual_adjustment_month between 1 and 12),
  drop constraint if exists subscription_plans_annual_notice_days_check,
  add constraint subscription_plans_annual_notice_days_check check (annual_notice_days between 0 and 365),
  drop constraint if exists subscription_plans_highlight_label_check,
  add constraint subscription_plans_highlight_label_check check (highlight_label is null or highlight_label in ('Mais escolhido','Mais popular'));

-- annual_monthly_price já existia e representa o equivalente mensal. annual_price
-- registra agora o preço total oficial do ciclo anual.
update public.subscription_plans
set annual_price = coalesce(annual_price, round(annual_monthly_price * 12, 2)),
    annual_discount_percent = coalesce(annual_discount_percent,
      case when monthly_price > 0 and annual_monthly_price is not null
        then round((1 - annual_monthly_price / monthly_price) * 100, 2) end),
    annual_adjustment_policy = coalesce(annual_adjustment_policy,
      'Os valores dos planos poderão sofrer reajuste anual, considerando a atualização dos custos operacionais, infraestrutura, hospedagem, serviços, encargos e demais despesas necessárias para manutenção e evolução da plataforma. O cliente será informado previamente sobre qualquer alteração de valor.');

alter table public.company_subscriptions
  add column if not exists billing_cycle text not null default 'monthly',
  add column if not exists contracted_price numeric(12,2),
  add column if not exists price_locked_at timestamptz;
alter table public.company_subscriptions drop constraint if exists company_subscriptions_billing_cycle_check;
alter table public.company_subscriptions add constraint company_subscriptions_billing_cycle_check check (billing_cycle in ('monthly','annual'));

-- Congela o preço hoje aplicado aos clientes legados antes de qualquer edição de plano.
update public.company_subscriptions s
set contracted_price = coalesce(s.contracted_price,
  case when s.billing_cycle='annual' then p.annual_price else p.monthly_price end),
    price_locked_at = coalesce(s.price_locked_at, now())
from public.subscription_plans p where p.id=s.plan_id;

create table if not exists public.subscription_price_adjustments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('percentage','fixed')),
  value numeric(12,2) not null,
  effective_at timestamptz not null,
  reason text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.subscription_price_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.subscription_price_adjustments(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  previous_price numeric(12,2) not null,
  new_price numeric(12,2) not null,
  applied_at timestamptz,
  unique(adjustment_id, company_id)
);
create index if not exists subscription_price_adjustment_items_company_idx on public.subscription_price_adjustment_items(company_id);

-- A visão calcula o valor vigente sem reescrever faturas, sem cobrar e sem apagar
-- o valor anterior. Uma integração de cobrança pode consultá-la no próximo ciclo.
create or replace view public.company_subscription_effective_prices with (security_invoker=true) as
select s.id as subscription_id, s.company_id, s.plan_id, s.billing_cycle,
       coalesce((select i.new_price from public.subscription_price_adjustment_items i
         join public.subscription_price_adjustments a on a.id=i.adjustment_id
         where i.company_id=s.company_id and a.effective_at<=now()
         order by a.effective_at desc, a.created_at desc limit 1), s.contracted_price) as effective_price
from public.company_subscriptions s;

alter table public.subscription_price_adjustments enable row level security;
alter table public.subscription_price_adjustment_items enable row level security;
revoke all on public.subscription_price_adjustments, public.subscription_price_adjustment_items from anon, authenticated;

