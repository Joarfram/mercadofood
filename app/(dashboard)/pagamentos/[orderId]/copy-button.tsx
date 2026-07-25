"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyPixButton({ payload }: { payload: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <button onClick={copy} type="button" className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">
    {copied ? <Check size={18}/> : <Copy size={18}/>} {copied ? "Código copiado" : "Copiar PIX Copia e Cola"}
  </button>;
}
