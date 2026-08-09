import { requirePlanModule } from "@/lib/auth/current-company";
import { CategoryManager } from "./category-manager";
import { ProductCenter } from "./product-center";

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("products");
  const [{ data: categories }, { data: products }, { data: optionGroups }, { data: options }] = await Promise.all([
    supabase.from("categories").select("id, name, is_active, sort_order").eq("company_id", company.id).order("sort_order").order("name"),
    supabase.from("products").select("id, name, description, base_price, promotional_price, preparation_time, availability_status, category_id, sort_order, sku, stock_quantity, minimum_stock, track_stock, available_delivery, available_pickup, available_dine_in, categories(name)").eq("company_id", company.id).order("sort_order").order("name"),
    supabase.from("product_option_groups").select("id, product_id, name, description, min_selection, max_selection, sort_order").eq("company_id", company.id).eq("is_active", true).order("sort_order"),
    supabase.from("product_options").select("id, group_id, name, price_delta, sort_order").eq("company_id", company.id).eq("is_active", true).order("sort_order"),
  ]);
  const productsWithAddons = (products || []).map(product => ({
    ...product,
    addons: (optionGroups || []).filter(group => group.product_id === product.id).map(group => ({
      name: group.name,
      description: group.description || "",
      required: Number(group.min_selection || 0) > 0,
      min: Number(group.min_selection || 0),
      max: Number(group.max_selection || 1),
      options: (options || []).filter(option => option.group_id === group.id).map(option => ({ name: option.name, price: Number(option.price_delta || 0) })),
    })),
  }));

  return <main className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-bold text-emerald-700">Cardápio e estoque integrados</p><h1 className="text-3xl font-bold text-slate-900">Produtos</h1><p className="text-slate-500">Cadastre e organize os produtos da {company.name} em uma única tela.</p></div>
    </header>
    {query.erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}
    <ProductCenter categories={(categories || []) as never[]} products={productsWithAddons as never[]}/>
    {!!categories?.length && <details className="rounded-2xl border bg-white p-4 shadow-sm"><summary className="cursor-pointer font-bold text-emerald-800">Organizar categorias</summary><div className="mt-4"><CategoryManager initialCategories={categories} companyId={company.id}/></div></details>}
  </main>;
}
