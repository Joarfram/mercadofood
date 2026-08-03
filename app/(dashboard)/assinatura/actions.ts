"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { isPlanCode } from "@/lib/billing/plans";

export async function requestPlanChange(formData: FormData){
  const requestedPlan=String(formData.get('plan')||'');
  const billingCycle=String(formData.get('billingCycle')||'annual');
  if(!isPlanCode(requestedPlan)||!['monthly','annual'].includes(billingCycle)) redirect('/assinatura?erro=solicitacao');
  const {supabase,company,user,role}=await getCurrentCompany();
  if(role!=='owner') redirect('/sem-permissao');
  const {data:existing}=await supabase.from('plan_change_requests').select('id').eq('company_id',company.id).eq('status','pending').maybeSingle();
  if(existing) redirect('/assinatura?aviso=Já%20existe%20uma%20solicitação%20em%20análise');
  const {error}=await supabase.from('plan_change_requests').insert({company_id:company.id,requested_plan:requestedPlan,billing_cycle:billingCycle,requested_by:user.id});
  if(error) redirect(`/assinatura?erro=${encodeURIComponent(error.message)}`);
  revalidatePath('/assinatura');
  redirect('/assinatura?sucesso=Solicitação%20registrada.%20Nossa%20equipe%20entrará%20em%20contato%20antes%20de%20qualquer%20cobrança');
}
