import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsAppTemplate = "driver_offer" | "customer_out_for_delivery" | "customer_delivered";

type QueueNotificationInput = {
  supabase: SupabaseClient;
  companyId: string;
  deliveryId: string;
  recipientType: "driver" | "customer";
  recipientName?: string | null;
  phone: string;
  template: WhatsAppTemplate;
  message: string;
  metadata?: Record<string, unknown>;
};

export function normalizeBrazilPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function whatsappLink(phone: string, message: string) {
  const normalized = normalizeBrazilPhone(phone);
  if (!normalized) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function trackingUrl(code: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/acompanhar/${encodeURIComponent(code)}`;
}

export function driverOfferMessage(input: {
  driverName?: string | null;
  orderNumber: string;
  storeName: string;
  neighborhood?: string | null;
  reference?: string | null;
  deliveryValue: number;
}) {
  return [
    `Olá, ${input.driverName?.split(" ")[0] || "entregador"}!`,
    "Você recebeu uma nova corrida no MercadoFood.",
    `Pedido: #${input.orderNumber}`,
    `Retirada: ${input.storeName}`,
    input.neighborhood ? `Destino: ${input.neighborhood}` : null,
    input.reference ? `Ponto de referência: ${input.reference}` : null,
    `Valor da corrida: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(input.deliveryValue)}`,
    "Abra o aplicativo para aceitar ou recusar.",
  ].filter(Boolean).join("\n");
}

export function customerOutForDeliveryMessage(input: {
  customerName?: string | null;
  orderNumber: string;
  storeName: string;
  driverName?: string | null;
  trackingCode: string;
}) {
  return [
    `Olá, ${input.customerName?.split(" ")[0] || "cliente"}!`,
    `Seu pedido #${input.orderNumber} da ${input.storeName} saiu para entrega.`,
    input.driverName ? `Entregador: ${input.driverName.split(" ")[0]}` : null,
    "Acompanhe pelo link:",
    trackingUrl(input.trackingCode),
  ].filter(Boolean).join("\n");
}

export function customerDeliveredMessage(input: {
  customerName?: string | null;
  orderNumber: string;
  storeName: string;
}) {
  return [
    `Olá, ${input.customerName?.split(" ")[0] || "cliente"}!`,
    `O pedido #${input.orderNumber} da ${input.storeName} foi marcado como entregue.`,
    "Obrigado por comprar com a gente!",
  ].join("\n");
}

export async function queueWhatsAppNotification(input: QueueNotificationInput) {
  const normalizedPhone = normalizeBrazilPhone(input.phone);
  if (!normalizedPhone) return { queued: false, reason: "missing_phone" } as const;

  const { data, error } = await input.supabase.from("whatsapp_notifications").insert({
    company_id: input.companyId,
    delivery_id: input.deliveryId,
    recipient_type: input.recipientType,
    recipient_name: input.recipientName || null,
    recipient_phone: normalizedPhone,
    template_key: input.template,
    message_body: input.message,
    metadata: input.metadata || {},
    status: "queued",
  }).select("id").single();

  if (error || !data) return { queued: false, reason: error?.message || "insert_failed" } as const;

  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  const webhookToken = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (!webhookUrl) return { queued: true, sent: false, id: data.id } as const;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify({
        notification_id: data.id,
        phone: normalizedPhone,
        message: input.message,
        template: input.template,
        metadata: input.metadata || {},
      }),
      cache: "no-store",
    });

    const status = response.ok ? "sent" : "failed";
    await input.supabase.from("whatsapp_notifications").update({
      status,
      sent_at: response.ok ? new Date().toISOString() : null,
      error_message: response.ok ? null : `Webhook retornou ${response.status}`,
    }).eq("id", data.id);

    return { queued: true, sent: response.ok, id: data.id } as const;
  } catch (error) {
    await input.supabase.from("whatsapp_notifications").update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Falha no webhook",
    }).eq("id", data.id);
    return { queued: true, sent: false, id: data.id } as const;
  }
}
