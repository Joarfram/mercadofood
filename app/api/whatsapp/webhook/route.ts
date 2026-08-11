import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/cloud-api";
import { decryptWhatsAppToken } from "@/lib/whatsapp/token-crypto";

export const runtime = "nodejs";

type MetaMessage = { id?: string; from?: string; type?: string; text?: { body?: string } };
type MetaValue = { metadata?: { phone_number_id?: string }; contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>; messages?: MetaMessage[]; statuses?: Array<{ id?: string; status?: string }> };

function validSignature(rawBody: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`);
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function automaticReply(input: string, greeting: string, slug: string) {
  const text = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://mercadofood.vercel.app").replace(/\/$/, "");
  if (/^(1|cardapio|menu)$/.test(text)) return `Veja nosso cardápio e faça seu pedido:\n${appUrl}/cardapio/${slug}`;
  if (/^(2|pedido|acompanhar|status)$/.test(text)) return "Envie agora o código de acompanhamento do seu pedido.";
  if (/^[a-z0-9-]{6,20}$/i.test(input.trim()) && /\d/.test(input)) return `Acompanhe seu pedido aqui:\n${appUrl}/acompanhar/${encodeURIComponent(input.trim())}`;
  if (/^(3|horario|horarios|endereco|localizacao)$/.test(text)) return `Consulte endereço, horários e informações da loja:\n${appUrl}/cardapio/${slug}`;
  return greeting;
}

async function processMessage(value: MetaValue, message: MetaMessage) {
  const phoneNumberId = value.metadata?.phone_number_id;
  const customerPhone = message.from;
  if (!phoneNumberId || !customerPhone || !message.id) return;
  const admin = createAdminClient();
  const { data: existingMessage } = await admin.from("whatsapp_messages").select("id").eq("meta_message_id", message.id).maybeSingle();
  if (existingMessage) return;
  const { data: integration } = await admin.from("whatsapp_integrations").select("*").eq("phone_number_id", phoneNumberId).eq("status", "connected").maybeSingle();
  if (!integration) return;
  const { data: company } = await admin.from("companies").select("slug").eq("id", integration.company_id).single();
  const contact = value.contacts?.find(item => item.wa_id === customerPhone) || value.contacts?.[0];
  const body = String(message.text?.body || `[${message.type || "mensagem"}]`).slice(0, 4000);
  const { data: current } = await admin.from("whatsapp_conversations").select("id,status,unread_count").eq("company_id", integration.company_id).eq("customer_phone", customerPhone).maybeSingle();
  const { data: conversation, error: conversationError } = await admin.from("whatsapp_conversations").upsert({
    company_id: integration.company_id,
    customer_phone: customerPhone,
    customer_name: contact?.profile?.name || null,
    status: current?.status || "bot",
    unread_count: Number(current?.unread_count || 0) + 1,
    last_message_preview: body.slice(0, 240),
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id,customer_phone" }).select("id,status").single();
  if (conversationError || !conversation) return;
  const { error: messageError } = await admin.from("whatsapp_messages").insert({
    company_id: integration.company_id, conversation_id: conversation.id, meta_message_id: message.id,
    direction: "inbound", sender_type: "customer", message_type: message.type || "unknown", body, delivery_status: "received",
  });
  if (messageError) return;
  if (!integration.chatbot_enabled || conversation.status !== "bot" || message.type !== "text") return;

  const normalized = body.trim().toLowerCase();
  if (/^(4|atendente|falar com atendente|humano)$/.test(normalized)) {
    await admin.from("whatsapp_conversations").update({ status: "attendant", updated_at: new Date().toISOString() }).eq("id", conversation.id);
  }
  const reply = /^(4|atendente|falar com atendente|humano)$/.test(normalized)
    ? integration.handoff_message
    : automaticReply(body, integration.greeting_message, company?.slug || "");
  const token = decryptWhatsAppToken(integration.encrypted_access_token, integration.token_iv, integration.token_tag);
  const sentId = await sendWhatsAppText(phoneNumberId, token, customerPhone, reply);
  await admin.from("whatsapp_messages").insert({
    company_id: integration.company_id, conversation_id: conversation.id, meta_message_id: sentId || null,
    direction: "outbound", sender_type: "bot", message_type: "text", body: reply, delivery_status: "sent",
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) return new Response(challenge || "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
  const payload = JSON.parse(rawBody);
  const values: MetaValue[] = (payload.entry || []).flatMap((entry: { changes?: Array<{ value?: MetaValue }> }) => (entry.changes || []).map(change => change.value).filter(Boolean));
  try {
    for (const value of values) {
      for (const status of value.statuses || []) {
        if (status.id && ["sent","delivered","read","failed"].includes(status.status || "")) {
          await createAdminClient().from("whatsapp_messages").update({ delivery_status: status.status }).eq("meta_message_id", status.id);
        }
      }
      for (const message of value.messages || []) await processMessage(value, message);
    }
  } catch (error) {
    console.error("WhatsApp webhook processing failed", error instanceof Error ? error.message : "unknown");
  }
  return NextResponse.json({ received: true });
}
