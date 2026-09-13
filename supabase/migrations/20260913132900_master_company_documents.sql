-- MercadoFood Master: identificação profissional de empresas por CPF/CNPJ.

alter table public.companies
  add column if not exists legal_name text,
  add column if not exists document_type text,
  add column if not exists document_number text;

alter table public.platform_plan_invites
  add column if not exists legal_name text,
  add column if not exists document_type text,
  add column if not exists document_number text;

alter table public.companies
  drop constraint if exists companies_document_type_check;
alter table public.companies
  add constraint companies_document_type_check
  check (document_type is null or document_type in ('CPF','CNPJ'));

alter table public.platform_plan_invites
  drop constraint if exists platform_plan_invites_document_type_check;
alter table public.platform_plan_invites
  add constraint platform_plan_invites_document_type_check
  check (document_type is null or document_type in ('CPF','CNPJ'));

create index if not exists companies_document_idx
  on public.companies(document_type, document_number)
  where document_number is not null;

create index if not exists platform_plan_invites_document_idx
  on public.platform_plan_invites(document_type, document_number)
  where document_number is not null;

create unique index if not exists companies_active_cnpj_unique_idx
  on public.companies(document_number)
  where archived_at is null and document_type='CNPJ' and document_number is not null;

create or replace function public.accept_platform_plan_invite(invite_token uuid)
returns uuid language plpgsql security definer set search_path=public
as $$
declare
  i public.platform_plan_invites%rowtype;
  auth_email text;
  new_company uuid;
  company_slug text;
begin
  if auth.uid() is null then raise exception 'Faça login para aceitar o convite.'; end if;
  select email into auth_email from auth.users where id=auth.uid();
  select * into i from public.platform_plan_invites where token=invite_token for update;
  if i.id is null then raise exception 'Convite não encontrado.'; end if;
  if i.status<>'pending' or i.accepted_at is not null then raise exception 'Convite já utilizado ou cancelado.'; end if;
  if i.expires_at<=now() then
    update public.platform_plan_invites set status='expired',updated_at=now() where id=i.id;
    raise exception 'Convite expirado.';
  end if;
  if lower(i.email)<>lower(auth_email) then raise exception 'Entre com o mesmo e-mail que recebeu o convite.'; end if;

  company_slug := regexp_replace(lower(extensions.unaccent(i.company_name)),'[^a-z0-9]+','-','g')||'-'||substr(auth.uid()::text,1,8);

  insert into public.companies(
    name,legal_name,unit_name,responsible_name,email,whatsapp,phone,slug,owner_id,document_type,document_number
  ) values(
    i.company_name,i.legal_name,i.unit_name,i.responsible_name,i.email,i.whatsapp,i.whatsapp,company_slug,auth.uid(),i.document_type,i.document_number
  ) returning id into new_company;

  insert into public.company_subscriptions(company_id,plan_id,status,current_period_starts_at)
    values(new_company,i.plan_id,'active',now());

  update public.platform_plan_invites
    set status='accepted',accepted_at=now(),accepted_by=auth.uid(),company_id=new_company,updated_at=now()
    where id=i.id;

  return new_company;
end $$;

grant execute on function public.accept_platform_plan_invite(uuid) to authenticated;
revoke all on function public.accept_platform_plan_invite(uuid) from public,anon;
