create extension if not exists unaccent with schema extensions;

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
  company_slug := regexp_replace(lower(extensions.unaccent(i.company_name)),'[^a-z0-9]+','-','g')||'-'||substr(auth.uid()::text,1,8);
  insert into public.companies(name,responsible_name,email,whatsapp,phone,slug,owner_id)
    values(i.company_name,i.responsible_name,i.email,i.whatsapp,i.whatsapp,company_slug,auth.uid()) returning id into new_company;
  insert into public.company_subscriptions(company_id,plan_id,status,current_period_starts_at)
    values(new_company,i.plan_id,'active',now());
  update public.platform_plan_invites set status='accepted',accepted_at=now(),accepted_by=auth.uid(),company_id=new_company,updated_at=now() where id=i.id;
  return new_company;
end $$;

grant execute on function public.accept_platform_plan_invite(uuid) to authenticated;
revoke all on function public.accept_platform_plan_invite(uuid) from public,anon;
