"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bike, CheckCircle2, Clock3, MapPin, PackageCheck, RefreshCw, Store } from "lucide-react";

type TrackingLocation = {
  latitude: number;
  longitude: number;
  accuracy_meters?: number | null;
  recorded_at: string;
};

type TrackingData = {
  tracking_code: string;
  status: string;
  order_number: string;
  customer_name: string;
  driver_name?: string | null;
  delivery_address?: { neighborhood?: string | null; city?: string | null } | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
  last_location?: TrackingLocation | null;
  events?: Array<{ type: string; created_at: string }>;
};

const steps = [
  { key: "preparing", label: "Preparando", icon: Store },
  { key: "waiting_pickup", label: "Aguardando retirada", icon: PackageCheck },
  { key: "delivering", label: "Saiu para entrega", icon: Bike },
  { key: "completed", label: "Entregue", icon: CheckCircle2 },
];

const statusRank: Record<string, number> = {
  waiting_assignment: 0,
  offered: 0,
  accepted: 0,
  to_store: 0,
  waiting_pickup: 1,
  delivering: 2,
  completed: 3,
};

function timeLabel(value?: string | null) {
  if (!value) return "Ainda não atualizado";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function relativeLabel(value?: string | null) {
  if (!value) return "sem localização";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 15) return "agora";
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `há ${minutes} min`;
}

export function CustomerTracking({ code }: { code: string }) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/rastreamento/${encodeURIComponent(code)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar o rastreamento.");
      setData(payload);
      setError("");
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o rastreamento.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const currentRank = statusRank[data?.status || "waiting_assignment"] ?? 0;
  const mapUrl = useMemo(() => {
    const loc = data?.last_location;
    if (!loc) return null;
    const delta = 0.008;
    const bbox = [loc.longitude - delta, loc.latitude - delta, loc.longitude + delta, loc.latitude + delta].join(",");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${loc.latitude}%2C${loc.longitude}`;
  }, [data?.last_location]);

  if (loading) {
    return <div className="rounded-3xl bg-white p-8 text-center shadow-sm"><RefreshCw className="mx-auto animate-spin text-emerald-600"/><p className="mt-3 text-slate-600">Buscando sua entrega...</p></div>;
  }

  if (!data) {
    return <div className="rounded-3xl bg-white p-8 text-center shadow-sm"><MapPin className="mx-auto text-red-500" size={38}/><h2 className="mt-3 text-xl font-bold">Não encontramos a entrega</h2><p className="mt-2 text-slate-600">{error || "Confira o código recebido da loja."}</p><button onClick={load} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white">Tentar novamente</button></div>;
  }

  const isCompleted = data.status === "completed";
  const isDelivering = data.status === "delivering";

  return <div className="space-y-4">
    <section className="rounded-3xl bg-emerald-700 p-6 text-white shadow-sm">
      <p className="text-sm text-emerald-100">Pedido #{data.order_number}</p>
      <h1 className="mt-1 text-2xl font-bold">{isCompleted ? "Pedido entregue!" : isDelivering ? "Seu pedido está a caminho" : "Estamos preparando sua entrega"}</h1>
      <p className="mt-2 text-sm text-emerald-100">Olá, {data.customer_name}. Esta página atualiza automaticamente.</p>
    </section>

    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = index <= currentRank;
          return <div key={step.key} className="text-center">
            <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}><Icon size={18}/></div>
            <p className={`mt-2 text-[11px] font-semibold leading-tight ${active ? "text-emerald-700" : "text-slate-400"}`}>{step.label}</p>
          </div>;
        })}
      </div>
    </section>

    <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
      {mapUrl && isDelivering ? <iframe title="Localização aproximada do entregador" src={mapUrl} className="h-72 w-full border-0" loading="lazy"/> : <div className="flex h-64 flex-col items-center justify-center bg-slate-100 px-6 text-center"><Bike size={44} className="text-emerald-600"/><h2 className="mt-3 font-bold">{isCompleted ? "Entrega finalizada" : "O mapa aparecerá após a retirada"}</h2><p className="mt-1 text-sm text-slate-500">A localização é compartilhada somente durante a entrega.</p></div>}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm text-slate-500">Entregador</p><p className="font-bold">{data.driver_name || "Aguardando definição"}</p></div>
          <div className="text-right"><p className="text-sm text-slate-500">Última posição</p><p className="font-semibold">{relativeLabel(data.last_location?.recorded_at)}</p></div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-orange-50 p-3 text-sm text-orange-800"><MapPin size={18}/><span>{data.delivery_address?.neighborhood || "Seu endereço"}{data.delivery_address?.city ? `, ${data.delivery_address.city}` : ""}</span></div>
      </div>
    </section>

    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><div><h2 className="font-bold">Atualização automática</h2><p className="text-sm text-slate-500">Consulta a cada 10 segundos</p></div><button onClick={load} className="rounded-full bg-slate-100 p-3 text-slate-600" aria-label="Atualizar agora"><RefreshCw size={18}/></button></div>
      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Clock3 size={16}/><span>Atualizado às {lastRefresh ? timeLabel(lastRefresh.toISOString()) : "—"}</span></div>
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>

    <p className="px-4 text-center text-xs text-slate-500">Por segurança, a posição exibida é aproximada e deixa de ser compartilhada após a entrega.</p>
  </div>;
}
