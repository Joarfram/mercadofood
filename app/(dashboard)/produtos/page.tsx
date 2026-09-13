import { requirePlanModule } from "@/lib/auth/current-company";
import { CategoryManager } from "./category-manager";
import { ProductCenter } from "./product-center";
import { Boxes, LayoutGrid, PackageSearch } from "lucide-react";

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("products");
  const [{ data: categories }, { data: products }, { data: optionGroups }, { data: options }] = await Promise.all([
    supabase.from("categories").select("id, name, is_active, sort_order").eq("company_id", company.id).order("sort_order").order("name"),
    supabase.from("products").select("id, name, description, image_url, base_price, promotional_price, preparation_time, availability_status, category_id, sku, stock_quantity, minimum_stock, track_stock, available_delivery, available_pickup, available_dine_in, categories(name)").eq("company_id", company.id).order("name"),
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

  const activeProducts = (products || []).filter(product => product.availability_status === "available").length;
  const withStock = (products || []).filter(product => product.track_stock).length;

  return <main className="min-w-0 space-y-6 pb-10">
    <section className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Catálogo da loja</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Produtos</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Cadastre, organize, precifique e controle a disponibilidade dos itens da {company.name}.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[430px]">
          <div className="rounded-2xl bg-white/10 p-3"><div className="flex items-center gap-2 text-xs text-slate-300"><Boxes size={15}/> Produtos</div><strong className="mt-1 block text-2xl">{products?.length || 0}</strong></div>
          <div className="rounded-2xl bg-white/10 p-3"><div className="flex items-center gap-2 text-xs text-slate-300"><PackageSearch size={15}/> Disponíveis</div><strong className="mt-1 block text-2xl">{activeProducts}</strong></div>
          <div className="rounded-2xl bg-white/10 p-3"><div className="flex items-center gap-2 text-xs text-slate-300"><LayoutGrid size={15}/> Categorias</div><strong className="mt-1 block text-2xl">{categories?.length || 0}</strong></div>
        </div>
      </div>
    </section>

    {query.erro && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">{query.sucesso}</div>}

    <section className="rounded-3xl border bg-white p-3 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Gestão do cardápio</p><h2 className="text-2xl font-black text-slate-900">Catálogo completo</h2></div>{withStock > 0 && <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{withStock} com controle de estoque</span>}</div>
      <ProductCenter categories={(categories || []) as never[]} products={productsWithAddons as never[]}/>
    </section>

    {!!categories?.length && <details className="rounded-3xl border bg-white p-5 shadow-sm"><summary className="cursor-pointer font-black text-slate-900">Organizar categorias</summary><p className="mt-1 text-sm text-slate-500">Ajuste a ordem e a organização visual do cardápio.</p><div className="mt-5"><CategoryManager initialCategories={categories} companyId={company.id}/></div></details>}
  </main>;
}
