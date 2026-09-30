import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptMercadoPagoToken, encryptMercadoPagoToken } from "@/lib/payments/mercado-pago";

export async function GET(request: Request) {
  const url = new URL(request.url), code = url.searchParams.get('code'), state = url.searchParams.get('state');
  if (!code || !state) return NextResponse.redirect(new URL('/configuracoes/pagamentos?erro=oauth', url));
  const admin = createAdminClient(), stateHash = createHash('sha256').update(state).digest('hex');
  const { data: row } = await admin.from('mercado_pago_oauth_states').update({ used_at: new Date().toISOString() }).eq('state_hash', stateHash).is('used_at', null).gt('expires_at', new Date().toISOString()).select('company_id,code_verifier_encrypted').maybeSingle();
  if (!row) return NextResponse.redirect(new URL('/configuracoes/pagamentos?erro=oauth_expirado', url));
  const response = await fetch('https://api.mercadopago.com/oauth/token', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ client_id:process.env.MERCADO_PAGO_CLIENT_ID, client_secret:process.env.MERCADO_PAGO_CLIENT_SECRET, grant_type:'authorization_code', code, redirect_uri:process.env.MERCADO_PAGO_OAUTH_REDIRECT_URI, code_verifier:decryptMercadoPagoToken(row.code_verifier_encrypted) }) });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !token.access_token) {
    // Log only Mercado Pago's public error classification; credentials and tokens stay secret.
    console.error('Mercado Pago OAuth token exchange failed', {
      status: response.status,
      error: typeof token.error === 'string' ? token.error : undefined,
      message: typeof token.message === 'string' ? token.message : undefined,
    });
    return NextResponse.redirect(new URL('/configuracoes/pagamentos?erro=oauth_falhou', url));
  }
  const profileResponse = await fetch('https://api.mercadolibre.com/users/me', { headers: { Authorization: `Bearer ${token.access_token}` }, cache: 'no-store' });
  const profile = await profileResponse.json().catch(() => ({}));
  await admin.from('company_mercado_pago_integrations').upsert({ company_id:row.company_id, mp_user_id:token.user_id ? String(token.user_id) : (profile?.id ? String(profile.id) : null), account_name:profile?.nickname || profile?.first_name || null, account_email:profile?.email || null, access_token_encrypted:encryptMercadoPagoToken(token.access_token), refresh_token_encrypted:token.refresh_token ? encryptMercadoPagoToken(token.refresh_token) : null, access_token_expires_at:token.expires_in ? new Date(Date.now()+Number(token.expires_in)*1000).toISOString() : null, scope:token.scope || null, live_mode:process.env.MERCADO_PAGO_ENVIRONMENT === 'production', status:'connected', connected_at:new Date().toISOString(), disconnected_at:null, last_error_at:null, last_error_code:null, updated_at:new Date().toISOString() }, { onConflict:'company_id' });
  return NextResponse.redirect(new URL('/configuracoes/pagamentos?sucesso=mercado_pago_conectado', url));
}
