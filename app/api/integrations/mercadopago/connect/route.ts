import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptMercadoPagoToken } from "@/lib/payments/mercado-pago";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function GET() {
  const { company, role } = await getCurrentCompany();
  if (!['owner','manager'].includes(role)) return new NextResponse('Forbidden', { status: 403 });
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID, redirectUri = process.env.MERCADO_PAGO_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) return new NextResponse('Mercado Pago não configurado.', { status: 503 });
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const admin = createAdminClient();
  await admin.from('mercado_pago_oauth_states').insert({ company_id: company.id, state_hash: hash(state), code_verifier_encrypted: encryptMercadoPagoToken(verifier), expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
  const url = new URL('https://auth.mercadopago.com/authorization');
  url.searchParams.set('client_id', clientId); url.searchParams.set('response_type', 'code'); url.searchParams.set('platform_id', 'mp'); url.searchParams.set('redirect_uri', redirectUri); url.searchParams.set('state', state); url.searchParams.set('code_challenge', challenge); url.searchParams.set('code_challenge_method', 'S256');
  return NextResponse.redirect(url);
}
