"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Sector = "counter" | "kitchen";
const labels: Record<Sector, string> = { counter: "Caixa", kitchen: "Cozinha" };

export function NewOrderAlert({ companyId, sector, reloadOnOrder = false }: { companyId: string; sector: Sector; reloadOnOrder?: boolean }) {
  const router = useRouter();
  const audioContext = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [notice, setNotice] = useState("");
  const storageKey = `mercadofood-order-sound-${sector}`;

  useEffect(() => { setEnabled(window.localStorage.getItem(storageKey) === "on"); }, [storageKey]);

  const context = useCallback(() => {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext.current ||= new AudioContextClass();
    return audioContext.current;
  }, []);

  const playAlert = useCallback(async () => {
    const ctx = context();
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();
    const start = ctx.currentTime;
    [0, 0.32, 0.64].forEach((offset, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = index === 1 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.25);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.27);
    });
  }, [context]);

  async function toggleSound() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(storageKey, next ? "on" : "off");
    if (next) {
      await playAlert();
      setUnlocked(true);
      setNotice(`Som da ${labels[sector]} ativado`);
    } else {
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
        if (reloadOnOrder) window.setTimeout(() => window.location.reload(), 1400);
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
