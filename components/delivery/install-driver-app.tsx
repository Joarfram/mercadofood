"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, Share2 } from "lucide-react";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome:'accepted'|'dismissed' }> };
export function InstallDriverApp(){
  const [prompt,setPrompt]=useState<InstallPrompt|null>(null);
  const [installed,setInstalled]=useState(false);
  const [isIos,setIsIos]=useState(false);
  useEffect(()=>{
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const handler=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt)};
    const installedHandler=()=>setInstalled(true);
    window.addEventListener('beforeinstallprompt',handler);
    window.addEventListener('appinstalled',installedHandler);
    return()=>{window.removeEventListener('beforeinstallprompt',handler);window.removeEventListener('appinstalled',installedHandler);};
  },[]);
  if(installed) return <p className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-center text-xs text-emerald-300"><CheckCircle2 size={16}/>Aplicativo instalado neste aparelho</p>;
  if(prompt) return <button onClick={async()=>{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setInstalled(true);setPrompt(null)}} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500 px-4 py-3 font-semibold text-emerald-300"><Download size={18}/>Instalar MercadoFood Entregador</button>;
  return <p className="rounded-xl bg-slate-900 p-3 text-center text-xs text-slate-400">{isIos ? <><Share2 className="mr-1 inline" size={15}/>No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</> : <>No Chrome, abra o menu ⋮ e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”.</>}</p>;
}
