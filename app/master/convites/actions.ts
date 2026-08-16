"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformStaff } from "@/lib/master/auth";
import { isPlanCode } from "@/lib/billing/plans";

const appUrl=()=> (process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000").replace(/\/$/,"");
export async function createPlanInvite(formData:FormData){
  const {admin,user}=await requirePlatformStaff("master");
  const email=String(formData.get("email")||"").trim().toLowerCase();
  const companyName=String(formData.get("companyName")||"").trim();
  const responsibleName=String(formData.get("responsibleName")||"").trim();
  const whatsapp=String(formData.get("whatsapp")||"").trim();
  const planCode=String(formData.get("plan")||"");
  if(!email||!companyName||!isPlanCode(planCode)) redirect("/master/convites?erro=Dados inválidos");
  const {data:plan}=await admin.from("subscription_plans").select("id").eq("code",planCode).eq("is_active",true).single();
  const {data,error}=await admin.from("platform_plan_invites").insert({email,company_name:companyName,responsible_name:responsibleName||null,whatsapp:whatsapp||null,plan_id:plan?.id,created_by:user.id}).select("token").single();
  if(error) redirect(`/master/convites?erro=${encodeURIComponent(error.message)}`);
  redirect(`/master/convites?convite=${encodeURIComponent(`${appUrl()}/convite-plano/${data.token}`)}`);
}
export async function cancelPlanInvite(formData:FormData){const {admin}=await requirePlatformStaff("master");const id=String(formData.get("id")||"");await admin.from("platform_plan_invites").update({status:"canceled",updated_at:new Date().toISOString()}).eq("id",id).eq("status","pending");revalidatePath("/master/convites")}
