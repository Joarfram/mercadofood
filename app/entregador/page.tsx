import { redirect } from "next/navigation";
import { Bike, CircleDollarSign, LogOut, MapPin, PackageCheck, Phone, Power, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DriverGps } from "@/components/delivery/driver-gps";
import { advanceOwnDelivery, driverSignOut, respondToDelivery, setOwnAvailability } from "./actions";

export const dynamic = "force-dynamic";

const titles: Record<string,string> = { offered:"Nova corrida", accepted:"Corrida aceita", to_store:"A caminho da loja", waiting_pickup:"Aguardando retirada", delivering:"Em entrega", completed:"Entrega concluída" };
const actions: Record<string,string> = { accepted:"Iniciar ida à loja", to_store:"Cheguei na loja", waiting_pickup:"Pedido retirado", delivering:"Confirmar entrega" };
function money(v: unknown) { return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number(v || 0)); }

export default async function DriverAppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entregador/login");
  const { data: driver } = await supabase.from("drivers").select("id, name, availability_status, default_delivery_value").eq("auth_user_id", user.id).maybeSingle();
  if (!driver) redirect("/entregador/login?erro=Seu%20e-mail%20ainda%20não%20foi%20cadastrado%20por%20uma%20loja");
  const { data: delivery } = await supabase.from("deliveries")
    .select("id, status, tracking_code, pickup_address, delivery_address, delivery_value, amount_to_collect, orders(order_number, customer_name, customer_phone, payment_method)")
    .eq("driver_id", driver.id).in("status", ["offered","accepted","to_store","waiting_pickup","delivering"]).order("created_at", { ascending:false }).limit(1).maybeSingle();
  const { count: completedToday } = await supabase.from("deliveries").select("id", { count:"exact", head:true }).eq("driver_id", driver.id).eq("status", "completed").gte("completed_at", new Date(new Date().setHours(0,0,0,0)).toISOString());
  const isTracking = driver.availability_status === "available" || Boolean(delivery);
  const order: any = delivery?.orders;
  const pickup: any = delivery?.pickup_address || {};
  const destination: any = delivery?.delivery_address || {};

  return <main className="min-h-screen bg-slate-950 p-4 text-white"><div className="mx-auto max-w-md space-y-4">
    <header className="flex items-center justify-between py-3"><div><p className="text-sm text-emerald-400">MercadoFood Entregador</p><h1 className="text-2xl font-bold">Olá, {driver.name.split(" ")[0]}! 👋</h1></div><form action={driverSignOut}><button className="rounded-full bg-slate-800 p-3 text-slate-300" title="Sair"><LogOut size={19}/></button></form></header>
    <section className={`rounded-3xl p-5 ${driver.availability_status === "available" ? "bg-emerald-600" : delivery ? "bg-orange-600" : "bg-slate-800"}`}><div className="flex items-center justify-between"><div><p className="text-xl font-bold">{delivery ? "Em operação" : driver.availability_status === "available" ? "Disponível" : "Offline"}</p><DriverGps driverId={driver.id} enabled={isTracking}/></div>{!delivery && <form action={setOwnAvailability}><button name="status" value={driver.availability_status === "available" ? "offline" : "available"} className="rounded-full bg-white/20 p-3"><Power/></button></form>}</div></section>
    <section className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-900 p-4"><PackageCheck className="text-emerald-400"/><p className="mt-3 text-2xl font-bold">{completedToday || 0}</p><p className="text-sm text-slate-400">Entregas hoje</p></div><div className="rounded-2xl bg-slate-900 p-4"><CircleDollarSign className="text-emerald-400"/><p className="mt-3 text-2xl font-bold">{money((completedToday || 0) * Number(driver.default_delivery_value || 0))}</p><p className="text-sm text-slate-400">Estimativa do dia</p></div></section>

    {!delivery && <section className="rounded-2xl bg-slate-900 p-6 text-center"><Bike className="mx-auto text-slate-500" size={36}/><h2 className="mt-3 font-bold">Nenhuma corrida no momento</h2><p className="mt-1 text-sm text-slate-400">Fique disponível para receber pedidos enviados pela loja.</p></section>}

    {delivery && <section className="rounded-2xl bg-white p-5 text-slate-900"><p className="text-sm font-semibold text-emerald-700">{titles[delivery.status] || delivery.status}</p><h2 className="mt-1 text-2xl font-bold">Pedido #{order?.order_number || "—"}</h2>
      <div className="mt-5 space-y-4 text-sm"><div className="flex gap-3"><Store className="text-emerald-700"/><div><b>Retirada</b><p>{pickup.street || "Endereço da loja"}</p></div></div><div className="flex gap-3"><MapPin className="text-orange-500"/><div><b>Entrega</b><p>{destination.street || "Endereço do cliente"}<br/>{destination.neighborhood || ""}</p></div></div><div className="rounded-xl bg-slate-100 p-3"><b>Cliente:</b> {order?.customer_name || "Cliente"}<br/><b>Corrida:</b> {money(delivery.delivery_value)} {delivery.amount_to_collect > 0 ? `• Cobrar ${money(delivery.amount_to_collect)}` : ""}</div></div>
      {delivery.status === "offered" ? <form action={respondToDelivery} className="mt-5 grid grid-cols-2 gap-3"><input type="hidden" name="deliveryId" value={delivery.id}/><button name="response" value="decline" className="rounded-xl bg-red-500 py-3 font-bold text-white">Recusar</button><button name="response" value="accept" className="rounded-xl bg-emerald-600 py-3 font-bold text-white">Aceitar</button></form> : <div className="mt-5 flex gap-3"><a href={`tel:${order?.customer_phone || ""}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 font-semibold"><Phone size={17}/>Ligar</a><form action={advanceOwnDelivery} className="flex-[1.5]"><input type="hidden" name="deliveryId" value={delivery.id}/><input type="hidden" name="currentStatus" value={delivery.status}/><button className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white">{actions[delivery.status] || "Atualizar"}</button></form></div>}
    </section>}
  </div></main>;
}
