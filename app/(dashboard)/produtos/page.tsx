import { requirePlanModule } from "@/lib/auth/current-company";
import { CategoryManager } from "./category-manager";
import { ProductCenter } from "./product-center";

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("products");
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id, name, is_active, sort_order").eq("company_id", company.id).order("sort_order").order("name"),
    supabase.from("products").select("id, name, description, base_price, promotional_price, availability_status, category_id, sku, stock_quantity, track_stock, categories(name)").eq("company_id", company.id).order("created_at", { ascending: false }),
  ]);

  return <main className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-bold text-emerald-700">Cardápio e estoque integrados</p><h1 className="text-3xl font-bold text-slate-900">Produtos</h1><p className="text-slate-500">Cadastre e organize os produtos da {company.name} em uma única tela.</p></div>
    </header>
    {query.erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}
    <ProductCenter categories={(categories || []) as never[]} products={(products || []) as never[]}/>
    {!!categories?.length && <details className="rounded-2xl border bg-white p-4 shadow-sm"><summary className="cursor-pointer font-bold text-emerald-800">Organizar categorias</summary><div className="mt-4"><CategoryManager initialCategories={categories} companyId={company.id}/></div></details>}
  </main>;
}
