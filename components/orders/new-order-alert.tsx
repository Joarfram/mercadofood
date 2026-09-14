"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Sector = "counter" | "kitchen";
const labels: Record<Sector, string> = { counter: "Caixa", kitchen: "Cozinha" };
const ALERT_SOUND = "/sounds/vintage-phone-ringing.mp3";

export function NewOrderAlert({ companyId, sector, reloadOnOrder = false }: { companyId: string; sector: Sector; reloadOnOrder?: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [notice, setNotice] = useState("");
  const storageKey = `mercadofood-order-sound-${sector}`;

  useEffect(() => {
    setEnabled(window.localStorage.getItem(storageKey) === "on");
    const preload = new Audio(ALERT_SOUND);
    preload.preload = "auto";
  }, [storageKey]);

  const playAlert = useCallback(async (repetitions = 1) => {
    for (let index = 0; index < repetitions; index += 1) {
      const audio = new Audio(ALERT_SOUND);
      audio.volume = 1;
      audio.currentTime = 0;
      await new Promise<void>((resolve, reject) => {
        const finish = () => resolve();
        audio.addEventListener("ended", finish, { once: true });
        audio.addEventListener("error", () => reject(new Error("Falha ao reproduzir alerta")), { once: true });
        audio.play().catch(reject);
      });
    }
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
          try { await playAlert(2); setUnlocked(true); } catch { setUnlocked(false); }
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
