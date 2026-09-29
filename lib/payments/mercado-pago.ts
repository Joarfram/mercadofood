import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const api = "https://api.mercadopago.com";

function env(name: string) { const value = process.env[name]; if (!value) throw new Error(`Configuração ausente: ${name}`); return value; }
function encryptionKey() { const key = Buffer.from(env("MERCADO_PAGO_TOKEN_ENCRYPTION_KEY"), "base64"); if (key.length !== 32) throw new Error("MERCADO_PAGO_TOKEN_ENCRYPTION_KEY deve ser uma chave base64 de 32 bytes."); return key; }

export function encryptMercadoPagoToken(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  return [iv.toString("base64url"), Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}
export function decryptMercadoPagoToken(value: string) {
  const [iv, body, tag] = value.split("."); if (!iv || !body || !tag) throw new Error("Token Mercado Pago inválido.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

export async function mercadoPagoOrder(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`${api}${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(`Mercado Pago ${response.status}: ${String(body.message || body.error || "falha na API")}`); return body;
}

type StoredIntegration = {
  company_id: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  access_token_expires_at: string | null;
};

/** Returns a seller token only after the company has been resolved on the server. */
export async function accessTokenForIntegration(integration: StoredIntegration) {
  if (!integration.access_token_encrypted) throw new Error("Integração Mercado Pago sem Access Token.");
  const expiresAt = integration.access_token_expires_at ? Date.parse(integration.access_token_expires_at) : NaN;
  // A margem evita iniciar uma cobrança com token prestes a expirar.
  if (!Number.isFinite(expiresAt) || expiresAt > Date.now() + 60_000) return decryptMercadoPagoToken(integration.access_token_encrypted);
  if (!integration.refresh_token_encrypted) throw new Error("Reconexão Mercado Pago necessária.");

  const response = await fetch(`${api}/oauth/token`, {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({
      client_id: env("MERCADO_PAGO_CLIENT_ID"), client_secret: env("MERCADO_PAGO_CLIENT_SECRET"),
      grant_type: "refresh_token", refresh_token: decryptMercadoPagoToken(integration.refresh_token_encrypted),
    }),
  });
  const refreshed = await response.json().catch(() => ({}));
  if (!response.ok || !refreshed.access_token) {
    await createAdminClient().from("company_mercado_pago_integrations").update({
      status: "reconnect_required", last_error_at: new Date().toISOString(), last_error_code: "token_refresh_failed", updated_at: new Date().toISOString(),
    }).eq("company_id", integration.company_id);
    throw new Error("Reconexão Mercado Pago necessária.");
  }
  await createAdminClient().from("company_mercado_pago_integrations").update({
    access_token_encrypted: encryptMercadoPagoToken(refreshed.access_token),
    refresh_token_encrypted: refreshed.refresh_token ? encryptMercadoPagoToken(refreshed.refresh_token) : integration.refresh_token_encrypted,
    access_token_expires_at: refreshed.expires_in ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString() : null,
    status: "connected", last_error_at: null, last_error_code: null, updated_at: new Date().toISOString(),
  }).eq("company_id", integration.company_id);
  return String(refreshed.access_token);
}

export function isApprovedOrder(order: any) {
  const payments = Array.isArray(order?.transactions?.payments) ? order.transactions.payments : [];
  return order?.status === "processed" && payments.some((payment: any) => ["approved", "processed"].includes(payment?.status));
}

export function verifyMercadoPagoWebhook(signature: string | null, requestId: string | null, dataId: string | null) {
  if (!signature || !requestId || !dataId) return false;
  const parts = Object.fromEntries(signature.split(",").map(part => part.trim().split("=", 2)));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", env("MERCADO_PAGO_WEBHOOK_SECRET")).update(manifest).digest("hex");
  try { return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(parts.v1, "hex")); } catch { return false; }
}
