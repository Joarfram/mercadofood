import Link from "next/link";
import { requirePlanModule } from "@/lib/auth/current-company";
import { addCashMovement, closeCashSession, openCashSession } from "./actions";
import { CashRegister } from "@/components/pos/cash-register";
import { updatePayment } from "@/app/(dashboard)/pagamentos/actions";

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

const outgoing = new Set(["expense", "withdrawal", "refund"]);
const typeLabel: Record<string, string> = {
  sale: "Venda", income: "Entrada", expense: "Despesa", withdrawal: "Sangria", deposit: "Reforço", refund: "Estorno",
};
const methodLabel: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", debit_card: "Cartão de débito", credit_card: "Cartão de crédito", card_on_delivery: "Cartão", online_card: "Cartão online", other: "Outro",
};
const paymentStatusLabel: Record<string, string> = { pending: "Pendente", paid: "Pago", canceled: "Cancelado", refunded: "Estornado" };

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("finance");
  const { data: session } = await supabase.from("cash_sessions")
    .select("*").eq("company_id", company.id).eq("status", "open").maybeSingle();

  const { data: movements } = session
    ? await supabase.from("cash_movements").select("*").eq("cash_session_id", session.id).order("occurred_at", { ascending: false })
    : { data: [] as any[] };

  const { data: paidOrders } = session ? await supabase.from("orders")
    .select("id,total,payment_method,paid_at,created_at")
    .eq("company_id", company.id).eq("cash_session_id", session.id).eq("payment_status", "paid") : { data: [] as any[] };

  const { data: availableProducts } = session ? await supabase.from("products")
    .select("id,name,base_price,promotional_price,category_id,categories(name)")
    .eq("company_id", company.id).eq("availability_status", "available").order("name") : { data: [] as any[] };
  const posProducts = (availableProducts || []).map(product => {
    const relatedCategory = Array.isArray(product.categories) ? product.categories[0] : product.categories;
    return { id: product.id, name: product.name, price: Number(product.promotional_price || product.base_price), category: relatedCategory?.name || "Sem categoria" };
  });

  const { data: recentOrders } = await supabase.from("orders")
    .select("id,order_number,customer_name,total,payment_method,payment_status,amount_received,change_amount,created_at")
    .eq("company_id", company.id).order("created_at", { ascending: false }).limit(30);
  const orderedPayments = [...(recentOrders || [])].sort((a, b) => Number(a.payment_status === "paid") - Number(b.payment_status === "paid"));
  const pendingPayments = orderedPayments.filter(order => order.payment_status !== "paid" && order.payment_status !== "canceled");
  const pendingTotal = pendingPayments.reduce((sum, order) => sum + Number(order.total || 0), 0);

  const opening = Number(session?.opening_balance || 0);
  const manualIn = (movements || []).filter(m => !outgoing.has(m.movement_type)).reduce((s, m) => s + Number(m.amount), 0);
  const manualOut = (movements || []).filter(m => outgoing.has(m.movement_type)).reduce((s, m) => s + Number(m.amount), 0);
  const cashSales = (paidOrders || []).filter(o => o.payment_method === "cash").reduce((s, o) => s + Number(o.total), 0);
  const totalSales = (paidOrders || []).reduce((s, o) => s + Number(o.total), 0);
  const expectedCash = opening + cashSales + manualIn - manualOut;

  return <main className="min-w-0 max-w-full space-y-6 pb-10">
    <section className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Financeiro operacional</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Caixa e pagamentos</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">Venda no balcão, receba pedidos, controle troco, entradas, saídas e fechamento da {company.name}.</p></div>
        <div className="flex flex-wrap gap-2"><span className={`rounded-full px-4 py-2 text-sm font-bold ${session?"bg-emerald-400/15 text-emerald-200":"bg-white/10 text-slate-200"}`}>{session?"● Caixa aberto":"● Caixa fechado"}</span>{session&&<a href="#pagamentos" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-950">Ir para pagamentos</a>}</div>
      </div>
    </section>

    {query.erro && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">{query.sucesso}</div>}

    {!session ? <section className="mx-auto max-w-2xl rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Início do turno</p><h2 className="mt-1 text-2xl font-black">Abrir caixa</h2><p className="mt-2 text-sm text-slate-500">Informe quanto existe em dinheiro no início do turno para o sistema acompanhar o saldo esperado.</p>
      <form action={openCashSession} className="mt-6 space-y-4"><div><label className="text-sm font-semibold">Saldo inicial</label><input name="openingBalance" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 w-full rounded-xl border px-4 py-3 text-lg" /></div><button className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Abrir caixa</button></form>
    </section> : <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Vendas pagas" value={money(totalSales)} detail={`${paidOrders?.length || 0} pedidos`} tone="emerald"/>
        <Metric label="Dinheiro no caixa" value={money(cashSales)} detail="Vendas recebidas em espécie"/>
        <Metric label="Saídas manuais" value={money(manualOut)} detail="Despesas, sangrias e estornos" tone="orange"/>
        <Metric label="Saldo esperado" value={money(expectedCash)} detail="Saldo inicial + entradas − saídas" tone="emerald"/>
      </section>

      <section className="rounded-3xl border bg-white p-3 shadow-sm sm:p-5"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Venda rápida</p><h2 className="text-2xl font-black">Balcão / PDV</h2></div><CashRegister sessionId={session.id} products={posProducts}/></section>

      <section id="pagamentos" className="min-w-0 max-w-full scroll-mt-5 overflow-hidden rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Recebimentos</p><h2 className="text-2xl font-black">Pagamentos</h2><p className="mt-1 text-sm text-slate-500">Pendentes aparecem primeiro para facilitar o fechamento rápido do pedido.</p></div><div className="rounded-2xl bg-orange-50 px-5 py-3 md:text-right"><p className="text-xs font-semibold text-orange-700">A receber</p><strong className="text-2xl text-orange-700">{money(pendingTotal)}</strong><p className="text-xs text-orange-700">{pendingPayments.length} pedido(s)</p></div></div>
        <div className="mt-5 space-y-3">{!orderedPayments.length && <p className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">Nenhum pagamento registrado.</p>}{orderedPayments.map(order => <details key={order.id} open={order.payment_status !== "paid" && order.payment_status !== "canceled"} className="overflow-hidden rounded-2xl border bg-slate-50"><summary className="cursor-pointer list-none p-4 sm:p-5"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-wide text-emerald-700">Pedido #{order.order_number}</p><h3 className="mt-1 truncate text-lg font-black">{order.customer_name || "Cliente"}</h3></div><span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{methodLabel[order.payment_method || ""] || "Forma não definida"}</span><span className={`rounded-full px-3 py-1 text-sm font-bold ${order.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>{paymentStatusLabel[order.payment_status] || order.payment_status}</span><strong className="text-xl">{money(order.total)}</strong></div></summary>
            <div className="border-t bg-white p-4 sm:p-5"><form action={updatePayment} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]"><input type="hidden" name="orderId" value={order.id}/><label className="text-xs font-semibold text-slate-600">Forma de pagamento<select name="method" defaultValue={order.payment_method || "pix"} className="mt-1 w-full rounded-xl border bg-white p-3 text-sm font-normal"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit_card">Cartão de débito</option><option value="credit_card">Cartão de crédito</option><option value="card_on_delivery">Cartão na entrega</option><option value="online_card">Cartão online</option><option value="other">Outro</option></select></label><label className="text-xs font-semibold text-slate-600">Status<select name="status" defaultValue={order.payment_status || "pending"} className="mt-1 w-full rounded-xl border bg-white p-3 text-sm font-normal"><option value="pending">Pendente</option><option value="paid">Pago</option><option value="canceled">Cancelado</option><option value="refunded">Estornado</option></select></label><label className="text-xs font-semibold text-slate-600">Valor recebido<input name="amountReceived" type="number" min="0" step="0.01" defaultValue={Number(order.amount_received || order.total)} className="mt-1 w-full rounded-xl border bg-white p-3 text-sm font-normal"/></label><button className="self-end rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Salvar pagamento</button></form><div className="mt-3 flex flex-wrap items-center gap-3 text-sm">{Number(order.change_amount || 0) > 0 && <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-800">Troco: {money(order.change_amount)}</span>}<Link href={`/pagamentos/${order.id}`} className="font-bold text-emerald-700">Gerar ou visualizar PIX →</Link></div></div>
          </details>)}</div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Movimentação manual</p><h2 className="mt-1 text-xl font-black">Registrar entrada ou saída</h2><form action={addCashMovement} className="mt-5 grid gap-3 md:grid-cols-2"><input type="hidden" name="sessionId" value={session.id} /><div><label className="text-xs font-semibold text-slate-600">Tipo</label><select name="movementType" className="mt-1 w-full rounded-xl border px-3 py-3"><option value="expense">Despesa</option><option value="withdrawal">Sangria</option><option value="deposit">Reforço</option><option value="income">Outra entrada</option><option value="refund">Estorno</option></select></div><div><label className="text-xs font-semibold text-slate-600">Forma</label><select name="paymentMethod" className="mt-1 w-full rounded-xl border px-3 py-3"><option value="cash">Dinheiro</option><option value="pix">PIX</option><option value="card_on_delivery">Cartão</option><option value="other">Outro</option></select></div><div><label className="text-xs font-semibold text-slate-600">Descrição</label><input name="description" required placeholder="Ex.: compra de gelo" className="mt-1 w-full rounded-xl border px-3 py-3" /></div><div><label className="text-xs font-semibold text-slate-600">Valor</label><input name="amount" required type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-xl border px-3 py-3" /></div><button className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white md:col-span-2">Registrar movimentação</button></form></div>

          <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black">Movimentações do caixa</h2><div className="mt-4 space-y-3">{!movements?.length && <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Nenhuma movimentação manual registrada.</p>}{movements?.map(m => <div key={m.id} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4"><div><p className="font-bold">{m.description}</p><p className="text-sm text-slate-500">{typeLabel[m.movement_type]} • {methodLabel[m.payment_method || ""] || "Sem forma"}</p></div><strong className={outgoing.has(m.movement_type) ? "text-orange-600" : "text-emerald-700"}>{outgoing.has(m.movement_type) ? "− " : "+ "}{money(m.amount)}</strong></div>)}</div></div>
        </div>

        <aside className="h-fit rounded-3xl border bg-slate-950 p-5 text-white shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Caixa aberto</p><h2 className="mt-1 text-2xl font-black">Fechamento</h2><div className="mt-5 space-y-3 rounded-2xl bg-white/10 p-4 text-sm"><div className="flex justify-between"><span className="text-slate-300">Saldo inicial</span><strong>{money(opening)}</strong></div><div className="flex justify-between"><span className="text-slate-300">Vendas em dinheiro</span><strong>{money(cashSales)}</strong></div><div className="flex justify-between"><span className="text-slate-300">Entradas manuais</span><strong>{money(manualIn)}</strong></div><div className="flex justify-between"><span className="text-slate-300">Saídas</span><strong>{money(manualOut)}</strong></div><div className="flex justify-between border-t border-white/15 pt-3 text-base"><span>Esperado</span><strong className="text-emerald-300">{money(expectedCash)}</strong></div></div><form action={closeCashSession} className="mt-5 space-y-3"><input type="hidden" name="sessionId" value={session.id} /><input type="hidden" name="expectedBalance" value={expectedCash.toFixed(2)} /><div><label className="text-sm font-semibold">Valor contado</label><input name="countedBalance" type="number" min="0" step="0.01" required className="mt-1 w-full rounded-xl border border-white/15 bg-white px-4 py-3 text-slate-950" /></div><div><label className="text-sm font-semibold">Observações</label><textarea name="notes" rows={3} className="mt-1 w-full rounded-xl border border-white/15 bg-white px-4 py-3 text-slate-950" placeholder="Explique diferenças, quando necessário." /></div><button className="w-full rounded-xl bg-white px-5 py-3 font-black text-slate-950">Fechar caixa</button></form></aside>
      </section>
    </>}
  </main>;
}

function Metric({label,value,detail,tone="slate"}:{label:string;value:string;detail:string;tone?:"slate"|"emerald"|"orange"}) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "orange" ? "text-orange-600" : "text-slate-950";
  return <div className="rounded-3xl border bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><strong className={`mt-2 block text-3xl font-black ${color}`}>{value}</strong><p className="mt-2 text-xs text-slate-500">{detail}</p></div>;
}
