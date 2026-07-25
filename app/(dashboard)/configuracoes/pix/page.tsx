import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { savePixSettings } from "./actions";

export default async function PixSettingsPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  const { data: settings } = await supabase.from("company_pix_settings")
    .select("pix_key, merchant_name, merchant_city, description, is_active")
    .eq("company_id", company.id).maybeSingle();

  return <main className="mx-auto max-w-3xl space-y-6">
    <header>
      <p className="text-sm font-semibold text-emerald-700">Recebimento manual</p>
      <h1 className="text-3xl font-bold">Configuração do PIX</h1>
      <p className="text-gray-500">Cadastre a chave da empresa para gerar QR Code e PIX Copia e Cola nos pedidos.</p>
    </header>
    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <form action={savePixSettings} className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3"><KeyRound className="text-emerald-700"/><div><h2 className="text-xl font-bold">Dados da cobrança</h2><p className="text-sm text-gray-500">Esses dados aparecerão no QR Code.</p></div></div>
      <label className="mt-5 block text-sm font-semibold">Chave PIX</label>
      <input name="pixKey" required defaultValue={settings?.pix_key || ""} className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="CPF, CNPJ, telefone, e-mail ou chave aleatória"/>
      <label className="mt-4 block text-sm font-semibold">Nome do recebedor</label>
      <input name="merchantName" required defaultValue={settings?.merchant_name || company.name} maxLength={25} className="mt-1 w-full rounded-xl border px-3 py-3"/>
      <label className="mt-4 block text-sm font-semibold">Cidade</label>
      <input name="merchantCity" required defaultValue={settings?.merchant_city || "Aracaju"} maxLength={15} className="mt-1 w-full rounded-xl border px-3 py-3"/>
      <label className="mt-4 block text-sm font-semibold">Descrição padrão</label>
      <input name="description" defaultValue={settings?.description || "Pedido MercadoFood"} className="mt-1 w-full rounded-xl border px-3 py-3"/>
      <button className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Salvar configuração PIX</button>
    </form>

    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-blue-900">
      <div className="flex gap-3"><ShieldCheck className="shrink-0"/><div><h2 className="font-bold">Confirmação manual nesta versão</h2><p className="mt-1 text-sm">O sistema gera a cobrança, mas a loja ainda deve conferir o recebimento no banco antes de marcar o pedido como pago.</p></div></div>
    </div>
    <Link href="/pagamentos" className="inline-flex font-semibold text-emerald-700">Voltar para pagamentos</Link>
  </main>;
}
