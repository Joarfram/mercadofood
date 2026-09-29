import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessTokenForIntegration, isApprovedOrder, mercadoPagoOrder, verifyMercadoPagoWebhook } from "@/lib/payments/mercado-pago";

export async function POST(request: Request) {
  const url = new URL(request.url); const body = await request.json().catch(() => ({}));
  const mpOrderId = String(url.searchParams.get("data.id") || body?.data?.id || "");
  const eventType = String(body?.type || body?.topic || url.searchParams.get("type") || "").toLowerCase();
  if (!verifyMercadoPagoWebhook(request.headers.get("x-signature"), request.headers.get("x-request-id"), mpOrderId)) return new NextResponse("Unauthorized", { status: 401 });
  if (!mpOrderId) return new NextResponse("Bad request", { status: 400 });
  // A mesma URL pode receber outros tópicos caso sejam habilitados por engano.
  // Só Orders participa do fluxo que libera um pedido do MercadoFood.
  if (eventType && eventType !== "order" && eventType !== "orders") return NextResponse.json({ received: true, ignored: true });
  const admin = createAdminClient();
  const eventId = String(body?.id || request.headers.get("x-request-id") || "");
  const { data: insertedEvent, error: eventError } = await admin.from("mercado_pago_webhook_events")
    .insert({ mp_order_id: mpOrderId, event_id: eventId, payload: body }).select("id,processed_at").maybeSingle();
  let event = insertedEvent;
  if (eventError?.code === "23505") {
    // Uma tentativa anterior que falhou precisa poder ser refeita pelo retry do
    // Mercado Pago; apenas eventos já concluídos são descartados como duplicados.
    const { data: existing } = await admin.from("mercado_pago_webhook_events")
      .select("id,processed_at").eq("mp_order_id", mpOrderId).eq("event_id", eventId).maybeSingle();
    if (!existing) return new NextResponse("Unable to load webhook", { status: 500 });
    if (existing.processed_at) return NextResponse.json({ received: true, duplicate: true });
    event = existing;
  }
  if (eventError || !event) return new NextResponse("Unable to register webhook", { status: 500 });
  const { data: attempt } = await admin.from("mercado_pago_payment_attempts").select("*").eq("mp_order_id", mpOrderId).maybeSingle();
  if (!attempt) { await admin.from("mercado_pago_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id); return NextResponse.json({ received: true }); }
  const { data: integration } = await admin.from("company_mercado_pago_integrations").select("company_id,access_token_encrypted,refresh_token_encrypted,access_token_expires_at").eq("company_id", attempt.company_id).maybeSingle();
  if (!integration?.access_token_encrypted) return new NextResponse("Integration unavailable", { status: 409 });
  try {
    const order = await mercadoPagoOrder(await accessTokenForIntegration(integration), `/v1/orders/${encodeURIComponent(mpOrderId)}`);
    const payments = Array.isArray(order?.transactions?.payments) ? order.transactions.payments : [];
    const payment = payments.find((item: any) => !attempt.mp_transaction_id || String(item?.id) === String(attempt.mp_transaction_id));
    if (!payment || String(order?.external_reference) !== attempt.external_reference || Number(order?.total_amount) !== Number(attempt.transaction_amount) || (attempt.mp_transaction_id && String(payment.id) !== String(attempt.mp_transaction_id))) throw new Error("reference_or_transaction_mismatch");
    await admin.from("mercado_pago_payment_attempts").update({ order_status: order?.status || "pending", order_status_detail: order?.status_detail || null, transaction_status: payment?.status || null, transaction_status_detail: payment?.status_detail || null, mp_transaction_id: String(payment.id), updated_at: new Date().toISOString() }).eq("id", attempt.id);
    if (isApprovedOrder(order)) await admin.rpc("finalize_mercado_pago_attempt", { p_attempt_id: attempt.id });
    await admin.from("mercado_pago_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
  } catch (error) {
    await admin.from("mercado_pago_webhook_events").update({ error_code: error instanceof Error ? error.message.slice(0, 120) : "processing_failed" }).eq("id", event.id);
    return new NextResponse("Webhook processing failed", { status: 409 });
  }
  return NextResponse.json({ received: true });
}
