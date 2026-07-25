import { getCurrentCompany } from "@/lib/auth/current-company";
import { addCashMovement, closeCashSession, openCashSession } from "./actions";

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

const outgoing = new Set(["expense", "withdrawal", "refund"]);
const typeLabel: Record<string, string> = {
  sale: "Venda", income: "Entrada", expense: "Despesa", withdrawal: "Sangria", deposit: "Reforço", refund: "Estorno",
};
const methodLabel: Record<string, string> = {
  pix: "PIX", cash: "Dinheiro", card_on_delivery: "Cartão", online_card: "Cartão online", other: "Outro",
};

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  const { data: session } = await supabase.from("cash_sessions")
    .select("*").eq("company_id", company.id).eq("status", "open").maybeSingle();

  const { data: movements } = session
    ? await supabase.from("cash_movements").select("*").eq("cash_session_id", session.id).order("occurred_at", { ascending: false })
    : { data: [] as any[] };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: paidOrders } = await supabase.from("orders")
    .select("id,total,payment_method,paid_at,created_at")
    .eq("company_id", company.id).eq("payment_status", "paid")
    .gte("paid_at", today.toISOString());

  const opening = Number(session?.opening_balance || 0);
  const manualIn = (movements || []).filter(m => !outgoing.has(m.movement_type)).reduce((s, m) => s + Number(m.amount), 0);
  const manualOut = (movements || []).filter(m => outgoing.has(m.movement_type)).reduce((s, m) => s + Number(m.amount), 0);
  const cashSales = (paidOrders || []).filter(o => o.payment_method === "cash").reduce((s, o) => s + Number(o.total), 0);
  const totalSales = (paidOrders || []).reduce((s, o) => s + Number(o.total), 0);
  const expectedCash = opening + cashSales + manualIn - manualOut;

  return <main className="space-y-6">
    <header>
      <p className="text-sm font-semibold text-emerald-700">Controle diário</p>
      <h1 className="text-3xl font-bold">Caixa e Financeiro</h1>
      <p className="text-gray-500">Abra o caixa, registre entradas e despesas e confira o fechamento.</p>
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
