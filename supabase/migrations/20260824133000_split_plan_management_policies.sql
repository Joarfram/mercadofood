-- Evita políticas permissivas SELECT duplicadas causadas por FOR ALL.
drop policy if exists "plan and role manage drivers" on public.drivers;
create policy "plan and role insert drivers" on public.drivers for insert to authenticated
with check (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'drivers'));
create policy "plan and role update drivers" on public.drivers for update to authenticated
using (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'drivers'))
with check (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'drivers'));
create policy "plan and role delete drivers" on public.drivers for delete to authenticated
using (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'drivers'));

drop policy if exists "plan and role manage deliveries" on public.deliveries;
create policy "plan and role insert deliveries" on public.deliveries for insert to authenticated
with check (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'delivery'));
create policy "plan and role update deliveries" on public.deliveries for update to authenticated
using (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'delivery'))
with check (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'delivery'));
create policy "plan and role delete deliveries" on public.deliveries for delete to authenticated
using (public.can_access_module(company_id,'delivery') and public.current_company_role(company_id)<>'viewer' and public.company_plan_allows(company_id,'delivery'));

