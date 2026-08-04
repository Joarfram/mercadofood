"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyPaymentCode({ value, label = "Copiar PIX" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">
    {copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? "PIX copiado" : label}
  </button>;
}
