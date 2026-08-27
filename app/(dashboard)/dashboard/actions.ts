"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";
export async function toggleStoreStatus(formData:FormData){const {supabase,company,role,supportSession}=await getCurrentCompany();if(supportSession?.accessLevel==="viewer"||!["owner","manager"].includes(role))redirect("/dashboard?erro=Você não possui permissão para alterar o status da loja.");const open=String(formData.get("open"))==="true";const {error}=await supabase.from("branches").update({is_open:open,updated_at:new Date().toISOString()}).eq("company_id",company.id);if(error)redirect(`/dashboard?erro=${encodeURIComponent(error.message)}`);revalidatePath("/dashboard");revalidatePath(`/cardapio/${company.slug}`);redirect(`/dashboard?sucesso=Loja ${open?"aberta":"fechada"} manualmente.`);}
