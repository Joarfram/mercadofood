"use client";

import { MessageCircle } from "lucide-react";

function normalizeBrazilPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function WhatsAppButton({ phone, message, label = "Enviar WhatsApp" }: { phone: string; message: string; label?: string }) {
  const normalized = normalizeBrazilPhone(phone);
  if (!normalized) return null;
  const href = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><MessageCircle size={16}/>{label}</a>;
}
