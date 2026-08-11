"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlanModule } from "@/lib/auth/current-company";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/cloud-api";
import { decryptWhatsAppToken } from "@/lib/whatsapp/token-crypto";

async function context() {
  const value = await requirePlanModule("messages");
  if (!['owner','manager'].includes(value.role)) redirect("/sem-permissao");
  return value;
}

export async function saveWhatsAppSettings(formData: FormData) {
  const parsed = z.object({
    greeting: z.string().trim().min(10).max(2000),
    handoff: z.string().trim().min(5).max(1000),
    chatbotEnabled: z.boolean(),
  }).safeParse({
    greeting: formData.get("greeting"), handoff: formData.get("handoff"),
    chatbotEnabled: formData.get("chatbotEnabled") === "on",
  });
  if (!parsed.success) redirect(`/configuracoes/whatsapp?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Configuração inválida")}`);
  const { supabase, company } = await context();
  const { error } = await supabase.from("whatsapp_integrations").upsert({
    company_id: company.id,
    greeting_message: parsed.data.greeting,
    handoff_message: parsed.data.handoff,
    chatbot_enabled: parsed.data.chatbotEnabled,
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" });
  if (error) redirect(`/configuracoes/whatsapp?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/configuracoes/whatsapp");
  redirect("/configuracoes/whatsapp?sucesso=Configurações%20do%20chatbot%20salvas");
}

export async function disconnectWhatsApp() {
  const { company } = await context();
  const { error } = await createAdminClient().from("whatsapp_integrations").update({
    status: "disconnected", waba_id: null, phone_number_id: null, display_phone_number: null,
    encrypted_access_token: null, token_iv: null, token_tag: null, connected_at: null,
    updated_at: new Date().toISOString(),
  }).eq("company_id", company.id);
  if (error) redirect(`/configuracoes/whatsapp?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/configuracoes/whatsapp");
  redirect("/configuracoes/whatsapp?sucesso=WhatsApp%20desconectado");
}

export async function sendWhatsAppTest(formData: FormData) {
  const phone = String(formData.get("phone") || "").replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 15) redirect("/configuracoes/whatsapp?erro=Informe%20um%20telefone%20válido");
  const { company } = await context();
  const { data: integration } = await createAdminClient().from("whatsapp_integrations").select("phone_number_id,encrypted_access_token,token_iv,token_tag,status").eq("company_id", company.id).single();
  if (!integration || integration.status !== "connected") redirect("/configuracoes/whatsapp?erro=Conecte%20o%20WhatsApp%20antes%20do%20teste");
  try {
    const token = decryptWhatsAppToken(integration.encrypted_access_token, integration.token_iv, integration.token_tag);
    await sendWhatsAppText(integration.phone_number_id, token, phone.startsWith("55") ? phone : `55${phone}`, "✅ Teste concluído! O WhatsApp está conectado ao MercadoFood.");
  } catch {
    redirect("/configuracoes/whatsapp?erro=Não%20foi%20possível%20enviar%20a%20mensagem%20de%20teste");
  }
  redirect("/configuracoes/whatsapp?sucesso=Mensagem%20de%20teste%20enviada");
}
