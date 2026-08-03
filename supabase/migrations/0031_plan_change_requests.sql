-- Solicitações comerciais auditáveis, sem alterar o plano antes da confirmação.
create table if not exists public.plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requested_plan text not null check (requested_plan in ('basic','professional','premium')),
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  status text not null default 'pending' check (status in ('pending','contacted','approved','rejected','canceled')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plan_change_requests_company_idx on public.plan_change_requests(company_id,created_at desc);
alter table public.plan_change_requests enable row level security;
create policy "owners read plan requests" on public.plan_change_requests for select to authenticated using (public.has_company_role(company_id,array['owner']));
create policy "owners create plan requests" on public.plan_change_requests for insert to authenticated with check (requested_by=auth.uid() and public.has_company_role(company_id,array['owner']));
grant select,insert on public.plan_change_requests to authenticated;

-- O Impulsiona é acessível em todos os planos; cada campanha/IA é cobrada à parte.
insert into public.plan_entitlements(plan_id,module_key,enabled)
select id,'marketing',true from public.subscription_plans
on conflict(plan_id,module_key) do update set enabled=true;
