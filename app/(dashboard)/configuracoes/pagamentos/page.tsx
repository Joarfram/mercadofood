import Link from "next/link";
import { CreditCard } from "lucide-react";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectMercadoPago, setMercadoPagoCardEnabled } from "./actions";

export default async function PaymentsSettingsPage({searchParams}:{searchParams:Promise<{erro?:string;sucesso?:string}>}) {
  const query=await searchParams; const { company }=await getCurrentCompany();
  const { data }=await createAdminClient().from('company_mercado_pago_integrations').select('status,pix_enabled,card_enabled,connected_at,account_name,account_email,last_error_code').eq('company_id',company.id).maybeSingle();
  const connected=data?.status==='connected';
  const cardReady = Boolean(process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY);
  return <main className="mx-auto max-w-3xl space-y-6"><header><p className="text-sm font-bold text-emerald-700">Formas de pagamento</p><h1 className="text-3xl font-black">Pagamentos online</h1><p className="text-gray-600">Os valores são enviados diretamente à conta Mercado Pago da sua loja.</p></header>{query.erro&&<p className="rounded-xl bg-red-50 p-4 text-red-700">Não foi possível conectar o Mercado Pago.</p>}{query.sucesso&&<p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Mercado Pago conectado com sucesso.</p>}<section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex gap-3"><CreditCard className="text-emerald-700"/><div><h2 className="text-xl font-black">Mercado Pago</h2><p className="text-sm text-gray-500">Status: <b>{connected?'Conectado':'Não conectado'}</b></p>{data?.account_name&&<p className="text-sm text-gray-600">Conta: {data.account_name}{data.account_email?` · ${data.account_email}`:""}</p>}{data?.connected_at&&<p className="text-xs text-gray-500">Conectado em {new Date(data.connected_at).toLocaleDateString('pt-BR')}</p>}{data?.status==='reconnect_required'&&<p className="text-sm font-semibold text-amber-700">Reconexão necessária.</p>}</div></div><div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm"><p>PIX: <b>{data?.pix_enabled?'ativado':'desativado'}</b></p><p>Cartão online: <b>{data?.card_enabled?'ativado':'desativado'}</b></p></div>{connected&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-bold text-amber-900">Cartão online</p><p className="mt-1 text-amber-800">O Mercado Pago coleta os dados do cartão e o MercadoFood recebe apenas um token de uso único.</p>{!cardReady?<p className="mt-2 font-semibold text-amber-900">Falta cadastrar a chave pública do Mercado Pago na Vercel.</p>:<form action={setMercadoPagoCardEnabled} className="mt-3"><input type="hidden" name="enabled" value={data?.card_enabled?'false':'true'}/><button className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white">{data?.card_enabled?'Desativar cartão online':'Ativar cartão online'}</button></form>}</div>}{!connected?<Link href="/api/integrations/mercadopago/connect" className="mt-5 inline-block rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Conectar Mercado Pago</Link>:<div className="mt-5 flex flex-wrap gap-3"><p className="self-center text-sm font-semibold text-emerald-800">A conta será usada somente para os pedidos desta loja.</p><form action={disconnectMercadoPago}><button className="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-700">Desconectar</button></form></div>}</section>
    <details className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 text-sm text-slate-700">
      <summary className="cursor-pointer font-bold text-emerald-800">Saiba como receber PIX e cartão</summary>
      <div className="mt-4 space-y-3 leading-6">
        <p><b>1. Conecte a conta:</b> clique em “Conectar Mercado Pago” e entre com o e-mail e a senha da conta Mercado Pago da sua loja.</p>
        <p><b>2. Autorize:</b> o Mercado Pago pedirá sua autorização e retornará automaticamente para o MercadoFood.</p>
        <p><b>3. Ative o cartão:</b> após conectar, use o botão “Ativar cartão online” para aceitar pagamentos com cartão.</p>
        <p><b>4. Receba:</b> o PIX e o cartão são recebidos diretamente na conta Mercado Pago conectada. Configure a conta bancária para saque dentro do próprio Mercado Pago.</p>
        <p className="rounded-xl bg-white/80 p-3 text-xs"><b>Segurança:</b> o MercadoFood nunca solicita nem armazena a senha da conta Mercado Pago ou os dados completos do cartão do cliente.</p>
      </div>
    </details>
  </main>;
}
