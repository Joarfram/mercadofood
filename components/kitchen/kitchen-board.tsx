"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Clock3, ChefHat, CheckCircle2, PackageCheck, RefreshCw, Search, Truck } from "lucide-react";
import { advanceKitchenOrder } from "@/app/(dashboard)/cozinha/actions";
import { NewOrderAlert } from "@/components/orders/new-order-alert";

export type KitchenOrder = {
  id: string;
  order_number: number | string;
  customer_name: string | null;
  status: string;
  service_type: string;
  notes: string | null;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  ready_at: string | null;
  order_items: { product_name: string; quantity: number }[];
};

const columns = [
  { key: "new", title: "Novos", hint: "Aguardando aceite", icon: Clock3 },
  { key: "accepted", title: "Aceitos", hint: "Na fila da cozinha", icon: PackageCheck },
  { key: "preparing", title: "Em preparo", hint: "Produção em andamento", icon: ChefHat },
  { key: "ready", title: "Prontos", hint: "Aguardando retirada", icon: CheckCircle2 },
] as const;

const nextStep: Record<string, { status: string; label: string }> = {
  new: { status: "accepted", label: "Aceitar pedido" },
  accepted: { status: "preparing", label: "Iniciar preparo" },
  preparing: { status: "ready", label: "Marcar como pronto" },
  ready: { status: "out_for_delivery", label: "Enviar para entrega" },
};

const serviceLabel: Record<string, string> = {
  delivery: "Delivery",
  pickup: "Retirada",
  dine_in: "Salão",
};

function elapsed(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min`;
}

export function KitchenBoard({ initialOrders, companyId }: { initialOrders: KitchenOrder[]; companyId: string }) {
  const [orders, setOrders] = useState(initialOrders);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => setOrders(initialOrders), [initialOrders]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return orders;
    return orders.filter((order) =>
      String(order.order_number).toLowerCase().includes(text) ||
      (order.customer_name || "").toLowerCase().includes(text) ||
      order.order_items.some((item) => item.product_name.toLowerCase().includes(text))
    );
  }, [orders, query]);

  function advance(order: KitchenOrder) {
    const step = nextStep[order.status];
    if (!step) return;
    const formData = new FormData();
    formData.set("orderId", order.id);
    formData.set("currentStatus", order.status);
    formData.set("nextStatus", step.status);
    setUpdatingId(order.id);
    setFeedback(null);
    startTransition(async () => {
      const result = await advanceKitchenOrder(formData);
      if (result?.ok) {
        setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: step.status } : item));
        setFeedback({ type: "success", message: `Pedido #${order.order_number} atualizado com sucesso.` });
      } else {
        setFeedback({ type: "error", message: result?.message || "Não foi possível atualizar o pedido." });
      }
      setUpdatingId(null);
    });
  }

  return <div className="space-y-5">
    <NewOrderAlert companyId={companyId} sector="kitchen" reloadOnOrder/>
    {feedback && <div role="status" className={`rounded-xl border p-4 font-semibold ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{feedback.message}</div>}
    <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pedido, cliente ou produto" className="w-full rounded-xl border py-3 pl-10 pr-3" />
      </div>
      <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold text-gray-700">
        <RefreshCw className="h-4 w-4" /> Atualizar
      </button>
    </div>

    <div className="grid gap-5 xl:grid-cols-4">
      {columns.map((column) => {
        const Icon = column.icon;
        const items = filtered.filter((order) => order.status === column.key);
        return <section key={column.key} className="min-h-[440px] rounded-2xl border bg-gray-50 p-3">
          <header className="mb-3 flex items-center justify-between px-1">
            <div><h2 className="flex items-center gap-2 font-bold"><Icon className="h-5 w-5 text-emerald-700" />{column.title}</h2><p className="text-xs text-gray-500">{column.hint}</p></div>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm">{items.length}</span>
          </header>
          <div className="space-y-3">
            {items.length === 0 && <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-gray-400">Nenhum pedido nesta fila.</div>}
            {items.map((order) => {
              const step = nextStep[order.status];
              return <article key={order.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-bold text-emerald-700">Pedido #{order.order_number}</p><h3 className="font-bold">{order.customer_name || "Cliente"}</h3></div>
                  <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">{elapsed(order.created_at)}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-gray-500">{serviceLabel[order.service_type] || order.service_type}</p>
                <div className="my-3 space-y-1 rounded-xl bg-gray-50 p-3 text-sm">
                  {order.order_items.map((item, index) => <p key={`${item.product_name}-${index}`}><strong>{item.quantity}×</strong> {item.product_name}</p>)}
                </div>
                {order.notes && <p className="mb-3 rounded-lg bg-yellow-50 p-2 text-xs text-yellow-900"><strong>Observação:</strong> {order.notes}</p>}
                {step && <button disabled={isPending && updatingId === order.id} onClick={() => advance(order)} className="w-full rounded-xl bg-emerald-700 px-3 py-2.5 font-semibold text-white disabled:opacity-60">
                  {isPending && updatingId === order.id ? "Atualizando..." : step.label}
                </button>}
                {order.status === "ready" && <p className="mt-2 flex items-center justify-center gap-1 text-xs text-gray-500"><Truck className="h-3.5 w-3.5" /> Próxima etapa: entrega</p>}
              </article>;
            })}
          </div>
        </section>;
      })}
    </div>
  </div>;
}
