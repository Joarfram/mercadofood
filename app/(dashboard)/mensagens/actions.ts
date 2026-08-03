"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";

const allowedRoles = ["owner","manager","attendant"];

async function context() {
  const value = await requirePlanModule("messages");
  if (!allowedRoles.includes(value.role)) redirect("/sem-permissao");
  return value;
}

export async function markMessageRead(formData: FormData) {
  const { supabase, company } = await context();
  const id = String(formData.get("id") || "");
  if (id) await supabase.from("customer_messages").update({ status:"read", updated_at:new Date().toISOString() }).eq("id",id).eq("company_id",company.id).eq("status","new");
  revalidatePath("/mensagens");
}

export async function replyToMessage(formData: FormData) {
  const { supabase, company, user } = await context();
  const id = String(formData.get("id") || "");
  const reply = String(formData.get("reply") || "").trim();
  if (!id || !reply) redirect("/mensagens?erro=Escreva%20uma%20resposta");
  const { error } = await supabase.from("customer_messages").update({
    owner_reply: reply.slice(0,2000), status:"replied", replied_by:user.id,
    replied_at:new Date().toISOString(), updated_at:new Date().toISOString()
  }).eq("id",id).eq("company_id",company.id);
  if (error) redirect(`/mensagens?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/mensagens");
  redirect("/mensagens?sucesso=Resposta%20registrada");
}

export async function archiveMessage(formData: FormData) {
  const { supabase, company } = await context();
  const id = String(formData.get("id") || "");
  if (id) await supabase.from("customer_messages").update({ status:"archived", updated_at:new Date().toISOString() }).eq("id",id).eq("company_id",company.id);
  revalidatePath("/mensagens");
}

export async function deleteMessage(formData: FormData) {
  const { supabase, company, role } = await context();
  if (!["owner","manager"].includes(role)) redirect("/sem-permissao");
  const id = String(formData.get("id") || "");
  if (id) await supabase.from("customer_messages").delete().eq("id",id).eq("company_id",company.id);
  revalidatePath("/mensagens");
}
