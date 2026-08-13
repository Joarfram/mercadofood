"use server";
import { getCurrentCompany } from "@/lib/auth/current-company";
export type SupportCodeState = { code?: string; expiresAt?: string; error?: string };
export async function generateSupportCode(_: SupportCodeState, formData: FormData): Promise<SupportCodeState> {
  const access=String(formData.get("access")||"support");
  if(!["viewer","support"].includes(access)) return {error:"Nível de acesso inválido."};
  const {supabase,company,role,supportSession}=await getCurrentCompany();
  if(supportSession||!["owner","manager"].includes(role)) return {error:"Você não pode gerar este código."};
  const {data,error}=await supabase.rpc("generate_support_code",{target_company:company.id,requested_access:access,validity_minutes:30});
  if(error||!data?.[0]) return {error:error?.message||"Não foi possível gerar o código."};
  return {code:data[0].code,expiresAt:data[0].expires_at};
}
