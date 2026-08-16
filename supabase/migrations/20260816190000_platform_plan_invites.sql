create table if not exists public.platform_plan_invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  email text not null,
  company_name text not null,
  responsible_name text,
  whatsapp text,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'pending' check (status in ('pending','accepted','expired','canceled')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  company_id uuid references public.companies(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_plan_invites_status_idx on public.platform_plan_invites(status, created_at desc);
alter table public.platform_plan_invites enable row level security;
revoke all on public.platform_plan_invites from anon, authenticated;

create or replace function public.get_platform_plan_invite(invite_token uuid)
returns table(company_name text, responsible_name text, email text, whatsapp text, plan_code text, plan_name text, expires_at timestamptz, status text, valid boolean)
language sql stable security definer set search_path = public
as $$
  select i.company_name,i.responsible_name,i.email,i.whatsapp,p.code,p.name,i.expires_at,
    case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,
    (i.status='pending' and i.accepted_at is null and i.expires_at>now())
  from public.platform_plan_invites i join public.subscription_plans p on p.id=i.plan_id
  where i.token=invite_token limit 1
$$;

create or replace function public.accept_platform_plan_invite(invite_token uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare i public.platform_plan_invites%rowtype; auth_email text; new_company uuid; company_slug text;
begin
  if auth.uid() is null then raise exception 'Faça login para aceitar o convite.'; end if;
  select email into auth_email from auth.users where id=auth.uid();
  select * into i from public.platform_plan_invites where token=invite_token for update;
  if i.id is null then raise exception 'Convite não encontrado.'; end if;
  if i.status<>'pending' or i.accepted_at is not null then raise exception 'Convite já utilizado ou cancelado.'; end if;
  if i.expires_at<=now() then update public.platform_plan_invites set status='expired',updated_at=now() where id=i.id; raise exception 'Convite expirado.'; end if;
  if lower(i.email)<>lower(auth_email) then raise exception 'Entre com o mesmo e-mail que recebeu o convite.'; end if;
  company_slug := regexp_replace(lower(unaccent(i.company_name)),'[^a-z0-9]+','-','g')||'-'||substr(auth.uid()::text,1,8);
  insert into public.companies(name,responsible_name,email,whatsapp,phone,slug,owner_id)
    values(i.company_name,i.responsible_name,i.email,i.whatsapp,i.whatsapp,company_slug,auth.uid()) returning id into new_company;
  insert into public.company_subscriptions(company_id,plan_id,status,current_period_starts_at)
    values(new_company,i.plan_id,'active',now());
  update public.platform_plan_invites set status='accepted',accepted_at=now(),accepted_by=auth.uid(),company_id=new_company,updated_at=now() where id=i.id;
  return new_company;
end $$;

grant execute on function public.get_platform_plan_invite(uuid) to anon,authenticated;
grant execute on function public.accept_platform_plan_invite(uuid) to authenticated;
revoke all on function public.accept_platform_plan_invite(uuid) from public,anon;
