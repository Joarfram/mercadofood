"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { accessTokenForIntegration, mercadoPagoOrder } from "@/lib/payments/mercado-pago";

const SESSION_DAYS = 90;
const customerSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(120),
  phone: z.string().transform(value => value.replace(/\D/g, "")).pipe(z.string().min(10).max(15)),
  email: z.string().trim().email().max(160),
});

type CustomerSession = { customerId: string; companyId: string; name: string; phone: string; email: string | null };

function sessionCookieName(slug: string) {
  return `mf_customer_${createHash("sha256").update(slug.toLowerCase()).digest("hex").slice(0, 16)}`;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function resolveCustomerSession(slug: string): Promise<CustomerSession | null> {
  const token = (await cookies()).get(sessionCookieName(slug))?.value;
  if (!token) return null;
  const admin = createAdminClient();
  const { data: company } = await admin.from("companies").select("id").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!company) return null;
  const { data: session } = await admin.from("customer_menu_sessions")
    .select("id,customer_id,company_id,expires_at,customers(name,phone,email)")
    .eq("company_id", company.id).eq("token_hash", tokenHash(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return null;
  const customer = Array.isArray(session.customers) ? session.customers[0] : session.customers;
  if (!customer) return null;
  return { customerId: session.customer_id, companyId: session.company_id, name: customer.name, phone: customer.phone, email: customer.email || null };
}

export async function registerPublicCustomer(input: unknown) {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Informe nome e WhatsApp válidos." };
  const { slug, name, phone, email } = parsed.data;
  const admin = createAdminClient();
  const { data: company } = await admin.from("companies").select("id").eq("slug", slug).eq("status", "active").eq("menu_is_active", true).maybeSingle();
  if (!company) return { ok: false as const, error: "Cardápio indisponível." };

  // Sem confirmação por SMS, nunca reutilizamos um cadastro apenas por coincidência
  // de telefone: isso poderia revelar o pedido de outra pessoa. A sessão segura deste
  // aparelho passa a identificar este cadastro nas próximas visitas.
  const { data: customer, error: customerError } = await admin.from("customers")
    .insert({ company_id: company.id, name, phone, email }).select("id,name,phone,email").single();
  if (customerError || !customer) return { ok: false as const, error: "Não foi possível concluir seu cadastro." };

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const { error: sessionError } = await admin.from("customer_menu_sessions").insert({
    company_id: company.id, customer_id: customer.id, token_hash: tokenHash(token), expires_at: expiresAt.toISOString(),
  });
  if (sessionError) return { ok: false as const, error: "Não foi possível iniciar sua sessão." };
  (await cookies()).set(sessionCookieName(slug), token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: `/cardapio/${slug}`,
    expires: expiresAt,
  });
  return { ok: true as const, customer: { name: customer.name, phone: customer.phone, email: customer.email } };
}

export async function getPublicCustomerState(slug: string) {
  const session = await resolveCustomerSession(slug);
  if (!session) return { registered: false as const, customer: null, order: null };
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders")
    .select("id,order_number,public_code,total,status,service_type,created_at,estimated_preparation_minutes,estimated_ready_at,ready_at,delivered_at,canceled_at")
    .eq("company_id", session.companyId).eq("customer_id", session.customerId).is("customer_closed_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { registered: true as const, customer: { name: session.name, phone: session.phone, email: session.email }, order: order || null };
}

/** Atualiza somente o e-mail do cliente autenticado neste aparelho. */
export async function updatePublicCustomerEmail(input: { slug: string; email: string }) {
  const email = z.string().trim().email().max(160).safeParse(input.email);
  if (!email.success) return { ok: false as const, error: "Informe um e-mail válido." };
  const session = await resolveCustomerSession(input.slug);
  if (!session) return { ok: false as const, error: "Sua sessão expirou." };
  const admin = createAdminClient();
  const { data, error } = await admin.from("customers").update({ email: email.data })
    .eq("id", session.customerId).eq("company_id", session.companyId).select("email").maybeSingle();
  if (error || !data) return { ok: false as const, error: "Não foi possível atualizar seu e-mail." };
  return { ok: true as const, email: data.email };
}

export async function closePublicCustomerOrder(input: { slug: string; orderId: string }) {
  const session = await resolveCustomerSession(input.slug);
  if (!session) return { ok: false as const, error: "Sua sessão expirou." };
  const admin = createAdminClient();
  const { data, error } = await admin.from("orders").update({ customer_closed_at: new Date().toISOString() })
    .eq("id", input.orderId).eq("company_id", session.companyId).eq("customer_id", session.customerId)
    .is("customer_closed_at", null).select("id").maybeSingle();
  if (error || !data) return { ok: false as const, error: "Não foi possível fechar a visualização do pedido." };
  return { ok: true as const };
}

async function createPublicSupabaseClient() {
  return createPublicClient();
}

export async function previewPublicCoupon(input: { slug: string; code: string; subtotal: number }) {
  const supabase = await createPublicSupabaseClient();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { ok: false as const, error: "Informe o código do cupom." };
  if (!Number.isFinite(input.subtotal) || input.subtotal <= 0) return { ok: false as const, error: "Adicione produtos antes de aplicar o cupom." };

  const { data, error } = await supabase.rpc("preview_public_coupon", {
    p_slug: input.slug,
    p_code: code,
    p_subtotal: input.subtotal
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, data };
}

export async function submitPublicOrder(payload: unknown) {
  const supabase = await createPublicSupabaseClient();

  const input = payload as { slug?: string; service_type?: string; delivery_zone_id?: string; [key: string]: unknown };
  const slug = typeof input.slug === "string" ? input.slug : "";
  const session = await resolveCustomerSession(slug);
  if (!session) return { ok: false as const, error: "Faça seu cadastro antes de confirmar o pedido.", registrationRequired: true as const };
  const securedPayload = { ...input, customer_name: session.name, customer_phone: session.phone };
  const [{ data: serviceConfig }, { data: zones }] = await Promise.all([
    supabase.rpc('get_public_service_config',{p_slug:input.slug || ''}),
    supabase.rpc('get_public_delivery_zones',{p_slug:input.slug || ''}),
  ]);
  if (input.service_type === 'delivery' && !serviceConfig?.delivery_enabled) return { ok:false as const,error:'A loja não está recebendo pedidos para entrega.' };
  if (input.service_type === 'pickup' && !serviceConfig?.pickup_enabled) return { ok:false as const,error:'A loja não está recebendo pedidos para retirada.' };
  if (input.service_type === 'delivery' && Array.isArray(zones) && zones.length && !input.delivery_zone_id) return { ok:false as const,error:'Selecione um bairro atendido pela loja.' };
  const { data, error } = await supabase.rpc("create_public_order", { p_payload: securedPayload });
  if (error) return { ok: false as const, error: error.message };
  let orderData = data;
  if (input.service_type === 'delivery' && input.delivery_zone_id) {
    const { data: adjusted, error: zoneError } = await supabase.rpc('apply_public_order_delivery_zone',{p_order_id:data.order_id,p_zone_id:input.delivery_zone_id});
    if (zoneError) return { ok:false as const,error:zoneError.message };
    orderData = adjusted;
  }
  const zone = Array.isArray(zones) ? zones.find(item => item?.id === input.delivery_zone_id) : null;
  const estimatedMinutes = Math.max(5, Math.min(300, Number(zone?.estimated_minutes || serviceConfig?.average_delivery_minutes || 45)));
  const admin = createAdminClient();
  await admin.from("orders").update({
    estimated_preparation_minutes: estimatedMinutes,
    estimated_ready_at: new Date(Date.now() + estimatedMinutes * 60000).toISOString(),
  }).eq("id", orderData.order_id).eq("company_id", session.companyId).eq("customer_id", session.customerId);
  return { ok: true as const, data: orderData };
}

/** Cria uma nova tentativa PIX para um pedido que pertence à sessão deste cliente. */
export async function createPublicMercadoPagoPix(input: { slug: string; orderId: string }) {
  const session = await resolveCustomerSession(input.slug);
  if (!session) return { ok: false as const, error: "Sua sessão expirou." };
  if (!session.email) return { ok: false as const, error: "Informe seu e-mail para gerar o PIX." };
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id,company_id,customer_id,public_code,total,status")
    .eq("id", input.orderId).eq("company_id", session.companyId).eq("customer_id", session.customerId).maybeSingle();
  if (!order || order.status === "canceled") return { ok: false as const, error: "Pedido não encontrado." };
  const { data: integration } = await admin.from("company_mercado_pago_integrations")
    .select("company_id,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,status,pix_enabled")
    .eq("company_id", session.companyId).maybeSingle();
  if (!integration?.pix_enabled || integration.status !== "connected" || !integration.access_token_encrypted) return { ok: false as const, error: "PIX online não está disponível para esta loja." };

  const idempotencyKey = crypto.randomUUID();
  const externalReference = `mf_${String(order.public_code || order.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}_${idempotencyKey.slice(0, 8)}`;
  const { data: attempt, error: attemptError } = await admin.from("mercado_pago_payment_attempts").insert({
    company_id: session.companyId, internal_order_id: order.id, external_reference: externalReference, payment_type: "pix",
    transaction_amount: Number(order.total), idempotency_key: idempotencyKey, order_status: "pending",
  }).select("id").single();
  if (attemptError || !attempt) return { ok: false as const, error: "Não foi possível iniciar o PIX." };

  try {
    // O valor e a loja vêm exclusivamente do pedido salvo; nada sensível é aceito do navegador.
    await admin.from("orders").update({ status: "awaiting_payment", payment_method: "pix", payment_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", order.id).eq("company_id", session.companyId).eq("customer_id", session.customerId);
    const mpOrder = await mercadoPagoOrder(await accessTokenForIntegration(integration), "/v1/orders", {
      method: "POST", headers: { "X-Idempotency-Key": idempotencyKey }, body: JSON.stringify({
        type: "online", total_amount: Number(order.total).toFixed(2), external_reference: externalReference, processing_mode: "automatic",
        transactions: { payments: [{ amount: Number(order.total).toFixed(2), payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: "PT30M" }] },
        payer: { email: session.email },
      }),
    });
    const payment = Array.isArray(mpOrder?.transactions?.payments) ? mpOrder.transactions.payments[0] : null;
    if (!mpOrder?.id || !payment?.id) throw new Error("Resposta Mercado Pago sem identificadores da cobrança.");
    const paymentMethod = payment.payment_method || {};
    await admin.from("mercado_pago_payment_attempts").update({
      mp_order_id: String(mpOrder.id), mp_transaction_id: String(payment.id), order_status: mpOrder.status || "pending", order_status_detail: mpOrder.status_detail || null,
      transaction_status: payment.status || null, transaction_status_detail: payment.status_detail || null, payment_method_id: paymentMethod.id || "pix",
      qr_code: paymentMethod.qr_code || null, qr_code_base64: paymentMethod.qr_code_base64 || null, ticket_url: paymentMethod.ticket_url || null,
      expires_at: mpOrder.expiration_date || payment.expiration_date || null, updated_at: new Date().toISOString(),
    }).eq("id", attempt.id);
    return { ok: true as const, pix: { qrCode: paymentMethod.qr_code || null, qrCodeBase64: paymentMethod.qr_code_base64 || null, ticketUrl: paymentMethod.ticket_url || null, expiresAt: mpOrder.expiration_date || payment.expiration_date || null } };
  } catch (error) {
    await admin.from("mercado_pago_payment_attempts").update({ order_status: "failed", order_status_detail: error instanceof Error ? error.message.slice(0, 200) : "create_failed", updated_at: new Date().toISOString() }).eq("id", attempt.id);
    await admin.from("orders").update({ status: "new", payment_status: "pending", updated_at: new Date().toISOString() }).eq("id", order.id).eq("company_id", session.companyId);
    return { ok: false as const, error: "Não foi possível gerar o PIX. Tente novamente." };
  }
}

/**
 * Recebe exclusivamente o token de uso único gerado pelo Card Payment Brick.
 * Número do cartão, validade e CVV não passam pelo MercadoFood.
 */
export async function createPublicMercadoPagoCard(input: {
  slug: string; orderId: string; token: string; paymentMethodId: string;
  paymentType: "credit_card" | "debit_card"; installments: number;
}) {
  const parsed = z.object({
    slug: z.string().trim().min(1).max(120), orderId: z.string().uuid(),
    token: z.string().trim().min(8).max(500), paymentMethodId: z.string().trim().min(1).max(80),
    paymentType: z.enum(["credit_card", "debit_card"]), installments: z.number().int().min(1).max(24),
  }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Dados de cartão inválidos. Tente novamente." };
  const session = await resolveCustomerSession(parsed.data.slug);
  if (!session) return { ok: false as const, error: "Sua sessão expirou." };
  if (!session.email) return { ok: false as const, error: "Informe seu e-mail para pagar com cartão." };

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id,company_id,customer_id,public_code,total,status")
    .eq("id", parsed.data.orderId).eq("company_id", session.companyId).eq("customer_id", session.customerId).maybeSingle();
  if (!order || order.status === "canceled") return { ok: false as const, error: "Pedido não encontrado." };
  const { data: integration } = await admin.from("company_mercado_pago_integrations")
    .select("company_id,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,status,card_enabled")
    .eq("company_id", session.companyId).maybeSingle();
  if (!integration?.card_enabled || integration.status !== "connected" || !integration.access_token_encrypted) return { ok: false as const, error: "Cartão online não está disponível para esta loja." };

  const idempotencyKey = crypto.randomUUID();
  const externalReference = `mf_${String(order.public_code || order.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}_${idempotencyKey.slice(0, 8)}`;
  const { data: attempt, error: attemptError } = await admin.from("mercado_pago_payment_attempts").insert({
    company_id: session.companyId, internal_order_id: order.id, external_reference: externalReference, payment_type: "card",
    transaction_amount: Number(order.total), installments: parsed.data.installments, payment_method_id: parsed.data.paymentMethodId,
    idempotency_key: idempotencyKey, order_status: "pending",
  }).select("id").single();
  if (attemptError || !attempt) return { ok: false as const, error: "Não foi possível iniciar o pagamento." };

  try {
    await admin.from("orders").update({ status: "awaiting_payment", payment_method: "online_card", payment_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", order.id).eq("company_id", session.companyId).eq("customer_id", session.customerId);
    const mpOrder = await mercadoPagoOrder(await accessTokenForIntegration(integration), "/v1/orders", {
      method: "POST", headers: { "X-Idempotency-Key": idempotencyKey }, body: JSON.stringify({
        type: "online", total_amount: Number(order.total).toFixed(2), external_reference: externalReference, processing_mode: "automatic",
        transactions: { payments: [{ amount: Number(order.total).toFixed(2), payment_method: {
          id: parsed.data.paymentMethodId, type: parsed.data.paymentType, token: parsed.data.token, installments: parsed.data.installments,
        } }] }, payer: { email: session.email },
      }),
    });
    const payment = Array.isArray(mpOrder?.transactions?.payments) ? mpOrder.transactions.payments[0] : null;
    if (!mpOrder?.id || !payment?.id) throw new Error("Resposta Mercado Pago sem identificadores da cobrança.");
    await admin.from("mercado_pago_payment_attempts").update({
      mp_order_id: String(mpOrder.id), mp_transaction_id: String(payment.id), order_status: mpOrder.status || "pending", order_status_detail: mpOrder.status_detail || null,
      transaction_status: payment.status || null, transaction_status_detail: payment.status_detail || null, payment_method_id: payment.payment_method?.id || parsed.data.paymentMethodId,
      updated_at: new Date().toISOString(),
    }).eq("id", attempt.id);
    const approved = mpOrder.status === "processed" && ["approved", "processed"].includes(payment.status);
    if (approved) await admin.rpc("finalize_mercado_pago_attempt", { p_attempt_id: attempt.id });
    return { ok: true as const, status: approved ? "approved" : (mpOrder.status || "pending") };
  } catch (error) {
    await admin.from("mercado_pago_payment_attempts").update({ order_status: "failed", order_status_detail: error instanceof Error ? error.message.slice(0, 200) : "create_failed", updated_at: new Date().toISOString() }).eq("id", attempt.id);
    return { ok: false as const, error: "Não foi possível processar o cartão. Verifique os dados e tente novamente." };
  }
}
