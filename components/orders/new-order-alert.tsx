"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Sector = "counter" | "kitchen";
const labels: Record<Sector, string> = { counter: "Caixa", kitchen: "Cozinha" };
const ALERT_SOUND = "/sounds/vintage-phone-ringing.mp3";

export function NewOrderAlert({ companyId, sector, reloadOnOrder = false }: { companyId: string; sector: Sector; reloadOnOrder?: boolean }) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [notice, setNotice] = useState("");
  const storageKey = `mercadofood-order-sound-${sector}`;

  useEffect(() => {
    setEnabled(window.localStorage.getItem(storageKey) === "on");
    const audio = new Audio(ALERT_SOUND);
    audio.preload = "auto";
    audio.volume = 1;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [storageKey]);

  const playAlert = useCallback(async () => {
    const audio = audioRef.current || new Audio(ALERT_SOUND);
    audioRef.current = audio;
    audio.volume = 1;
    audio.currentTime = 0;
    await audio.play();
  }, []);

  async function toggleSound() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(storageKey, next ? "on" : "off");
    if (next) {
      try {
        await playAlert();
        setUnlocked(true);
        setNotice(`Som da ${labels[sector]} ativado`);
      } catch {
        setUnlocked(false);
        setNotice("Clique novamente para liberar o som no navegador");
      }
    } else {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      setUnlocked(false);
      setNotice(`Som da ${labels[sector]} desligado`);
    }
  }

  useEffect(() => {
    let supabase;
    try { supabase = createClient(); } catch { return; }
    const channel = supabase
      .channel(`new-order-alert-${sector}-${companyId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` }, async (payload) => {
        const orderNumber = String((payload.new as { order_number?: string | number }).order_number || "");
        setNotice(`Novo pedido${orderNumber ? ` #${orderNumber}` : ""}!`);
        if (enabled) {
          try { await playAlert(); setUnlocked(true); } catch { setUnlocked(false); }
        }
        if (reloadOnOrder) window.setTimeout(() => window.location.reload(), 9500);
        else router.refresh();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [companyId, enabled, playAlert, reloadOnOrder, router, sector]);

  return <div className="mf-dark-banner flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--mf-primary-dark)] bg-[var(--mf-primary-dark)] p-3 text-sm text-white">
    <button type="button" onClick={toggleSound} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold text-white ${enabled && unlocked ? "bg-emerald-700" : "bg-slate-700"}`}>
      {enabled && unlocked ? <Volume2 size={18}/> : enabled ? <Bell size={18}/> : <BellOff size={18}/>}
      {enabled && unlocked ? `Som da ${labels[sector]} ativo` : enabled ? "Clique para liberar o som" : `Ativar som da ${labels[sector]}`}
    </button>
    <span className="font-semibold text-white" aria-live="assertive">{notice || "Mantenha esta página aberta para receber novos pedidos."}</span>
  </div>;
}
