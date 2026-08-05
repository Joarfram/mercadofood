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

  return <main className="space-y-6">
    <header>
      <p className="text-sm font-semibold text-emerald-700">Controle diário</p>
      <h1 className="text-3xl font-bold">Caixa e pagamentos</h1>
      <p className="text-gray-500">Venda no balcão, receba pedidos, controle o troco e faça o fechamento em uma única tela.</p>
    </header>

    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    {!session ? <section className="max-w-xl rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Abrir caixa</h2>
      <p className="mt-1 text-sm text-gray-500">Informe quanto existe em dinheiro no início do turno.</p>
      <form action={openCashSession} className="mt-5 space-y-4">
        <div><label className="text-sm font-semibold">Saldo inicial</label><input name="openingBalance" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 w-full rounded-xl border px-4 py-3" /></div>
        <button className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">Abrir caixa</button>
      </form>
    </section> : <>
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Vendas pagas hoje</p><strong className="text-2xl text-emerald-700">{money(totalSales)}</strong><p className="mt-1 text-sm text-gray-500">{paidOrders?.length || 0} pedidos</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Vendas em dinheiro</p><strong className="text-2xl">{money(cashSales)}</strong><p className="mt-1 text-sm text-gray-500">Entram no caixa físico</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Saídas manuais</p><strong className="text-2xl text-orange-600">{money(manualOut)}</strong><p className="mt-1 text-sm text-gray-500">Despesas, sangrias e estornos</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Saldo esperado</p><strong className="text-2xl text-emerald-700">{money(expectedCash)}</strong><p className="mt-1 text-sm text-gray-500">Saldo inicial + entradas − saídas</p></div>
      </section>

      <CashRegister sessionId={session.id} products={posProducts}/>

      <section id="pagamentos" className="scroll-mt-5 rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Pedidos e recebimentos</p><h2 className="text-2xl font-black">Pagamentos</h2><p className="text-sm text-gray-500">Os pendentes aparecem primeiro. Atualize a forma, o valor recebido e o status.</p></div><div className="rounded-2xl bg-orange-50 px-5 py-3 text-right"><p className="text-xs font-semibold text-orange-700">A receber</p><strong className="text-2xl text-orange-700">{money(pendingTotal)}</strong><p className="text-xs text-orange-700">{pendingPayments.length} pedido(s)</p></div></div>
        <div className="mt-5 space-y-3">
          {!orderedPayments.length && <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">Nenhum pagamento registrado.</p>}
          {orderedPayments.map(order => <details key={order.id} open={order.payment_status !== "paid" && order.payment_status !== "canceled"} className="rounded-2xl border bg-gray-50 p-4"><summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-emerald-700">Pedido #{order.order_number}</p><h3 className="truncate font-bold">{order.customer_name || "Cliente"}</h3></div><span className="rounded-full bg-white px-3 py-1 text-sm">{methodLabel[order.payment_method || ""] || "Forma não definida"}</span><span className={`rounded-full px-3 py-1 text-sm font-bold ${order.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>{paymentStatusLabel[order.payment_status] || order.payment_status}</span><strong className="text-lg">{money(order.total)}</strong></div></summary>
            <form action={updatePayment} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]"><input type="hidden" name="orderId" value={order.id}/><label className="text-xs font-semibold text-gray-600">Forma de pagamento<select name="method" defaultValue={order.payment_method || "pix"} className="mt-1 w-full rounded-xl border bg-white p-3 text-sm font-normal"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit_card">Cartão de débito</option><option value="credit_card">Cartão de crédito</option><option value="card_on_delivery">Cartão na entrega</option><option value="online_card">Cartão online</option><option value="other">Outro</option></select></label><label className="text-xs font-semibold text-gray-600">Status<select name="status" defaultValue={order.payment_status || "pending"} className="mt-1 w-full rounded-xl border bg-white p-3 text-sm font-normal"><option value="pending">Pendente</option><option value="paid">Pago</option><option value="canceled">Cancelado</option><option value="refunded">Estornado</option></select></label><label className="text-xs font-semibold text-gray-600">Valor recebido<input name="amountReceived" type="number" min="0" step="0.01" defaultValue={Number(order.amount_received || order.total)} className="mt-1 w-full rounded-xl border bg-white p-3 text-sm font-normal"/></label><button className="self-end rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Salvar pagamento</button></form>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">{Number(order.change_amount || 0) > 0 && <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-800">Troco: {money(order.change_amount)}</span>}<Link href={`/pagamentos/${order.id}`} className="font-semibold text-emerald-700">Gerar ou visualizar PIX →</Link></div>
          </details>)}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_430px]">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Registrar movimentação</h2>
            <form action={addCashMovement} className="mt-4 grid gap-3 md:grid-cols-2">
              <input type="hidden" name="sessionId" value={session.id} />
              <div><label className="text-xs font-semibold text-gray-600">Tipo</label><select name="movementType" className="mt-1 w-full rounded-lg border px-3 py-2"><option value="expense">Despesa</option><option value="withdrawal">Sangria</option><option value="deposit">Reforço</option><option value="income">Outra entrada</option><option value="refund">Estorno</option></select></div>
              <div><label className="text-xs font-semibold text-gray-600">Forma</label><select name="paymentMethod" className="mt-1 w-full rounded-lg border px-3 py-2"><option value="cash">Dinheiro</option><option value="pix">PIX</option><option value="card_on_delivery">Cartão</option><option value="other">Outro</option></select></div>
              <div><label className="text-xs font-semibold text-gray-600">Descrição</label><input name="description" required placeholder="Ex.: compra de gelo" className="mt-1 w-full rounded-lg border px-3 py-2" /></div>
              <div><label className="text-xs font-semibold text-gray-600">Valor</label><input name="amount" required type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-lg border px-3 py-2" /></div>
              <button className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white md:col-span-2">Registrar</button>
            </form>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Movimentações do caixa</h2>
            <div className="mt-4 space-y-3">
              {!movements?.length && <p className="text-sm text-gray-500">Nenhuma movimentação manual registrada.</p>}
              {movements?.map(m => <div key={m.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                <div><p className="font-semibold">{m.description}</p><p className="text-sm text-gray-500">{typeLabel[m.movement_type]} • {methodLabel[m.payment_method || ""] || "Sem forma"}</p></div>
                <strong className={outgoing.has(m.movement_type) ? "text-orange-600" : "text-emerald-700"}>{outgoing.has(m.movement_type) ? "− " : "+ "}{money(m.amount)}</strong>
              </div>)}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">Caixa aberto</p>
          <h2 className="text-xl font-bold">Fechamento</h2>
          <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
            <div className="flex justify-between"><span>Saldo inicial</span><strong>{money(opening)}</strong></div>
            <div className="flex justify-between"><span>Vendas em dinheiro</span><strong>{money(cashSales)}</strong></div>
            <div className="flex justify-between"><span>Entradas manuais</span><strong>{money(manualIn)}</strong></div>
            <div className="flex justify-between"><span>Saídas</span><strong>{money(manualOut)}</strong></div>
            <div className="flex justify-between border-t pt-2 text-base"><span>Esperado</span><strong>{money(expectedCash)}</strong></div>
          </div>
          <form action={closeCashSession} className="mt-5 space-y-3">
            <input type="hidden" name="sessionId" value={session.id} />
            <input type="hidden" name="expectedBalance" value={expectedCash.toFixed(2)} />
            <div><label className="text-sm font-semibold">Valor contado</label><input name="countedBalance" type="number" min="0" step="0.01" required className="mt-1 w-full rounded-xl border px-4 py-3" /></div>
            <div><label className="text-sm font-semibold">Observações</label><textarea name="notes" rows={3} className="mt-1 w-full rounded-xl border px-4 py-3" placeholder="Explique diferenças, quando necessário." /></div>
            <button className="w-full rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white">Fechar caixa</button>
          </form>
        </aside>
      </section>
    </>}
  </main>;
}
