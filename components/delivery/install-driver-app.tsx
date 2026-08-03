"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome:'accepted'|'dismissed' }> };
export function InstallDriverApp(){ const [prompt,setPrompt]=useState<InstallPrompt|null>(null); useEffect(()=>{ const handler=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt)}; window.addEventListener('beforeinstallprompt',handler); return()=>window.removeEventListener('beforeinstallprompt',handler);},[]); if(!prompt) return <p className="rounded-xl bg-slate-900 p-3 text-center text-xs text-slate-400">No celular, use o menu do navegador e escolha “Adicionar à tela inicial”.</p>; return <button onClick={async()=>{await prompt.prompt();setPrompt(null)}} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500 px-4 py-3 font-semibold text-emerald-300"><Download size={18}/>Instalar aplicativo</button>; }
