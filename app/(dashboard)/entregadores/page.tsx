import { Bike, MapPin, Phone, Power, Send } from "lucide-react";
import { WhatsAppButton } from "@/components/notifications/whatsapp-button";
import { customerOutForDeliveryMessage, driverOfferMessage } from "@/lib/notifications/whatsapp";
import { requirePlanModule } from "@/lib/auth/current-company";
import { assignDriver, createDriver, deleteDriver, setDriverAvailability, updateDriver } from "./actions";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  available: "Disponível",
  called: "Chamado",
  busy: "Ocupado",
  offline: "Offline",
};

const statusClass: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-800",
  called: "bg-orange-100 text-orange-800",
  busy: "bg-amber-100 text-amber-800",
  offline: "bg-gray-100 text-gray-700",
};

function money(value: number | string | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default async function DriversPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("delivery");
  const [{ data: drivers }, { data: readyOrders }, { data: activeDeliveries }, { data: notifications }] = await Promise.all([
    supabase.from("drivers").select("id, name, email, phone, whatsapp, vehicle_plate, availability_status, registration_status, default_delivery_value, last_seen_at").eq("company_id", company.id).order("name"),
    supabase.from("orders").select("id, order_number, customer_name, customer_phone, total, delivery_fee, delivery_address, created_at").eq("company_id", company.id).eq("service_type", "delivery").eq("status", "ready").is("assigned_driver_id", null).order("ready_at", { ascending: true }),
    supabase.from("deliveries").select("id, status, tracking_code, delivery_value, delivery_address, created_at, drivers(name, phone, whatsapp), orders(order_number, customer_name, customer_phone)").eq("company_id", company.id).in("status", ["offered", "accepted", "to_store", "waiting_pickup", "delivering"]).order("created_at", { ascending: false }),
    supabase.from("whatsapp_notifications").select("id, recipient_type, recipient_name, recipient_phone, template_key, message_body, status, created_at").eq("company_id", company.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const availableDrivers = drivers?.filter((driver) => driver.availability_status === "available") || [];

  return <main className="space-y-6">
    <header>
      <p className="text-sm font-semibold text-emerald-700">MercadoFood Entregador • Supabase</p>
      <h1 className="text-3xl font-bold">Entregadores e corridas</h1>
      <p className="text-gray-500">Cadastre motoboys, controle disponibilidade e atribua pedidos prontos da {company.name}.</p>
    </header>

    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <form action={createDriver} className="h-fit rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Cadastrar motoboy</h2>
        <label className="mt-4 block text-sm font-semibold">Nome</label>
        <input name="name" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Carlos Silva" />
        <label className="mt-3 block text-sm font-semibold">E-mail para acesso ao app</label><input name="email" type="email" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="motoboy@email.com" /><label className="mt-3 block text-sm font-semibold">Telefone</label>
        <input name="phone" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="79 99999-9999" />
        <label className="mt-3 block text-sm font-semibold">WhatsApp</label>
        <input name="whatsapp" className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Pode ser o mesmo telefone" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-semibold">Placa</label><input name="vehiclePlate" className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="ABC1D23" /></div>
          <div><label className="block text-sm font-semibold">Valor padrão</label><input name="defaultDeliveryValue" type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="8,00" /></div>
        </div>
        <button className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Salvar motoboy</button>
      </form>

      <div className="space-y-5">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Equipe cadastrada</h2><p className="text-sm text-gray-500">{drivers?.length || 0} motoboys • {availableDrivers.length} disponíveis</p></div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {!drivers?.length && <p className="rounded-xl bg-gray-50 p-5 text-gray-500">Nenhum motoboy cadastrado.</p>}
            {drivers?.map((driver) => <article key={driver.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-bold">{driver.name}</h3><p className="flex items-center gap-2 text-sm text-gray-500"><Phone size={14}/>{driver.phone}</p><p className="mt-1 text-xs text-gray-500">{driver.email || "Sem e-mail"} • {driver.registration_status}</p><p className="mt-1 text-xs text-gray-500">{driver.vehicle_plate || "Sem placa"} • {money(driver.default_delivery_value)}</p></div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[driver.availability_status] || statusClass.offline}`}>{statusLabel[driver.availability_status] || driver.availability_status}</span>
              </div>
              <form action={setDriverAvailability} className="mt-4 flex gap-2">
                <input type="hidden" name="driverId" value={driver.id}/>
                <button name="status" value={driver.availability_status === "available" ? "offline" : "available"} disabled={["called", "busy"].includes(driver.availability_status)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40"><Power size={15}/>{driver.availability_status === "available" ? "Ficar offline" : "Marcar disponível"}</button>
              </form>
              <details className="mt-3 rounded-xl bg-gray-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-emerald-800">Editar ou excluir</summary><form action={updateDriver} className="mt-3 grid gap-2"><input type="hidden" name="driverId" value={driver.id}/><input name="name" defaultValue={driver.name} required className="rounded-lg border px-3 py-2" aria-label="Nome"/><input name="phone" defaultValue={driver.phone} required className="rounded-lg border px-3 py-2" aria-label="Telefone"/><input name="whatsapp" defaultValue={driver.whatsapp || ''} className="rounded-lg border px-3 py-2" aria-label="WhatsApp"/><div className="grid grid-cols-2 gap-2"><input name="vehiclePlate" defaultValue={driver.vehicle_plate || ''} className="rounded-lg border px-3 py-2" aria-label="Placa"/><input name="defaultDeliveryValue" type="number" min="0" step="0.01" defaultValue={driver.default_delivery_value || 0} className="rounded-lg border px-3 py-2" aria-label="Valor da corrida"/></div><button className="rounded-lg bg-emerald-700 py-2 font-semibold text-white">Salvar alterações</button></form><form action={deleteDriver} className="mt-2"><input type="hidden" name="driverId" value={driver.id}/><button className="w-full rounded-lg bg-red-50 py-2 text-sm font-semibold text-red-700">Excluir motoboy</button></form></details>
            </article>)}
          </div>
        </section>
      </div>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Pedidos prontos para entrega</h2><p className="text-sm text-gray-500">Escolha um motoboy disponível.</p></div><span className="rounded-full bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">{readyOrders?.length || 0} aguardando</span></div>
      <div className="mt-4 space-y-3">
        {!readyOrders?.length && <p className="rounded-xl bg-gray-50 p-5 text-gray-500">Nenhum pedido delivery pronto e sem motoboy.</p>}
        {readyOrders?.map((order) => <article key={order.id} className="rounded-xl border p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><p className="text-sm font-semibold text-orange-700">Pedido #{order.order_number}</p><h3 className="text-lg font-bold">{order.customer_name || "Cliente"}</h3><p className="mt-1 flex items-center gap-2 text-sm text-gray-500"><MapPin size={15}/>{String((order.delivery_address as any)?.street || "Endereço ainda não informado")}</p><p className="mt-1 text-sm">Total: <strong>{money(order.total)}</strong></p></div>
            <form action={assignDriver} className="grid min-w-[300px] gap-2 sm:grid-cols-[1fr_110px_auto]">
              <input type="hidden" name="orderId" value={order.id}/>
              <select name="driverId" required className="rounded-xl border px-3 py-3"><option value="">Escolha o motoboy</option>{availableDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} • {money(driver.default_delivery_value)}</option>)}</select>
              <input name="deliveryValue" type="number" min="0" step="0.01" className="rounded-xl border px-3 py-3" placeholder="Taxa" />
              <button disabled={!availableDrivers.length} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-40"><Send size={16}/>Chamar</button>
            </form>
          </div>
        </article>)}
      </div>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold">Corridas em andamento</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {!activeDeliveries?.length && <p className="rounded-xl bg-gray-50 p-5 text-gray-500">Nenhuma corrida ativa.</p>}
        {activeDeliveries?.map((delivery: any) => {
          const driver = Array.isArray(delivery.drivers) ? delivery.drivers[0] : delivery.drivers;
          const order = Array.isArray(delivery.orders) ? delivery.orders[0] : delivery.orders;
          const destination = delivery.delivery_address as any;
          const driverMessage = driverOfferMessage({ driverName: driver?.name, orderNumber: order?.order_number || "—", storeName: company.name, neighborhood: destination?.neighborhood, deliveryValue: Number(delivery.delivery_value || 0) });
          const customerMessage = customerOutForDeliveryMessage({ customerName: order?.customer_name, orderNumber: order?.order_number || "—", storeName: company.name, driverName: driver?.name, trackingCode: delivery.tracking_code });
          return <article key={delivery.id} className="rounded-xl border p-4"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-emerald-700">#{order?.order_number || "—"} • {delivery.tracking_code}</p><h3 className="font-bold">{order?.customer_name || "Cliente"}</h3><p className="text-sm text-gray-500"><Bike className="mr-1 inline" size={15}/>{driver?.name || "Motoboy"}</p></div><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">{delivery.status}</span></div><p className="mt-3 text-sm">Corrida: <strong>{money(delivery.delivery_value)}</strong></p><div className="mt-3 flex flex-wrap gap-2"><WhatsAppButton phone={driver?.whatsapp || driver?.phone || ""} message={driverMessage} label="Avisar motoboy"/><WhatsAppButton phone={order?.customer_phone || ""} message={customerMessage} label="Enviar rastreamento"/></div></article>;
        })}
      </div>
    </section>
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Histórico do WhatsApp</h2><p className="text-sm text-gray-500">Últimas mensagens preparadas ou enviadas pelo sistema.</p></div></div>
      <div className="mt-4 space-y-3">
        {!notifications?.length && <p className="rounded-xl bg-gray-50 p-5 text-gray-500">Nenhuma notificação registrada.</p>}
        {notifications?.map((notification) => <article key={notification.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-700">{notification.recipient_type === "driver" ? "Motoboy" : "Cliente"} • {notification.recipient_name || notification.recipient_phone}</p><p className="mt-1 whitespace-pre-line text-sm text-gray-600">{notification.message_body}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${notification.status === "sent" ? "bg-emerald-100 text-emerald-800" : notification.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>{notification.status}</span></div><div className="mt-3"><WhatsAppButton phone={notification.recipient_phone} message={notification.message_body} label={notification.status === "failed" ? "Tentar manualmente" : "Abrir WhatsApp"}/></div></article>)}
      </div>
    </section>

  </main>;
}
