import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, ImageIcon, Package, Store } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { toggleStoreStatus } from "./actions";

const TZ = "America/Sao_Paulo";
const statusLabels: Record<string,string> = { new:"Novo", accepted:"Aceito", preparing:"Em preparo", ready:"Pronto", out_for_delivery:"Em entrega", delivered:"Entregue", canceled:"Cancelado" };
const statusClasses: Record<string,string> = { new:"bg-amber-100 text-amber-800", accepted:"bg-orange-100 text-orange-800", preparing:"bg-orange-100 text-orange-800", ready:"bg-blue-100 text-blue-800", out_for_delivery:"bg-indigo-100 text-indigo-800", delivered:"bg-emerald-100 text-emerald-800", canceled:"bg-red-100 text-red-800" };
const paymentLabels: Record<string,string> = { pix:"PIX", cash:"Dinheiro", debit_card:"Débito", credit_card:"Crédito", card_on_delivery:"Cartão na entrega", online_card:"Cartão online", other:"Outro" };
const serviceLabels: Record<string,string> = { delivery:"Delivery", pickup:"Retirada", dine_in:"No local", table:"Mesa" };
const money = (value:number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
const dateKey = (date:Date) => new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const localHour = (value:string) => Number(new Intl.DateTimeFormat("pt-BR",{timeZone:TZ,hour:"2-digit",hour12:false}).format(new Date(value)));
const localTime = (value:string) => new Intl.DateTimeFormat("pt-BR",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}).format(new Date(value));

function comparison(current:number,previous:number,suffix="") { if(!previous)return current?`Ontem: 0${suffix}`:"Sem alteração em relação a ontem"; const percent=Math.round(((current-previous)/previous)*100); return `${percent>=0?"↑":"↓"} ${Math.abs(percent)}% comparado a ontem`; }
function isScheduledOpen(branchOpen:boolean,hours:Array<{weekday:number;is_open:boolean;opens_at:string|null;closes_at:string|null}>) {
  if(!branchOpen)return false; if(!hours.length)return true;
  const now=new Date(); const short=new Intl.DateTimeFormat("en-US",{timeZone:TZ,weekday:"short"}).format(now); const weekday=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(short);
  const time=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now);
  const today=hours.find(row=>row.weekday===weekday); const previous=hours.find(row=>row.weekday===(weekday+6)%7);
  const todayOpen=Boolean(today?.is_open&&today.opens_at&&today.closes_at&&(today.opens_at===today.closes_at||(today.opens_at<today.closes_at?time>=today.opens_at&&time<today.closes_at:time>=today.opens_at)));
  const overnight=Boolean(previous?.is_open&&previous.opens_at&&previous.closes_at&&previous.opens_at>previous.closes_at&&time<previous.closes_at);
  return todayOpen||overnight;
}

export const dynamic="force-dynamic";
export default async function DashboardPage({searchParams}:{searchParams:Promise<{erro?:string;sucesso?:string}>}) {
  const query=await searchParams; const {company,user,role,supabase}=await getCurrentCompany(); const now=new Date();
  const ownerName=String(user.user_metadata?.full_name||user.email?.split("@")[0]||"Proprietário");
  const keys=Array.from({length:8},(_,index)=>{const date=new Date(now);date.setUTCDate(date.getUTCDate()-(7-index));return dateKey(date);});
  const todayKey=keys[7], yesterdayKey=keys[6]; const fetchStart=new Date(now);fetchStart.setUTCDate(fetchStart.getUTCDate()-9);
  const [ordersResult,productsResult,branchesResult,hoursResult,pixResult]=await Promise.all([
    supabase.from("orders").select("id,order_number,customer_name,status,payment_status,payment_method,service_type,total,created_at").eq("company_id",company.id).gte("created_at",fetchStart.toISOString()).order("created_at",{ascending:false}),
    supabase.from("products").select("id,name,image_url,track_stock,stock_quantity,minimum_stock,is_active").eq("company_id",company.id).eq("is_active",true),
    supabase.from("branches").select("id,is_open").eq("company_id",company.id), supabase.from("business_hours").select("weekday,is_open,opens_at,closes_at").eq("company_id",company.id),
    supabase.from("company_pix_settings").select("is_active").eq("company_id",company.id).maybeSingle(),
  ]);
  const rows=ordersResult.data||[], products=productsResult.data||[], week=rows.filter(order=>keys.slice(1).includes(dateKey(new Date(order.created_at)))); const orderIds=week.filter(order=>order.status!=="canceled").map(order=>order.id);
  const itemsResult=orderIds.length?await supabase.from("order_items").select("order_id,product_id,product_name,quantity,total_price").eq("company_id",company.id).in("order_id",orderIds):{data:[],error:null};
  const today=rows.filter(order=>dateKey(new Date(order.created_at))===todayKey), yesterday=rows.filter(order=>dateKey(new Date(order.created_at))===yesterdayKey);
  const valid=(list:typeof rows)=>list.filter(order=>order.status!=="canceled"); const completedRevenue=(list:typeof rows)=>list.filter(order=>order.status==="delivered").reduce((sum,order)=>sum+Number(order.total||0),0); const average=(list:typeof rows)=>valid(list).length?valid(list).reduce((sum,order)=>sum+Number(order.total||0),0)/valid(list).length:0;
  const revenue=completedRevenue(today), ticket=average(today), inProgress=today.filter(order=>["new","accepted","preparing","ready"].includes(order.status)).length;
  const manualOpen=(branchesResult.data||[]).some(branch=>branch.is_open), isOpen=isScheduledOpen(manualOpen,hoursResult.data||[]), canToggle=["owner","manager"].includes(role);
  const daily=keys.slice(1).map(key=>{const list=week.filter(order=>dateKey(new Date(order.created_at))===key&&order.status!=="canceled");const date=new Date(`${key}T12:00:00-03:00`);return{key,label:new Intl.DateTimeFormat("pt-BR",{weekday:"short",timeZone:TZ}).format(date),date:new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",timeZone:TZ}).format(date),total:list.reduce((sum,order)=>sum+Number(order.total||0),0),orders:list.length};});
  const weekTotal=daily.reduce((sum,day)=>sum+day.total,0), bestDay=daily.reduce((best,day)=>day.total>best.total?day:best,daily[0]), max=Math.max(...daily.map(day=>day.total),0);
  const lowStock=products.filter(product=>product.track_stock&&Number(product.stock_quantity||0)<=Number(product.minimum_stock||0)), withoutPhoto=products.filter(product=>!product.image_url), overdue=rows.filter(order=>["new","accepted","preparing"].includes(order.status)&&now.getTime()-new Date(order.created_at).getTime()>15*60*1000);
  const alerts=[lowStock.length?{href:"/estoque",text:`${lowStock.length} produto(s) com estoque baixo`}:null,withoutPhoto.length?{href:"/produtos",text:`${withoutPhoto.length} produto(s) sem foto`}:null,overdue.length?{href:"/pedidos",text:`${overdue.length} pedido(s) aguardando há mais de 15 minutos`}:null,pixResult.data&&!pixResult.data.is_active?{href:"/configuracoes/pix",text:"Configuração PIX está inativa"}:null].filter(Boolean) as Array<{href:string;text:string}>;
  const recentAverage=average(week); const suggestion=lowStock.length?{text:`${lowStock.length} produto(s) estão com estoque baixo.`,href:"/estoque",label:"Ver estoque"}:withoutPhoto.length?{text:`Você possui ${withoutPhoto.length} produto(s) sem foto. Boas imagens ajudam na decisão de compra.`,href:"/produtos",label:"Adicionar fotos"}:ticket>0&&recentAverage>0&&ticket<recentAverage?{text:`Seu ticket médio está em ${money(ticket)}. Um combo pode ajudar a aumentar o valor dos pedidos.`,href:"/combos",label:"Criar combo"}:{text:today.length?"Use promoções para fortalecer os horários de menor movimento.":"Ainda não entrou pedido hoje. Que tal divulgar uma promoção?",href:"/promocoes",label:"Criar promoção"};
  const productMap=new Map(products.map(product=>[product.id,product])); const topMap=new Map<string,{key:string;name:string;quantity:number;revenue:number;image:string|null}>();
  for(const item of itemsResult.data||[]){const key=item.product_id||item.product_name,current=topMap.get(key)||{key,name:item.product_name,quantity:0,revenue:0,image:item.product_id?productMap.get(item.product_id)?.image_url||null:null};current.quantity+=Number(item.quantity||0);current.revenue+=Number(item.total_price||0);topMap.set(key,current);} const topProducts=[...topMap.values()].sort((a,b)=>b.quantity-a.quantity).slice(0,5);
  const hourCounts=Array.from({length:24},(_,hour)=>({hour,count:valid(week).filter(order=>localHour(order.created_at)===hour).length})).filter(row=>row.count>0), peak=hourCounts.reduce((best,row)=>row.count>best.count?row:best,{hour:0,count:0}), hourMax=Math.max(...hourCounts.map(row=>row.count),1);
  const hasErrors=[ordersResult,productsResult,branchesResult,hoursResult,itemsResult].some(result=>result.error);

  return <main className="min-w-0 space-y-6 pb-10">
    <section className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Visão geral da operação</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Olá, {ownerName}</h1><p className="mt-2 text-sm text-slate-300">{company.name} • dados atualizados agora</p></div>
        <div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-4 py-2 text-sm font-bold ${isOpen?"bg-emerald-400/15 text-emerald-200":"bg-red-400/15 text-red-200"}`}>{isOpen?"● Loja aberta":"● Loja fechada"}</span>{canToggle&&<form action={toggleStoreStatus}><input type="hidden" name="open" value={String(!manualOpen)}/><button className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">{manualOpen?"Fechar loja":"Abrir loja"}</button></form>}</div>
      </div>
    </section>

    {query.erro&&<p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{query.erro}</p>}{query.sucesso&&<p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{query.sucesso}</p>}{hasErrors&&<p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Algumas métricas não puderam ser carregadas. O restante do Dashboard continua disponível.</p>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Pedidos hoje" value={String(today.length)} detail={comparison(today.length,yesterday.length," pedidos")}/>
      <Metric label="Faturamento hoje" value={money(revenue)} detail={comparison(revenue,completedRevenue(yesterday))}/>
      <Metric label="Ticket médio" value={money(ticket)} detail={comparison(ticket,average(yesterday))}/>
      <Metric label="Em andamento" value={String(inProgress)} detail="Novos, aceitos, em preparo ou prontos"/>
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Desempenho</p><h2 className="text-2xl font-black text-slate-900">Vendas dos últimos 7 dias</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Dados reais</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label="Total" value={money(weekTotal)}/><Mini label="Média diária" value={`${money(weekTotal/7)}/dia`}/><Mini label="Melhor dia" value={bestDay?.label||"—"}/></div>
        <div className="mt-6 flex h-64 items-end gap-2 rounded-2xl bg-slate-50 p-4 sm:gap-3">{daily.map(day=><div key={day.key} title={`${day.date} • ${day.orders} pedido(s) • ${money(day.total)}`} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center"><span className="mb-2 truncate text-[9px] font-bold text-slate-600 sm:text-[10px]">{day.total?money(day.total):"—"}</span><div className="rounded-t-xl bg-emerald-600" style={{height:day.total&&max?`${Math.max((day.total/max)*78,5)}%`:"2%"}}/><span className="mt-2 truncate text-[10px] capitalize text-slate-500 sm:text-xs">{day.label}</span></div>)}</div>
      </div>

      <div className="space-y-5">
        <div className="rounded-3xl border bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Próxima ação</p><h2 className="mt-1 text-xl font-black text-slate-900">Mercadinho</h2><p className="mt-3 text-sm leading-6 text-slate-600">{suggestion.text}</p><Link href={suggestion.href} className="mt-5 inline-flex rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white">{suggestion.label}</Link></div>
        <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Atenção</p><h2 className="mt-1 text-xl font-black">Pendências</h2></div>{alerts.length?<AlertTriangle className="text-amber-500"/>:<CheckCircle2 className="text-emerald-600"/>}</div>{alerts.length?<div className="mt-4 space-y-2">{alerts.map(alert=><Link key={alert.text} href={alert.href} className="block rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{alert.text}</Link>)}</div>:<p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Tudo certo por aqui.</p>}</div>
      </div>
    </section>

    <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Operação</p><h2 className="text-2xl font-black">Pedidos recentes</h2></div><Link href="/pedidos" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Ver todos</Link></div>{!rows.length?<div className="mt-5 rounded-2xl bg-slate-50 p-8 text-center text-slate-500">Nenhum pedido recente.</div>:<div className="mt-5 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="pb-3">Pedido</th><th className="pb-3">Cliente</th><th className="pb-3">Horário</th><th className="pb-3">Tipo</th><th className="pb-3">Pagamento</th><th className="pb-3">Status</th><th className="pb-3 text-right">Total</th></tr></thead><tbody>{rows.slice(0,8).map(order=><tr key={order.id} className="border-t"><td className="py-4 font-black">#{order.order_number}</td><td>{order.customer_name||"Cliente"}</td><td>{localTime(order.created_at)}</td><td>{serviceLabels[order.service_type]||order.service_type||"—"}</td><td>{paymentLabels[order.payment_method]||order.payment_method||"—"}</td><td><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[order.status]||"bg-gray-100 text-gray-700"}`}>{statusLabels[order.status]||order.status}</span></td><td className="text-right font-black">{money(Number(order.total||0))}</td></tr>)}</tbody></table></div>}</section>

    <section className="grid gap-5 lg:grid-cols-2"><div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Package className="text-emerald-700"/><h2 className="text-xl font-black">Produtos mais vendidos</h2></div><p className="mt-1 text-sm text-slate-500">Últimos 7 dias</p><div className="mt-4 space-y-3">{topProducts.map(product=><div key={product.key} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-emerald-50 text-emerald-700">{product.image?<img src={product.image} alt={product.name} className="h-full w-full object-cover"/>:<ImageIcon/>}</div><div className="min-w-0 flex-1"><p className="truncate font-black">{product.name}</p><p className="text-sm text-slate-500">{product.quantity} vendidos</p></div><strong className="text-emerald-700">{money(product.revenue)}</strong></div>)}{!topProducts.length&&<Empty text="Ainda não há vendas de produtos nos últimos 7 dias."/>}</div></div><div className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><Clock3 className="text-emerald-700"/><h2 className="text-xl font-black">Horários de maior movimento</h2></div><p className="mt-1 text-sm text-slate-500">Pedidos válidos nos últimos 7 dias</p>{peak.count>0&&<p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Horário de pico: {String(peak.hour).padStart(2,"0")}h–{String((peak.hour+1)%24).padStart(2,"0")}h</p>}<div className="mt-4 space-y-3">{hourCounts.map(row=><div key={row.hour} className="grid grid-cols-[72px_1fr_30px] items-center gap-2 text-sm"><span>{String(row.hour).padStart(2,"0")}h–{String((row.hour+1)%24).padStart(2,"0")}h</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{width:`${(row.count/hourMax)*100}%`}}/></div><strong className="text-right">{row.count}</strong></div>)}{!hourCounts.length&&<Empty text="Ainda não há pedidos suficientes para identificar horários de pico."/>}</div></div></section>
  </main>;
}
function Metric({label,value,detail}:{label:string;value:string;detail:string}){return <div className="rounded-3xl border bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><strong className="mt-2 block text-3xl font-black text-slate-950">{value}</strong><p className="mt-2 text-xs text-slate-500">{detail}</p></div>}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><strong className="mt-1 block capitalize text-slate-900">{value}</strong></div>}
function Empty({text}:{text:string}){return <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</p>}
