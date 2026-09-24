"use client";

import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { useState } from "react";

function normalizeBrazilPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function DriverAccessShare({
  driverName,
  email,
  phone,
  url,
  compact = false,
}: {
  driverName?: string;
  email?: string;
  phone?: string;
  url: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const normalizedPhone = normalizeBrazilPhone(phone || "");
  const firstName = driverName?.trim().split(/\s+/)[0] || "motoboy";
  const message = email
    ? `Olá, ${firstName}! Seu acesso ao MercadoFood Entrega está pronto. Abra o link abaixo, confirme o e-mail ${email} e crie sua senha no primeiro acesso:\n\n${url}`
    : `Acesse o MercadoFood Entrega pelo link abaixo:\n\n${url}`;
  const whatsappUrl = normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
    : "";

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <div className={compact ? "mt-3" : ""}>
    <p className="break-all rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">{url}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" onClick={copyLink} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
        {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Link copiado" : "Copiar link"}
      </button>
      {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><MessageCircle size={16}/>Enviar pelo WhatsApp</a>}
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink size={16}/>Abrir link</a>
    </div>
  </div>;
}
