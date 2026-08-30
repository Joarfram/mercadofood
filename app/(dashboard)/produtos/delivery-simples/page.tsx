import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlanModule } from "@/lib/auth/current-company";
import { DeliverySimpleProductForm } from "./product-form";

export default async function DeliverySimpleProductPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("products");
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  return <main className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-emerald-700">Gestão Delivery Simples</p>
        <h1 className="text-3xl font-bold text-slate-900">Novo produto</h1>
        <p className="mt-1 text-slate-500">Cadastre por unidade, peso ou opções de peso com cálculo automático.</p>
      </div>
      <Link href="/produtos" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-semibold text-slate-700"><ArrowLeft size={17}/>Voltar aos produtos</Link>
    </header>
    {query.erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}
    <DeliverySimpleProductForm categories={(categories || []) as { id: string; name: string }[]}/>
  </main>;
}
