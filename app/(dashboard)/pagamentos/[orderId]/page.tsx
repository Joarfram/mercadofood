import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { CopyPixButton } from "./copy-button";
import { generatePix } from "./actions";
import { updatePayment } from "../actions";

function money(value: number | string | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default async function PixOrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { orderId } = await params;
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  const [{ data: order }, { data: payment }, { data: settings }] = await Promise.all([
    supabase.from("orders").select("id,order_number,customer_name,customer_phone,total,payment_status").eq("id", orderId).eq("company_id", company.id).single(),
    supabase.from("order_payments").select("status,pix_payload,pix_txid,pix_generated_at,pix_expires_at").eq("order_id", orderId).eq("company_id", company.id).maybeSingle(),
    supabase.from("company_pix_settings").select("is_active").eq("company_id", company.id).maybeSingle(),
  ]);
  if (!order) return <main className="rounded-2xl border bg-white p-8">Pedido não encontrado.</main>;
  const qrDataUrl = payment?.pix_payload ? await QRCode.toDataURL(payment.pix_payload, { width: 360, margin: 2 }) : null;

  return <main className="mx-auto max-w-4xl space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">Pedido #{order.order_number}</p><h1 className="text-3xl font-bold">Cobrança PIX</h1><p className="text-gray-500">{order.customer_name || "Cliente"} • {money(order.total)}</p></header>
    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    {!settings?.is_active && <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5"><p className="font-bold text-orange-900">PIX ainda não configurado.</p><Link href="/configuracoes/pix" className="mt-2 inline-flex font-semibold text-orange-800">Configurar chave PIX</Link></div>}

    {!payment?.pix_payload ? <form action={generatePix} className="rounded-2xl border bg-white p-6 shadow-sm">
      <input type="hidden" name="orderId" value={order.id}/>
      <h2 className="text-xl font-bold">Gerar cobrança</h2><p className="mt-1 text-gray-500">Será criado um QR Code com o valor exato do pedido.</p>
      <button disabled={!settings?.is_active} className="mt-5 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-50">Gerar QR Code PIX</button>
    </form> : <section className="grid gap-6 lg:grid-cols-[390px_1fr]">
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-gray-500">Escaneie para pagar</p>
        {qrDataUrl && <Image src={qrDataUrl} alt="QR Code PIX" width={360} height={360} unoptimized className="mx-auto mt-3 rounded-xl"/>}
        <p className="mt-3 text-3xl font-bold text-emerald-700">{money(order.total)}</p>
        <p className="text-xs text-gray-500">TXID: {payment.pix_txid}</p>
      </div>
      <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div><h2 className="text-xl font-bold">PIX Copia e Cola</h2><p className="text-sm text-gray-500">Envie este código ao cliente ou copie para o WhatsApp.</p></div>
        <textarea readOnly value={payment.pix_payload} className="min-h-40 w-full break-all rounded-xl border bg-gray-50 p-3 text-xs"/>
        <CopyPixButton payload={payment.pix_payload}/>
        <p className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">Confira o recebimento no aplicativo do banco antes de confirmar o pagamento.</p>
        <form action={updatePayment} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="method" value="pix"/><input type="hidden" name="status" value="paid"/><input type="hidden" name="amountReceived" value={order.total}/>
          <div className="rounded-xl bg-gray-50 p-3 text-sm"><strong>Status:</strong> {order.payment_status === "paid" ? "Pago" : "Aguardando confirmação"}</div>
          <button disabled={order.payment_status === "paid"} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">Marcar como pago</button>
        </form>
        <form action={generatePix}><input type="hidden" name="orderId" value={order.id}/><button className="text-sm font-semibold text-emerald-700">Gerar novamente</button></form>
      </div>
    </section>}
    <Link href="/pagamentos" className="inline-flex font-semibold text-emerald-700">Voltar para pagamentos</Link>
  </main>;
}
