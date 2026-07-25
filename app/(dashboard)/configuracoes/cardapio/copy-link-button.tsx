"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
export function CopyLinkButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async()=>{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1500)}} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-semibold hover:bg-gray-50">{copied?<Check size={18}/>:<Copy size={18}/>} {copied?"Copiado":"Copiar link"}</button>;
}
