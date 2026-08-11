"use client";

import { useState } from "react";
import { CalendarDays, Download, Printer, X } from "lucide-react";

export type DailyReport = {
  date: string;
  sales: number;
  received: number;
  expenses: number;
  refunds: number;
  driverCost: number;
  net: number;
  paid: number;
  pending: number;
  canceled: number;
  orders: Array<{ number: string; time: string; status: string; paymentStatus: string; paymentMethod: string; serviceType: string; total: number }>;
  products: Array<{ name: string; quantity: number; total: number }>;
  payments: Array<{ name: string; total: number }>;
  services: Array<{ name: string; quantity: number }>;
};

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const paymentLabels: Record<string,string> = { pix:"PIX", cash:"Dinheiro", debit_card:"Cartão de débito", credit_card:"Cartão de crédito", card_on_delivery:"Cartão na entrega", online_card:"Cartão online", other:"Outro" };
const serviceLabels: Record<string,string> = { delivery:"Delivery", pickup:"Retirada", dine_in:"Consumo no local" };
const statusLabels: Record<string,string> = { paid:"Pago", pending:"Pendente", canceled:"Cancelado", refunded:"Estornado" };

export function MonthlyCalendar({ month, reports }: { month: string; reports: DailyReport[] }) {
  const [selected, setSelected] = useState<DailyReport | null>(null);
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const byDate = new Map(reports.map(report => [report.date, report]));
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  const maxRevenue = Math.max(1, ...reports.map(report => report.received));

  function downloadCsv(report: DailyReport) {
    const lines = [
      ["Relatório diário", report.date],
      ["Vendas válidas", report.sales.toFixed(2)], ["Recebido", report.received.toFixed(2)],
      ["Despesas", report.expenses.toFixed(2)], ["Estornos", report.refunds.toFixed(2)],
      ["Motoboys", report.driverCost.toFixed(2)], ["Resultado líquido", report.net.toFixed(2)], [],
      ["Pedido", "Horário", "Pagamento", "Forma", "Atendimento", "Valor"],
      ...report.orders.map(order => [order.number, order.time, statusLabels[order.paymentStatus] || order.paymentStatus, paymentLabels[order.paymentMethod] || order.paymentMethod, serviceLabels[order.serviceType] || order.serviceType, order.total.toFixed(2)]),
    ];
    const csv = lines.map(line => line.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `mercadofood-relatorio-${report.date}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <>
    <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><CalendarDays/></span><div><h2 className="text-xl font-bold">Calendário de faturamento</h2><p className="text-sm text-slate-500">Clique em um dia para abrir o relatório completo.</p></div></div>
      <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-slate-500 sm:gap-2">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(day => <div key={day} className="py-2">{day}</div>)}</div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">{cells.map((day, index) => {
        if (!day) return <div key={`empty-${index}`} className="min-h-20 sm:min-h-28"/>;
        const date = `${month}-${String(day).padStart(2,"0")}`;
        const report = byDate.get(date) || { date, sales:0, received:0, expenses:0, refunds:0, driverCost:0, net:0, paid:0, pending:0, canceled:0, orders:[], products:[], payments:[], services:[] };
        const hasMovement = report.orders.length > 0 || report.expenses > 0;
        return <button key={date} type="button" onClick={() => setSelected(report)} className={`min-h-20 rounded-xl border p-2 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md sm:min-h-28 sm:p-3 ${hasMovement ? "bg-white" : "bg-slate-50/70"}`}>
          <span className="text-sm font-bold text-slate-700">{day}</span><strong className={`mt-2 block text-[11px] sm:text-sm ${report.received ? "text-emerald-700" : "text-slate-400"}`}>{money(report.received)}</strong><span className="mt-1 block text-[10px] text-slate-500">{report.orders.length} pedido(s)</span>{report.received > 0 && <span className="mt-2 block h-1.5 rounded-full bg-emerald-100"><span className="block h-full rounded-full bg-emerald-600" style={{width:`${Math.max(8, report.received / maxRevenue * 100)}%`}}/></span>}
        </button>;
      })}</div>
    </section>

    {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 print:static print:bg-white print:p-0" role="dialog" aria-modal="true" aria-label={`Relatório de ${selected.date}`}>
      <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl print:max-h-none print:max-w-none print:shadow-none">
        <header className="flex items-center justify-between border-b px-5 py-4 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Relatório diário</p><h2 className="text-xl font-bold">{new Date(`${selected.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })}</h2></div><button onClick={() => setSelected(null)} className="rounded-full p-2 hover:bg-slate-100 print:hidden" aria-label="Fechar"><X/></button></header>
        <div className="overflow-y-auto p-5 sm:p-7 print:overflow-visible">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Vendas válidas" value={money(selected.sales)}/><Metric label="Faturamento recebido" value={money(selected.received)} tone="green"/><Metric label="Despesas + estornos" value={money(selected.expenses + selected.refunds)} tone="orange"/><Metric label="Resultado líquido" value={money(selected.net)} tone={selected.net >= 0 ? "green" : "orange"}/></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border p-4"><h3 className="font-bold">Resumo dos pedidos</h3><div className="mt-3 grid grid-cols-3 gap-2 text-center"><SmallMetric label="Pagos" value={selected.paid}/><SmallMetric label="Pendentes" value={selected.pending}/><SmallMetric label="Cancelados" value={selected.canceled}/></div><div className="mt-4 space-y-2">{selected.services.map(row => <Line key={row.name} label={serviceLabels[row.name] || row.name} value={String(row.quantity)}/>)}</div></section>
            <section className="rounded-2xl border p-4"><h3 className="font-bold">Formas de pagamento</h3><div className="mt-3 space-y-2">{!selected.payments.length && <p className="text-sm text-slate-500">Nenhum pagamento confirmado.</p>}{selected.payments.map(row => <Line key={row.name} label={paymentLabels[row.name] || row.name} value={money(row.total)}/>)}</div><div className="mt-3 border-t pt-3"><Line label="Taxas de motoboy" value={money(selected.driverCost)}/></div></section>
          </div>
          <section className="mt-5 rounded-2xl border p-4"><h3 className="font-bold">Produtos vendidos</h3><div className="mt-3 space-y-2">{!selected.products.length && <p className="text-sm text-slate-500">Nenhum produto vendido.</p>}{selected.products.map(product => <div key={product.name} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{product.name}</span><strong>{product.quantity} un.</strong><strong>{money(product.total)}</strong></div>)}</div></section>
          <section className="mt-5 overflow-hidden rounded-2xl border"><div className="border-b bg-slate-50 px-4 py-3"><h3 className="font-bold">Pedidos do dia</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Pedido</th><th>Horário</th><th>Pagamento</th><th>Forma</th><th>Atendimento</th><th className="pr-3 text-right">Valor</th></tr></thead><tbody>{selected.orders.map(order => <tr key={`${order.number}-${order.time}`} className="border-b last:border-0"><td className="p-3 font-bold">#{order.number}</td><td>{order.time}</td><td>{statusLabels[order.paymentStatus] || order.paymentStatus}</td><td>{paymentLabels[order.paymentMethod] || order.paymentMethod}</td><td>{serviceLabels[order.serviceType] || order.serviceType}</td><td className="pr-3 text-right font-bold">{money(order.total)}</td></tr>)}{!selected.orders.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum pedido neste dia.</td></tr>}</tbody></table></div></section>
        </div>
        <footer className="flex flex-wrap justify-end gap-3 border-t px-5 py-4 print:hidden"><button onClick={() => downloadCsv(selected)} className="flex items-center gap-2 rounded-xl border px-4 py-3 font-semibold"><Download size={17}/>Baixar CSV</button><button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white"><Printer size={17}/>Imprimir relatório</button></footer>
      </div>
    </div>}
  </>;
}

function Metric({label,value,tone}:{label:string;value:string;tone?:"green"|"orange"}) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><strong className={`mt-1 block text-xl ${tone === "green" ? "text-emerald-700" : tone === "orange" ? "text-orange-600" : "text-slate-900"}`}>{value}</strong></div>; }
function SmallMetric({label,value}:{label:string;value:number}) { return <div className="rounded-xl bg-slate-50 p-3"><strong className="block text-lg">{value}</strong><span className="text-xs text-slate-500">{label}</span></div>; }
function Line({label,value}:{label:string;value:string}) { return <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{label}</span><strong>{value}</strong></div>; }
