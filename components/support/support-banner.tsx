import { Eye, Headphones, LogOut } from "lucide-react";
import { endSupportMode } from "@/app/support-actions";

export function SupportBanner({ companyName, accessLevel, expiresAt }: {
  companyName: string;
  accessLevel: "viewer" | "support";
  expiresAt: string;
}) {
  const Icon = accessLevel === "viewer" ? Eye : Headphones;
  return <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-950 shadow-sm">
    <div className="flex items-center gap-2"><Icon size={18}/><strong>Modo suporte: {companyName}</strong><span className="hidden sm:inline">• {accessLevel === "viewer" ? "somente visualização" : "ajustes autorizados"} • até {new Date(expiresAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span></div>
    <form action={endSupportMode}><button className="flex items-center gap-2 rounded-lg bg-amber-950 px-3 py-2 font-bold text-white"><LogOut size={16}/>Encerrar suporte</button></form>
  </div>;
}
