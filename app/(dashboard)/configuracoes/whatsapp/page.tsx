import { AlertTriangle, BellRing, Bot, CheckCircle2, ExternalLink, MessageCircle, RefreshCcw, ShieldCheck } from "lucide-react";
import { requirePlanModule } from "@/lib/auth/current-company";
import { disconnectWhatsApp, retryOrderWhatsAppNotification, saveWhatsAppSettings, sendWhatsAppTest } from "./actions";
import { DisconnectButton } from "./disconnect-button";
import { WhatsAppConnect } from "./whatsapp-connect";

type NotificationRow = { id:string; order_id:string|null; status:"queued"|"sent"|"failed"|"cancelled"; recipient_phone:string; error_message:string|null; sent_at:string|null; created_at:string; metadata?:{order_number?:number|string}|null };
const notificationLabels:Record<NotificationRow["status"],string> = {queued:"Na fila",sent:"Enviado",failed:"Falhou",cancelled:"Cancelado"};
const notificationClasses:Record<NotificationRow["status"],string> = {queued:"bg-amber-50 text-amber-800",sent:"bg-emerald-50 text-emerald-800",failed:"bg-red-50 text-red-700",cancelled:"bg-gray-100 text-gray-600"};

export default async function WhatsAppSettingsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company, role } = await requirePlanModule("messages");
  const [{ data: integration, error: integrationError }, { data: notifications, error: notificationsError }] = await Promise.all([
    supabase.from("whatsapp_integrations").select("status,display_phone_number,chatbot_enabled,greeting_message,handoff_message,connected_at,order_notifications_enabled,order_notification_phone").eq("company_id", company.id).maybeSingle(),
    supabase.from("whatsapp_notifications").select("id,order_id,status,recipient_phone,error_message,sent_at,created_at,metadata").eq("company_id",company.id).eq("recipient_type","store").eq("template_key","new_order_store").order("created_at",{ascending:false}).limit(20),
  ]);
  const recentNotifications=(notifications||[]) as NotificationRow[];
  const connected = integration?.status === "connected";
  const appId = process.env.NEXT_PUBLIC_META_APP_ID || "";
  const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID || "";
  const graphVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
  const platformReady = Boolean(appId && configId && process.env.META_APP_SECRET && process.env.META_WEBHOOK_VERIFY_TOKEN && process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const failedNotifications=recentNotifications.filter(item=>item.status==="failed");

  return <main className="space-y-6">
    <header><p className="text-sm font-bold text-emerald-700">Atendimento integrado</p><h1 className="text-3xl font-black">WhatsApp e chatbot</h1><p className="mt-1 text-gray-500">Conecte o número da {company.name}, automatize respostas e escolha onde receber os novos pedidos.</p></header>
    {query.sucesso && <p className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">{query.sucesso}</p>}
    {query.erro && <p className="rounded-xl bg-red-50 p-4 font-semibold text-red-700">{query.erro}</p>}
    {integrationError && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">A estrutura do WhatsApp ainda precisa ser ativada no banco de dados.</p>}

    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <article className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><MessageCircle/></div><div><h2 className="text-xl font-bold">Número do estabelecimento</h2><p className="text-sm text-gray-500">O próprio estabelecimento autoriza o número pela Meta.</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{connected ? "Conectado" : "Não conectado"}</span></div>
        {connected ? <div className="mt-5 rounded-2xl bg-emerald-50 p-5"><p className="text-sm text-emerald-800">WhatsApp ativo</p><strong className="text-xl text-emerald-950">{integration.display_phone_number}</strong><div className="mt-4"><form action={disconnectWhatsApp}><DisconnectButton/></form></div></div> : <div className="mt-5"><WhatsAppConnect appId={appId} configId={configId} graphVersion={graphVersion}/>{!platformReady && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Preparação pendente do proprietário do MercadoFood</strong><p className="mt-1">Cadastre e aprove o aplicativo empresarial na Meta e adicione as credenciais privadas na Vercel. Depois disso, este botão será liberado automaticamente.</p></div>}</div>}
      </article>
      <article className="rounded-2xl border bg-[#063D2F] p-6 text-white shadow-sm"><ShieldCheck className="text-orange-400"/><h2 className="mt-4 text-xl font-bold">Conexão segura por empresa</h2><p className="mt-2 text-sm leading-6 text-emerald-50/80">Cada loja conecta apenas o próprio número. As credenciais ficam criptografadas e isoladas por empresa.</p><a href="https://developers.facebook.com/docs/whatsapp/embedded-signup/" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-orange-300">Documentação da Meta <ExternalLink size={15}/></a></article>
    </section>

    <form action={saveWhatsAppSettings} className="space-y-6">
      <section className="rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
        <div className="flex gap-3"><BellRing className="text-orange-600"/><div><h2 className="text-xl font-bold">Aviso de novo pedido</h2><p className="text-sm text-gray-600">O MercadoFood envia para a loja um resumo com cliente, produtos, pesos, valores, entrega/retirada e pagamento.</p></div></div>
        <div className="mt-5 space-y-4">
          <label className="flex items-center gap-3 font-bold"><input name="orderNotificationsEnabled" type="checkbox" defaultChecked={integration?.order_notifications_enabled ?? false} className="h-5 w-5 accent-emerald-700"/>Enviar novos pedidos pelo WhatsApp</label>
          <label className="block text-sm font-bold">Celular que recebe os pedidos<input name="orderNotificationPhone" inputMode="tel" maxLength={24} defaultValue={integration?.order_notification_phone || ""} placeholder="Ex.: (79) 99999-9999" className="mt-1 w-full rounded-xl border border-orange-200 bg-white p-3 font-normal"/><span className="mt-1 block text-xs font-normal text-gray-500">Pode ser o celular do caixa ou do responsável pela operação. Se o aviso estiver desligado, este número não recebe pedidos automáticos.</span></label>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex gap-3"><Bot className="text-orange-500"/><div><h2 className="text-xl font-bold">Chatbot inicial</h2><p className="text-sm text-gray-500">O bot responde cardápio, acompanhamento, informações da loja e transfere para atendente.</p></div></div>
        <div className="mt-5 space-y-4"><label className="flex items-center gap-2 font-bold"><input name="chatbotEnabled" type="checkbox" defaultChecked={integration?.chatbot_enabled ?? true} className="h-5 w-5 accent-emerald-700"/>Ativar respostas automáticas</label><label className="block text-sm font-bold">Mensagem inicial<textarea name="greeting" required minLength={10} maxLength={2000} rows={7} defaultValue={integration?.greeting_message || "Olá! 👋 Como podemos ajudar?\n\n1 — Ver cardápio\n2 — Acompanhar pedido\n3 — Horários e endereço\n4 — Falar com atendente"} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label><label className="block text-sm font-bold">Mensagem ao chamar atendente<textarea name="handoff" required minLength={5} maxLength={1000} rows={3} defaultValue={integration?.handoff_message || "Certo! Um atendente continuará a conversa por aqui."} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label></div>
      </section>
      <button disabled={!['owner','manager'].includes(role)} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">Salvar configurações do WhatsApp</button>
    </form>

    {connected && <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex gap-3"><CheckCircle2 className="text-emerald-700"/><div><h2 className="text-xl font-bold">Testar conexão</h2><p className="text-sm text-gray-500">Envie uma mensagem de teste para o seu celular.</p></div></div><form action={sendWhatsAppTest} className="mt-4 flex flex-col gap-3 sm:flex-row"><input name="phone" required inputMode="tel" placeholder="(79) 99999-9999" className="min-w-0 flex-1 rounded-xl border px-4 py-3"/><button className="rounded-xl bg-orange-500 px-5 py-3 font-bold text-white">Enviar teste</button></form></section>}

    {!notificationsError && <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Avisos de pedidos</h2><p className="text-sm text-gray-500">Últimos 20 envios para o celular da loja.</p></div>{failedNotifications.length?<AlertTriangle className="text-red-500"/>:<CheckCircle2 className="text-emerald-600"/>}</div><div className="mt-4 space-y-3">{!recentNotifications.length&&<p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">Nenhum aviso de pedido enviado ainda.</p>}{recentNotifications.map(item=>{const orderNumber=item.metadata?.order_number||item.order_id?.slice(0,8)||"—";return <article key={item.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong>Pedido #{String(orderNumber)}</strong><span className={`rounded-full px-2 py-1 text-xs font-bold ${notificationClasses[item.status]}`}>{notificationLabels[item.status]}</span></div><p className="mt-1 text-sm text-gray-500">Para {item.recipient_phone} · {new Date(item.created_at).toLocaleString("pt-BR")}{item.sent_at?` · enviado ${new Date(item.sent_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`:""}</p>{item.error_message&&<p className="mt-1 text-sm font-semibold text-red-600">{item.error_message}</p>}</div>{item.status==="failed"&&item.order_id&&<form action={retryOrderWhatsAppNotification}><input type="hidden" name="orderId" value={item.order_id}/><button className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-800"><RefreshCcw size={16}/>Reenviar</button></form>}</article>})}</div></section>}
  </main>;
}