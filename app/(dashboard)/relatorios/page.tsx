import Link from "next/link";
import { requirePlanModule } from "@/lib/auth/current-company";
import { MonthlyCalendar, type DailyReport } from "./monthly-calendar";

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
function percent(value: number) { return `${value.toFixed(1)}%`; }
function isoStart(date: string) { return new Date(`${date}T00:00:00`).toISOString(); }
function isoEnd(date: string) { return new Date(`${date}T23:59:59.999`).toISOString(); }

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const query = await searchParams;
  const today = new Date();
  const requestedMonth = /^\d{4}-\d{2}$/.test(query.mes || "") ? query.mes! : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,"0")}`;
  const [year, monthNumber] = requestedMonth.split("-").map(Number);
  const inicio = `${requestedMonth}-01`;
  const fim = `${requestedMonth}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2,"0")}`;
  const previousDate = new Date(year, monthNumber - 2, 1);
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2,"0")}`;
  const previousStart = `${previousMonth}-01`;
  const previousEnd = `${previousMonth}-${String(new Date(previousDate.getFullYear(), previousDate.getMonth() + 1, 0).getDate()).padStart(2,"0")}`;
  const { supabase, company } = await requirePlanModule("reports");

  const [{ data: orders }, { data: previousOrders }, { data: deliveries }, { data: movements }] = await Promise.all([
    supabase.from("orders").select("id,order_number,status,payment_status,payment_method,total,discount,delivery_fee,service_type,created_at,delivered_at,canceled_at").eq("company_id", company.id).gte("created_at", isoStart(inicio)).lte("created_at", isoEnd(fim)).order("created_at", { ascending: false }),
    supabase.from("orders").select("status,payment_status,total").eq("company_id", company.id).gte("created_at", isoStart(previousStart)).lte("created_at", isoEnd(previousEnd)),
    supabase.from("deliveries").select("id,status,delivery_value,created_at,completed_at,driver:drivers(name)").eq("company_id", company.id).gte("created_at", isoStart(inicio)).lte("created_at", isoEnd(fim)),
    supabase.from("cash_movements").select("movement_type,amount,occurred_at").eq("company_id", company.id).gte("occurred_at", isoStart(inicio)).lte("occurred_at", isoEnd(fim)),
  ]);

  const ids = (orders || []).map(o => o.id);
  const { data: items } = ids.length ? await supabase.from("order_items")
    .select("order_id,product_name,quantity,total_price").eq("company_id", company.id).in("order_id", ids) : { data: [] as any[] };
  const valid = (orders || []).filter(o => o.status !== "canceled");
  const paid = valid.filter(o => o.payment_status === "paid");
  const revenue = paid.reduce((s,o) => s + Number(o.total), 0);
  const previousRevenue = (previousOrders || []).filter(o => o.status !== "canceled" && o.payment_status === "paid").reduce((sum,o) => sum + Number(o.total), 0);
  const revenueChange = previousRevenue ? (revenue - previousRevenue) / previousRevenue * 100 : revenue ? 100 : 0;
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
  const monthlyExpenses = (movements || []).filter(movement => movement.movement_type === "expense").reduce((sum,movement) => sum + Number(movement.amount), 0);
  const monthlyRefunds = (movements || []).filter(movement => movement.movement_type === "refund").reduce((sum,movement) => sum + Number(movement.amount), 0);
  const monthlyDriverCost = completedDeliveries.reduce((sum,delivery) => sum + Number(delivery.delivery_value || 0), 0);
  const monthlyNet = revenue - monthlyExpenses - monthlyRefunds - monthlyDriverCost;
  const avgMinutes = completedDeliveries.length ? completedDeliveries.reduce((sum,d)=> {
    if (!d.completed_at) return sum;
    return sum + (new Date(d.completed_at).getTime()-new Date(d.created_at).getTime())/60000;
  },0)/completedDeliveries.length : 0;

  const dailyReports: DailyReport[] = days.map(([date]) => {
    const dayOrders = (orders || []).filter(order => order.created_at.slice(0,10) === date);
    const validOrders = dayOrders.filter(order => order.status !== "canceled");
    const paidOrders = validOrders.filter(order => order.payment_status === "paid");
    const dayMovements = (movements || []).filter(movement => movement.occurred_at.slice(0,10) === date);
    const expenses = dayMovements.filter(movement => movement.movement_type === "expense").reduce((sum,movement) => sum + Number(movement.amount), 0);
    const refunds = dayMovements.filter(movement => movement.movement_type === "refund").reduce((sum,movement) => sum + Number(movement.amount), 0);
    const dayDeliveries = completedDeliveries.filter(delivery => delivery.created_at.slice(0,10) === date);
    const driverCost = dayDeliveries.reduce((sum,delivery) => sum + Number(delivery.delivery_value || 0), 0);
    const productTotals = new Map<string,{quantity:number,total:number}>();
    const dayOrderIds = new Set(validOrders.map(order => order.id));
    for (const item of items || []) if (dayOrderIds.has(item.order_id)) {
      const current = productTotals.get(item.product_name) || { quantity:0, total:0 };
      current.quantity += Number(item.quantity); current.total += Number(item.total_price); productTotals.set(item.product_name, current);
    }
    const payments = new Map<string,number>();
    for (const order of paidOrders) payments.set(order.payment_method || "other", (payments.get(order.payment_method || "other") || 0) + Number(order.total));
    const services = new Map<string,number>();
    for (const order of validOrders) services.set(order.service_type || "other", (services.get(order.service_type || "other") || 0) + 1);
    const received = paidOrders.reduce((sum,order) => sum + Number(order.total), 0);
    return {
      date,
      sales: validOrders.reduce((sum,order) => sum + Number(order.total), 0),
      received, expenses, refunds, driverCost, net: received - expenses - refunds - driverCost,
      paid: paidOrders.length,
      pending: validOrders.filter(order => order.payment_status !== "paid" && order.payment_status !== "canceled" && order.payment_status !== "refunded").length,
      canceled: dayOrders.filter(order => order.status === "canceled").length,
      orders: dayOrders.map(order => ({ number: order.order_number, time: new Date(order.created_at).toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"}), status: order.status, paymentStatus: order.payment_status, paymentMethod: order.payment_method || "other", serviceType: order.service_type || "other", total: Number(order.total) })),
      products: [...productTotals.entries()].map(([name,value]) => ({ name, ...value })).sort((a,b) => b.quantity - a.quantity),
      payments: [...payments.entries()].map(([name,total]) => ({name,total})).sort((a,b) => b.total - a.total),
      services: [...services.entries()].map(([name,quantity]) => ({name,quantity})),
    };
  });

  return <main className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-semibold text-emerald-700">Indicadores do negócio</p><h1 className="text-3xl font-bold">Relatórios</h1><p className="text-gray-500">Acompanhe vendas, produtos, pagamentos e entregas por período.</p></div>
      <form className="flex flex-wrap items-end gap-2 rounded-2xl border bg-white p-3 shadow-sm">
        <label className="text-xs font-semibold text-gray-600">Mês do relatório<input name="mes" type="month" defaultValue={requestedMonth} className="mt-1 block rounded-lg border px-3 py-2" /></label>
        <button className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Ver mês</button>
      </form>
    </header>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <Card label="Faturamento recebido" value={money(revenue)} note={`${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}% sobre o mês anterior`} />
      <Card label="Ticket médio" value={money(ticket)} note="Por pedido pago" />
      <Card label="Pedidos" value={String(orders?.length || 0)} note={`${delivered} entregues`} />
      <Card label="Cancelamento" value={percent(cancelRate)} note={`${canceled} cancelados`} tone="orange" />
      <Card label="Tempo médio entrega" value={avgMinutes ? `${Math.round(avgMinutes)} min` : "—"} note={`${completedDeliveries.length} concluídas`} />
      <Card label="Resultado líquido" value={money(monthlyNet)} note="Recebido menos despesas, estornos e motoboys" tone={monthlyNet < 0 ? "orange" : undefined} />
    </section>

    <MonthlyCalendar month={requestedMonth} reports={dailyReports}/>

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
