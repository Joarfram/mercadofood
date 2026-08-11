"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

declare global {
  interface Window {
    FB?: { init(options: Record<string, unknown>): void; login(callback: (response: { authResponse?: { code?: string } }) => void, options: Record<string, unknown>): void };
  }
}

export function WhatsAppConnect({ appId, configId, graphVersion }: { appId: string; configId: string; graphVersion: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function initialize() {
    if (!appId || !window.FB) return;
    window.FB.init({ appId, cookie: true, xfbml: true, version: graphVersion });
    setReady(true);
  }

  async function connect() {
    if (!window.FB || !configId) return;
    setLoading(true); setError("");
    let finish: (value: { wabaId: string; phoneNumberId: string }) => void = () => undefined;
    const session = new Promise<{ wabaId: string; phoneNumberId: string }>((resolve, reject) => {
      finish = resolve;
      window.setTimeout(() => reject(new Error("A autorização demorou demais. Tente novamente.")), 60000);
    });
    const listener = (event: MessageEvent) => {
      if (!/https:\/\/(www\.|web\.)?facebook\.com/.test(event.origin)) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.event === "FINISH") finish({ wabaId: String(data.data?.waba_id || ""), phoneNumberId: String(data.data?.phone_number_id || "") });
      } catch { /* outras mensagens do SDK são ignoradas */ }
    };
    window.addEventListener("message", listener);
    try {
      const auth = await new Promise<{ code: string }>((resolve, reject) => window.FB!.login(response => {
        const code = response.authResponse?.code;
        if (code) resolve({ code });
        else reject(new Error("A conexão foi cancelada."));
      }, { config_id: configId, response_type: "code", override_default_response_type: true, extras: { setup: {} } }));
      const ids = await session;
      if (!ids.wabaId || !ids.phoneNumberId) throw new Error("A Meta não informou o número conectado.");
      const response = await fetch("/api/whatsapp/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: auth.code, ...ids }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível conectar o WhatsApp.");
      router.refresh();
      router.push(`/configuracoes/whatsapp?sucesso=${encodeURIComponent(`WhatsApp ${result.phone || ""} conectado`)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível conectar o WhatsApp.");
    } finally {
      window.removeEventListener("message", listener);
      setLoading(false);
    }
  }

  return <div>
    <Script src="https://connect.facebook.net/pt_BR/sdk.js" strategy="afterInteractive" onLoad={initialize}/>
    <button type="button" onClick={connect} disabled={!ready || !configId || loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18}/> : <MessageCircle size={18}/>}Conectar com a Meta</button>
    {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
  </div>;
}
