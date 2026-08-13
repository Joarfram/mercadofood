"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requirePlatformStaff } from "@/lib/master/auth";
export async function enterSupport(formData:FormData){const code=String(formData.get("code")||"").replace(/\D/g,"");const {supabase}=await requirePlatformStaff("viewer");const {data,error}=await supabase.rpc("redeem_support_code",{submitted_code:code});if(error||!data?.[0])redirect(`/master/suporte?erro=${encodeURIComponent(error?.message||"Código inválido")}`);(await cookies()).set("mf_support_session",data[0].session_id,{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/",expires:new Date(data[0].session_expires_at)});redirect("/dashboard")}
