import Link from "next/link";
import { requirePlanModule } from "@/lib/auth/current-company";
import { updatePayment } from "./actions";

const methodLabel: Record<string,string> = {
  pix: "PIX",
  cash: "Dinheiro",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
  card_on_delivery: "Cartão na entrega",
  online_card: "Cartão online",
  other: "Outro",
};
const statusLabel: Record<string,string> = { pending:"Pendente", paid:"Pago", canceled:"Cancelado", refunded:"Estornado" };
function money(value: number | string | null) { return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number(value || 0)); }

export default async function PagamentosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("payments");
  const { data: orders } = await supabase.from("orders")
    .select("id,order_number,customer_name,total,payment_method,payment_status,amount_received,change_amount,created_at")
    .eq("company_id", company.id)
    .order("created_at", { ascending:false }).limit(60);

  const paid = (orders || []).filter(o => o.payment_status === "paid");
  const pending = (orders || []).filter(o => o.payment_status !== "paid" && o.payment_status !== "canceled");
  const totalPaid = paid.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalPending = pending.reduce((sum, o) => sum + Number(o.total || 0), 0);

  return <main className="space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">Controle financeiro do pedido</p><h1 className="text-3xl font-bold">Pagamentos</h1><p className="text-gray-500">Registre PIX, dinheiro, cartão e confira o troco.</p></header>
    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Recebido</p><strong className="text-2xl text-emerald-700">{money(totalPaid)}</strong><p className="mt-1 text-sm text-gray-500">{paid.length} pagamentos</p></div>
      <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Pendente</p><strong className="text-2xl text-orange-600">{money(totalPending)}</strong><p className="mt-1 text-sm text-gray-500">{pending.length} pedidos</p></div>
      <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Pedidos consultados</p><strong className="text-2xl">{orders?.length || 0}</strong><p className="mt-1 text-sm text-gray-500">Últimos registros</p></div>
    </section>

    <section className="space-y-3">
      {!orders?.length && <div className="rounded-2xl border bg-white p-8 text-gray-500">Nenhum pedido disponível.</div>}
      {orders?.map(order => <article key={order.id} className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[1fr_560px] xl:items-center">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Pedido #{order.order_number}</p>
            <h2 className="text-xl font-bold">{order.customer_name || "Cliente"}</h2>
            <p className="mt-1 text-2xl font-bold">{money(order.total)}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-gray-100 px-3 py-1">{methodLabel[order.payment_method || ""] || "Forma não definida"}</span><span className={`rounded-full px-3 py-1 font-semibold ${order.payment_status === "paid" ? "bg-emerald-50 text-emerald-800" : "bg-orange-50 text-orange-800"}`}>{statusLabel[order.payment_status] || order.payment_status}</span>{Number(order.change_amount || 0) > 0 && <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">Troco: {money(order.change_amount)}</span>}</div><Link href={`/pagamentos/${order.id}`} className="mt-3 inline-flex rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700">Gerar ou visualizar PIX</Link>
          </div>
          <form action={updatePayment} className="grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-4">
            <input type="hidden" name="orderId" value={order.id}/>
            <div><label className="text-xs font-semibold text-gray-600">Forma</label><select name="method" defaultValue={order.payment_method || "pix"} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit_card">Cartão de débito</option><option value="credit_card">Cartão de crédito</option><option value="card_on_delivery">Cartão na entrega</option><option value="online_card">Cartão online</option><option value="other">Outro</option></select></div>
            <div><label className="text-xs font-semibold text-gray-600">Status</label><select name="status" defaultValue={order.payment_status || "pending"} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="pending">Pendente</option><option value="paid">Pago</option><option value="canceled">Cancelado</option><option value="refunded">Estornado</option></select></div>
            <div><label className="text-xs font-semibold text-gray-600">Valor recebido</label><input name="amountReceived" type="number" min="0" step="0.01" defaultValue={Number(order.amount_received || order.total)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></div>
            <button className="self-end rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Salvar</button>
          </form>
        </div>
      </article>)}
    </section>
  </main>;
}
