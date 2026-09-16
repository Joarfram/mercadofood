import Link from "next/link";
import { requirePlanModule } from "@/lib/auth/current-company";

const statusLabels: Record<string,string> = { delivered:"Entregue", canceled:"Cancelado" };
const paymentLabels: Record<string,string> = { paid:"Pago", pending:"Pendente", canceled:"Cancelado", refunded:"Estornado" };
const methodLabels: Record<string,string> = { pix:"PIX", cash:"Dinheiro", debit_card:"Débito", credit_card:"Crédito", card_on_delivery:"Cartão na entrega", online_card:"Cartão online", other:"Outro" };
const serviceLabels: Record<string,string> = { delivery:"Delivery", pickup:"Retirada", dine_in:"Salão", counter:"Balcão", table:"Mesa", other:"Outro" };

function money(value: number | string | null) {
  return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number(value || 0));
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short", timeZone:"America/Sao_Paulo" }).format(new Date(value));
}

export default async function HistoricoPedidosPage({ searchParams }: { searchParams: Promise<{ q?:string; inicio?:string; fim?:string; status?:string }> }) {
  const params = await searchParams;
  const { supabase, company } = await requirePlanModule("orders");
  const q = (params.q || "").trim();
  const status = params.status === "canceled" ? "canceled" : params.status === "delivered" ? "delivered" : "";

  let query = supabase
    .from("orders")
    .select("id,order_number,customer_name,customer_phone,status,service_type,total,payment_method,payment_status,created_at")
    .eq("company_id", company.id)
    .in("status", status ? [status] : ["delivered","canceled"])
    .order("created_at", { ascending:false })
    .limit(300);

  if (params.inicio) query = query.gte("created_at", `${params.inicio}T00:00:00-03:00`);
  if (params.fim) query = query.lte("created_at", `${params.fim}T23:59:59-03:00`);
  if (q) {
    const safe = q.replace(/[,%()]/g, " ").trim();
    if (safe) query = query.or(`customer_name.ilike.%${safe}%,customer_phone.ilike.%${safe}%`);
  }

  const { data: orders, error } = await query;
  const total = (orders || []).reduce((sum, order) => sum + (order.payment_status === "paid" ? Number(order.total || 0) : 0), 0);

  return <main className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold text-emerald-700">Arquivo operacional</p><h1 className="text-3xl font-bold">Histórico de pedidos</h1><p className="text-gray-500">Pedidos concluídos saem da operação, mas permanecem disponíveis para consulta.</p></div>
      <Link href="/pedidos" className="inline-flex rounded-xl border bg-white px-4 py-2 font-semibold text-emerald-800 shadow-sm">Voltar para pedidos</Link>
    </header>

    <form className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
      <input name="q" defaultValue={q} placeholder="Cliente ou telefone" className="rounded-xl border px-3 py-2.5"/>
      <input type="date" name="inicio" defaultValue={params.inicio || ""} className="rounded-xl border px-3 py-2.5"/>
      <input type="date" name="fim" defaultValue={params.fim || ""} className="rounded-xl border px-3 py-2.5"/>
      <select name="status" defaultValue={status} className="rounded-xl border px-3 py-2.5"><option value="">Entregues e cancelados</option><option value="delivered">Entregues</option><option value="canceled">Cancelados</option></select>
      <button className="rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white">Filtrar</button>
    </form>

    <section className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-gray-500">Pedidos encontrados</p><strong className="text-2xl">{orders?.length || 0}</strong></div><div className="rounded-2xl border bg-white p-4"><p className="text-sm text-gray-500">Total pago no resultado</p><strong className="text-2xl">{money(total)}</strong></div></section>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">Não foi possível carregar o histórico. Atualize a página e tente novamente.</div>}
    {!error && !orders?.length && <div className="rounded-2xl border bg-white p-8 text-gray-500">Nenhum pedido encontrado com esses filtros.</div>}

    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-gray-50 text-gray-600"><tr><th className="p-3">Pedido</th><th className="p-3">Data</th><th className="p-3">Cliente</th><th className="p-3">Atendimento</th><th className="p-3">Status</th><th className="p-3">Pagamento</th><th className="p-3 text-right">Valor</th></tr></thead><tbody>{orders?.map(order => <tr key={order.id} className="border-t"><td className="p-3 font-semibold">#{order.order_number}</td><td className="p-3">{dateTime(order.created_at)}</td><td className="p-3"><div className="font-semibold">{order.customer_name || "Cliente"}</div><div className="text-xs text-gray-500">{order.customer_phone || "Sem telefone"}</div></td><td className="p-3">{serviceLabels[order.service_type] || order.service_type}</td><td className="p-3">{statusLabels[order.status] || order.status}</td><td className="p-3"><div>{paymentLabels[order.payment_status] || order.payment_status}</div><div className="text-xs text-gray-500">{methodLabels[order.payment_method] || order.payment_method || "Não informado"}</div></td><td className="p-3 text-right font-semibold">{money(order.total)}</td></tr>)}</tbody></table></div>
    </div>
  </main>;
}
