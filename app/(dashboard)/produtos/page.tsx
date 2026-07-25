import { createCategory, createProduct, toggleProduct } from "./actions";
import { getCurrentCompany } from "@/lib/auth/current-company";

function money(value: number | string | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("company_id", company.id).order("name"),
    supabase.from("products").select("id, name, description, base_price, preparation_time, availability_status, categories(name)").eq("company_id", company.id).order("created_at", { ascending: false }),
  ]);

  return <main className="space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">Cadastro real no Supabase</p><h1 className="text-3xl font-bold">Produtos</h1><p className="text-gray-500">Cadastre categorias e itens do cardápio da {company.name}.</p></header>
    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-5 xl:grid-cols-[1fr_2fr]">
      <div className="space-y-5">
        <form action={createCategory} className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Nova categoria</h2>
          <label className="mt-4 block text-sm font-semibold">Nome</label>
          <input name="name" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Ex.: Hambúrgueres" />
          <button className="mt-4 w-full rounded-xl border border-emerald-700 px-4 py-3 font-semibold text-emerald-800">Criar categoria</button>
        </form>

        <form action={createProduct} className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Novo produto</h2>
          <label className="mt-4 block text-sm font-semibold">Nome</label>
          <input name="name" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="X-Burger" />
          <label className="mt-3 block text-sm font-semibold">Descrição</label>
          <textarea name="description" className="mt-1 min-h-24 w-full rounded-xl border px-3 py-3" placeholder="Ingredientes e detalhes" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-semibold">Preço</label><input name="basePrice" type="number" step="0.01" min="0.01" required className="mt-1 w-full rounded-xl border px-3 py-3" /></div>
            <div><label className="block text-sm font-semibold">Preparo (min)</label><input name="preparationTime" type="number" min="0" className="mt-1 w-full rounded-xl border px-3 py-3" /></div>
          </div>
          <label className="mt-3 block text-sm font-semibold">Categoria</label>
          <select name="categoryId" className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Sem categoria</option>{categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <button className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Salvar produto</button>
        </form>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Produtos cadastrados</h2><span className="text-sm text-gray-500">{products?.length || 0} itens</span></div>
        <div className="mt-4 space-y-3">
          {!products?.length && <p className="rounded-xl bg-gray-50 p-5 text-gray-500">Nenhum produto cadastrado.</p>}
          {products?.map(product => {
            const cat = Array.isArray(product.categories) ? product.categories[0] : product.categories;
            const available = product.availability_status === "available";
            return <article key={product.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
              <div><div className="flex items-center gap-2"><h3 className="font-bold">{product.name}</h3><span className={`rounded-full px-2 py-1 text-xs font-semibold ${available ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{available ? "Disponível" : "Indisponível"}</span></div><p className="text-sm text-gray-500">{cat?.name || "Sem categoria"} • {product.preparation_time || 0} min</p><p className="mt-1 text-sm">{product.description || "Sem descrição"}</p></div>
              <div className="flex flex-wrap items-center gap-2"><strong>{money(product.base_price)}</strong><a href={`/produtos/${product.id}/complementos`} className="rounded-xl bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">Complementos</a><form action={toggleProduct}><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="nextStatus" value={available ? "unavailable" : "available"}/><button className="rounded-xl border px-3 py-2 text-sm font-semibold">{available ? "Pausar" : "Ativar"}</button></form></div>
            </article>;
          })}
        </div>
      </div>
    </section>
  </main>;
}
