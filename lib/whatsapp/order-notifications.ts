import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/cloud-api";
import { decryptWhatsAppToken } from "@/lib/whatsapp/token-crypto";

export async function sendStoreOrderNotification(orderId: string) {
  const admin = createAdminClient();
  const { data: notification, error: notificationError } = await admin
    .from("whatsapp_notifications")
    .select("id,company_id,recipient_phone,message_body,status")
    .eq("order_id", orderId)
    .eq("recipient_type", "store")
    .eq("template_key", "new_order_store")
    .in("status", ["queued", "failed"])
    .maybeSingle();

  if (notificationError || !notification) {
    return { ok: false as const, skipped: true as const, error: notificationError?.message || "Aviso não enfileirado" };
  }

  const { data: integration, error: integrationError } = await admin
    .from("whatsapp_integrations")
    .select("phone_number_id,encrypted_access_token,token_iv,token_tag,status,order_notifications_enabled")
    .eq("company_id", notification.company_id)
    .maybeSingle();

  if (integrationError || !integration || integration.status !== "connected" || !integration.order_notifications_enabled) {
    await admin.from("whatsapp_notifications").update({
      status: "failed",
      error_message: "WhatsApp da loja não está conectado ou o aviso de pedidos está desativado.",
      updated_at: new Date().toISOString(),
    }).eq("id", notification.id);
    return { ok: false as const, skipped: false as const, error: "Integração da loja indisponível" };
  }

  try {
    const token = decryptWhatsAppToken(integration.encrypted_access_token, integration.token_iv, integration.token_tag);
    const phone = notification.recipient_phone.startsWith("55") ? notification.recipient_phone : `55${notification.recipient_phone}`;
    const messageId = await sendWhatsAppText(integration.phone_number_id, token, phone, notification.message_body);
    await admin.from("whatsapp_notifications").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      error_message: null,
      metadata: { whatsapp_message_id: messageId },
      updated_at: new Date().toISOString(),
    }).eq("id", notification.id);
    return { ok: true as const, messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao enviar aviso do pedido.";
    await admin.from("whatsapp_notifications").update({
      status: "failed",
      error_message: message.slice(0, 1000),
      updated_at: new Date().toISOString(),
    }).eq("id", notification.id);
    return { ok: false as const, skipped: false as const, error: message };
  }
}
