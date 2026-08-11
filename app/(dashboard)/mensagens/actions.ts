"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/cloud-api";
import { decryptWhatsAppToken } from "@/lib/whatsapp/token-crypto";

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

export async function setWhatsAppConversationMode(formData: FormData) {
  const { supabase, company } = await context();
  const id = String(formData.get("conversationId") || "");
  const mode = String(formData.get("mode") || "");
  if (!id || !["bot","attendant","closed"].includes(mode)) return;
  await supabase.from("whatsapp_conversations").update({ status: mode, unread_count: 0, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", company.id);
  revalidatePath("/mensagens");
}

export async function sendWhatsAppReply(formData: FormData) {
  const { supabase, company } = await context();
  const conversationId = String(formData.get("conversationId") || "");
  const body = String(formData.get("body") || "").trim().slice(0, 4000);
  if (!conversationId || !body) redirect("/mensagens?erro=Escreva%20uma%20mensagem");
  const { data: conversation } = await supabase.from("whatsapp_conversations").select("id,customer_phone").eq("id", conversationId).eq("company_id", company.id).single();
  if (!conversation) redirect("/mensagens?erro=Conversa%20não%20encontrada");
  const admin = createAdminClient();
  const { data: integration } = await admin.from("whatsapp_integrations").select("phone_number_id,encrypted_access_token,token_iv,token_tag,status").eq("company_id", company.id).single();
  if (!integration || integration.status !== "connected") redirect("/mensagens?erro=WhatsApp%20não%20conectado");
  try {
    const token = decryptWhatsAppToken(integration.encrypted_access_token, integration.token_iv, integration.token_tag);
    const messageId = await sendWhatsAppText(integration.phone_number_id, token, conversation.customer_phone, body);
    await admin.from("whatsapp_messages").insert({ company_id: company.id, conversation_id: conversation.id, meta_message_id: messageId || null, direction: "outbound", sender_type: "attendant", message_type: "text", body, delivery_status: "sent" });
    await supabase.from("whatsapp_conversations").update({ status: "attendant", unread_count: 0, last_message_preview: body.slice(0,240), last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id).eq("company_id", company.id);
  } catch {
    redirect("/mensagens?erro=Não%20foi%20possível%20enviar%20a%20mensagem");
  }
  revalidatePath("/mensagens");
  redirect("/mensagens?sucesso=Mensagem%20enviada%20pelo%20WhatsApp");
}
