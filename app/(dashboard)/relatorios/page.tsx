import Link from "next/link";
import { requirePlanModule } from "@/lib/auth/current-company";

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
function percent(value: number) { return `${value.toFixed(1)}%`; }
function isoStart(date: string) { return new Date(`${date}T00:00:00`).toISOString(); }
function isoEnd(date: string) { return new Date(`${date}T23:59:59.999`).toISOString(); }

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ inicio?: string; fim?: string }> }) {
  const query = await searchParams;
  const today = new Date();
  const defaultStart = new Date(today); defaultStart.setDate(today.getDate() - 29);
  const inicio = query.inicio || defaultStart.toISOString().slice(0,10);
  const fim = query.fim || today.toISOString().slice(0,10);
  const { supabase, company } = await requirePlanModule("reports");

  const { data: orders } = await supabase.from("orders")
    .select("id,order_number,status,payment_status,payment_method,total,delivery_fee,service_type,created_at,delivered_at,canceled_at")
    .eq("company_id", company.id).gte("created_at", isoStart(inicio)).lte("created_at", isoEnd(fim)).order("created_at", { ascending: false });

  const ids = (orders || []).map(o => o.id);
  const { data: items } = ids.length ? await supabase.from("order_items")
    .select("order_id,product_name,quantity,total_price").eq("company_id", company.id).in("order_id", ids) : { data: [] as any[] };
  const { data: deliveries } = await supabase.from("deliveries")
    .select("id,status,delivery_value,created_at,completed_at,driver:drivers(name)")
    .eq("company_id", company.id).gte("created_at", isoStart(inicio)).lte("created_at", isoEnd(fim));

  const valid = (orders || []).filter(o => o.status !== "canceled");
  const paid = valid.filter(o => o.payment_status === "paid");
  const revenue = paid.reduce((s,o) => s + Number(o.total), 0);
  const ticket = paid.length ? revenue / paid.length : 0;
  const delivered = valid.filter(o => o.status === "delivered").length;
  const canceled = (orders || []).filter(o => o.status === "canceled").length;
  const cancelRate = orders?.length ? canceled / orders.length * 100 : 0;

  const productMap = new Map<string,{qty:number,total:number}>();
  for (const item of items || []) {
    const row = productMap.get(item.product_name) || {qty:0,total:0};
    row.qty += Number(item.quantity); row.total += Number(item.total_price); productMap.set(item.product_name,row);
  }
  const topProducts = [...productMap.entries()].sort((a,b)=>b[1].qty-a[1].qty).slice(0,8);
  const maxQty = Math.max(1, ...topProducts.map(([,v])=>v.qty));

  const methodMap = new Map<string,number>();
  for (const o of paid) methodMap.set(o.payment_method || "other", (methodMap.get(o.payment_method || "other") || 0) + Number(o.total));
  const methodLabels: Record<string,string> = {pix:"PIX",cash:"Dinheiro",debit_card:"Cartão de débito",credit_card:"Cartão de crédito",card_on_delivery:"Cartão na entrega",online_card:"Cartão online",other:"Outro"};

  const dayMap = new Map<string,{orders:number,revenue:number}>();
  for (const o of orders || []) {
    const day = o.created_at.slice(0,10); const row = dayMap.get(day) || {orders:0,revenue:0};
    row.orders += 1; if (o.payment_status === "paid" && o.status !== "canceled") row.revenue += Number(o.total); dayMap.set(day,row);
  }
  const days = [...dayMap.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const maxDayRevenue = Math.max(1,...days.map(([,v])=>v.revenue));

  const completedDeliveries = (deliveries || []).filter(d => d.status === "completed");
  const avgMinutes = completedDeliveries.length ? completedDeliveries.reduce((sum,d)=> {
    if (!d.completed_at) return sum;
    return sum + (new Date(d.completed_at).getTime()-new Date(d.created_at).getTime())/60000;
  },0)/completedDeliveries.length : 0;

  return <main className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-semibold text-emerald-700">Indicadores do negócio</p><h1 className="text-3xl font-bold">Relatórios</h1><p className="text-gray-500">Acompanhe vendas, produtos, pagamentos e entregas por período.</p></div>
      <form className="flex flex-wrap items-end gap-2 rounded-2xl border bg-white p-3 shadow-sm">
        <label className="text-xs font-semibold text-gray-600">Início<input name="inicio" type="date" defaultValue={inicio} className="mt-1 block rounded-lg border px-3 py-2" /></label>
        <label className="text-xs font-semibold text-gray-600">Fim<input name="fim" type="date" defaultValue={fim} className="mt-1 block rounded-lg border px-3 py-2" /></label>
        <button className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Aplicar</button>
      </form>
    </header>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Card label="Faturamento recebido" value={money(revenue)} note={`${paid.length} pedidos pagos`} />
      <Card label="Ticket médio" value={money(ticket)} note="Por pedido pago" />
      <Card label="Pedidos" value={String(orders?.length || 0)} note={`${delivered} entregues`} />
      <Card label="Cancelamento" value={percent(cancelRate)} note={`${canceled} cancelados`} tone="orange" />
      <Card label="Tempo médio entrega" value={avgMinutes ? `${Math.round(avgMinutes)} min` : "—"} note={`${completedDeliveries.length} concluídas`} />
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Vendas por dia</h2><p className="text-sm text-gray-500">Faturamento de pedidos pagos</p></div></div>
        <div className="mt-6 flex h-64 items-end gap-2 overflow-x-auto border-b px-2">
          {!days.length && <p className="m-auto text-sm text-gray-500">Sem dados no período.</p>}
          {days.map(([day,v]) => <div key={day} className="flex min-w-10 flex-1 flex-col items-center justify-end gap-2" title={`${day}: ${money(v.revenue)}`}>
            <span className="text-[10px] font-semibold text-gray-500">{v.revenue ? money(v.revenue).replace("R$ ","") : "0"}</span>
            <div className="w-full rounded-t-lg bg-emerald-600" style={{height:`${Math.max(4,(v.revenue/maxDayRevenue)*180)}px`}} />
            <span className="pb-2 text-[10px] text-gray-500">{day.slice(8,10)}/{day.slice(5,7)}</span>
          </div>)}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Formas de pagamento</h2><p className="text-sm text-gray-500">Valores efetivamente recebidos</p>
        <div className="mt-5 space-y-4">
          {!methodMap.size && <p className="text-sm text-gray-500">Sem pagamentos no período.</p>}
          {[...methodMap.entries()].sort((a,b)=>b[1]-a[1]).map(([method,value]) => <div key={method}>
            <div className="mb-1 flex justify-between text-sm"><span>{methodLabels[method] || method}</span><strong>{money(value)}</strong></div>
            <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-orange-500" style={{width:`${revenue ? value/revenue*100 : 0}%`}} /></div>
          </div>)}
        </div>
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Produtos mais vendidos</h2><p className="text-sm text-gray-500">Ranking por quantidade</p>
        <div className="mt-5 space-y-4">
          {!topProducts.length && <p className="text-sm text-gray-500">Sem itens vendidos no período.</p>}
          {topProducts.map(([name,v],i)=><div key={name} className="grid grid-cols-[28px_1fr_auto] items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">{i+1}</span>
            <div><div className="flex justify-between gap-3"><span className="font-semibold">{name}</span><span className="text-sm text-gray-500">{v.qty} un.</span></div><div className="mt-1 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-emerald-600" style={{width:`${v.qty/maxQty*100}%`}} /></div></div>
            <strong className="text-sm">{money(v.total)}</strong>
          </div>)}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Resumo operacional</h2>
        <div className="mt-4 space-y-3 text-sm">
          <Row label="Delivery" value={String(valid.filter(o=>o.service_type==="delivery").length)} />
          <Row label="Retirada" value={String(valid.filter(o=>o.service_type==="pickup").length)} />
          <Row label="Salão" value={String(valid.filter(o=>o.service_type==="dine_in").length)} />
          <Row label="Taxas de entrega" value={money(paid.reduce((s,o)=>s+Number(o.delivery_fee),0))} />
          <Row label="Entregas concluídas" value={String(completedDeliveries.length)} />
          <Row label="Valor dos motoboys" value={money(completedDeliveries.reduce((s,d)=>s+Number(d.delivery_value),0))} />
        </div>
        <Link href="/financeiro" className="mt-5 inline-flex rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white">Abrir caixa financeiro</Link>
      </div>
    </section>
  </main>;
}

function Card({label,value,note,tone}:{label:string;value:string;note:string;tone?:"orange"}) {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{label}</p><strong className={`mt-1 block text-2xl ${tone === "orange" ? "text-orange-600" : "text-emerald-700"}`}>{value}</strong><p className="mt-1 text-sm text-gray-500">{note}</p></div>;
}
function Row({label,value}:{label:string;value:string}) { return <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"><span>{label}</span><strong>{value}</strong></div>; }
