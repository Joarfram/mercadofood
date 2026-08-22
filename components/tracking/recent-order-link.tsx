"use client";

import { useEffect, useState } from "react";
import { Clock3, PackageCheck, X } from "lucide-react";

export type RecentPublicOrder = { publicCode: string; orderNumber: string | number; total: number; createdAt: string };
const storageKey = (slug: string) => `mercadofood:recent-order:${slug}`;

export function rememberPublicOrder(slug: string, order: RecentPublicOrder) {
  try { window.localStorage.setItem(storageKey(slug), JSON.stringify(order)); } catch { /* O link da confirmação continua funcionando. */ }
}

export function RecentOrderLink({ slug }: { slug: string }) {
  const [order, setOrder] = useState<RecentPublicOrder | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(slug));
      if (!raw) return;
      const saved = JSON.parse(raw) as RecentPublicOrder;
      if (saved.publicCode && saved.orderNumber) setOrder(saved);
    } catch { window.localStorage.removeItem(storageKey(slug)); }
  }, [slug]);
  if (!order) return null;
  return <aside className="mx-auto mt-4 max-w-7xl px-4 md:px-6"><div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-slate-900 shadow-sm">
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-500 text-white"><PackageCheck size={22}/></span>
    <a href={`/acompanhar/${encodeURIComponent(order.publicCode)}`} className="min-w-0 flex-1"><strong className="block">Você tem o pedido #{order.orderNumber}</strong><span className="mt-0.5 flex items-center gap-1 text-sm text-orange-800"><Clock3 size={14}/> Ver andamento e atualizações</span></a>
    <button type="button" onClick={() => { window.localStorage.removeItem(storageKey(slug)); setOrder(null); }} className="rounded-full p-2 text-slate-500 hover:bg-orange-100" aria-label="Ocultar pedido deste aparelho"><X size={18}/></button>
  </div></aside>;
}
