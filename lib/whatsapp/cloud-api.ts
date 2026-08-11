function graphUrl(path: string) {
  const version = process.env.META_GRAPH_API_VERSION || "v23.0";
  return `https://graph.facebook.com/${version}/${path.replace(/^\//, "")}`;
}

export async function exchangeEmbeddedSignupCode(code: string) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Aplicativo da Meta não configurado.");
  const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
  const response = await fetch(`${graphUrl("oauth/access_token")}?${params}`, { method: "GET", cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error("A Meta não autorizou a conexão.");
  return String(payload.access_token);
}

export async function subscribeWhatsAppAccount(wabaId: string, accessToken: string) {
  const response = await fetch(graphUrl(`${wabaId}/subscribed_apps`), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Não foi possível ativar as notificações deste WhatsApp.");
}

export async function getWhatsAppPhone(phoneNumberId: string, accessToken: string) {
  const response = await fetch(`${graphUrl(phoneNumberId)}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) throw new Error("Não foi possível confirmar o número conectado.");
  return { displayPhoneNumber: String(payload.display_phone_number || ""), verifiedName: String(payload.verified_name || "") };
}

export async function sendWhatsAppText(phoneNumberId: string, accessToken: string, to: string, body: string) {
  const response = await fetch(graphUrl(`${phoneNumberId}/messages`), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error("A mensagem não foi enviada pelo WhatsApp.");
  return String(payload.messages?.[0]?.id || "");
}
