import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getCurrentCompany } from "@/lib/auth/current-company";

const statusLabels: Record<string,string> = { new:"Novo", accepted:"Aceito", preparing:"Em preparo", ready:"Pronto", out_for_delivery:"Em entrega", delivered:"Entregue", canceled:"Cancelado" };
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(value);

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { company, user, supabase } = await getCurrentCompany();
  const ownerName = String(user.user_metadata?.full_name || user.email?.split("@")[0] || "Proprietário");
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6);
  const { data: weekOrders } = await supabase.from("orders").select("id, order_number, customer_name, status, total, created_at").eq("company_id", company.id).gte("created_at", weekStart.toISOString()).order("created_at", { ascending:false });
  const rows = weekOrders || [];
  const today = rows.filter(order => new Date(order.created_at) >= todayStart);
  const validToday = today.filter(order => order.status !== "canceled");
  const revenue = validToday.filter(order => order.status === "delivered").reduce((sum, order) => sum + Number(order.total || 0), 0);
  const inProduction = today.filter(order => ["new","accepted","preparing","ready"].includes(order.status)).length;
  const ticket = validToday.length ? validToday.reduce((sum, order) => sum + Number(order.total || 0), 0) / validToday.length : 0;
  const daily = Array.from({ length:7 }, (_, index) => { const date = new Date(weekStart); date.setDate(date.getDate()+index); const key = date.toISOString().slice(0,10); const total = rows.filter(order => order.created_at.slice(0,10) === key && order.status !== "canceled").reduce((sum, order) => sum + Number(order.total || 0), 0); return { key, label: date.toLocaleDateString("pt-BR", { weekday:"short" }), total }; });
  const max = Math.max(...daily.map(day => day.total), 1);

  return <div className="space-y-6">
    <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><p className="text-sm text-gray-500">{company.name}</p><h1 className="text-3xl font-bold">Olá, {ownerName} 👋</h1></div><span className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">Dados atualizados agora</span></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card title="Pedidos hoje" value={String(today.length)} detail="Pedidos recebidos desde 0h"/><Card title="Faturamento entregue" value={money(revenue)} detail="Somente pedidos concluídos hoje"/><Card title="Ticket médio" value={money(ticket)} detail="Média dos pedidos válidos"/><Card title="Na operação" value={String(inProduction)} detail="Novos, em preparo ou prontos"/></section>
    <section className="grid gap-4 xl:grid-cols-[2fr_1fr]"><Card><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Vendas dos últimos 7 dias</h2><span className="text-sm text-gray-500">Dados reais</span></div><div className="mt-6 flex h-56 items-end gap-3 rounded-xl border bg-emerald-50/40 p-4">{daily.map(day => <div key={day.key} className="flex h-full flex-1 flex-col justify-end text-center"><span className="mb-2 text-[10px] font-semibold text-emerald-800">{day.total ? money(day.total) : "—"}</span><div className="min-h-1 rounded-t-lg bg-emerald-600" style={{height:`${Math.max(3,(day.total/max)*78)}%`}}/><span className="mt-2 text-xs capitalize text-gray-500">{day.label}</span></div>)}</div></Card><Card><h2 className="text-lg font-bold">Mercadinho</h2><div className="mt-4 rounded-xl bg-emerald-50 p-4"><p className="font-semibold text-emerald-800">Próxima ação</p><p className="mt-2 text-sm text-gray-700">{today.length ? `Você recebeu ${today.length} pedido(s) hoje. Use promoções para fortalecer os horários de menor movimento.` : "Ainda não entrou pedido hoje. Confira se o cardápio está aberto e divulgue uma oferta."}</p><Link href="/promocoes" className="mt-4 inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Criar promoção</Link></div></Card></section>
    <Card><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Pedidos recentes</h2><Link href="/pedidos" className="text-sm font-semibold text-emerald-700">Ver todos</Link></div>{!rows.length ? <div className="mt-4 rounded-xl bg-gray-50 p-8 text-center text-gray-500">Nenhum pedido recebido nos últimos 7 dias.</div> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="text-sm text-gray-500"><tr><th className="pb-3">Pedido</th><th className="pb-3">Cliente</th><th className="pb-3">Status</th><th className="pb-3 text-right">Total</th></tr></thead><tbody>{rows.slice(0,8).map(order => <tr key={order.id} className="border-t"><td className="py-4 font-semibold">#{order.order_number}</td><td className="py-4">{order.customer_name || "Cliente"}</td><td className="py-4">{statusLabels[order.status] || order.status}</td><td className="py-4 text-right font-semibold">{money(Number(order.total || 0))}</td></tr>)}</tbody></table></div>}</Card>
  </div>;
}
