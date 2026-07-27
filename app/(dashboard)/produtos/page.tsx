import { createCategory, createProduct, deleteCategory, toggleCategory, toggleProduct, updateCategory } from "./actions";
import { getCurrentCompany } from "@/lib/auth/current-company";

function money(value: number | string | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id, name, is_active").eq("company_id", company.id).order("name"),
    supabase.from("products").select("id, name, description, base_price, preparation_time, availability_status, categories(name)").eq("company_id", company.id).order("created_at", { ascending: false }),
  ]);

  return <main className="space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">Cadastro real no Supabase</p><h1 className="text-3xl font-bold">Produtos</h1><p className="text-gray-500">Cadastre categorias e itens do cardápio da {company.name}.</p></header>
    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-5 xl:grid-cols-[1fr_2fr]">
      <div className="space-y-5">
        <form action={createCategory} className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Organização do cardápio</p>
          <h2 className="mt-1 text-lg font-bold">Categorias do cardápio</h2>
          <p className="mt-1 text-sm text-gray-500">Crie categorias como Hambúrgueres, Bebidas, Porções e Sobremesas.</p>
          <label className="mt-4 block text-sm font-semibold">Nome</label>
          <input name="name" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Ex.: Hambúrgueres" />
          <button className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Adicionar categoria</button>
          {!!categories?.length && <p className="mt-4 border-t pt-4 text-xs font-semibold text-gray-500">Categorias cadastradas ({categories.length})</p>}
        </form>
        {!!categories?.length && <div className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-bold">Editar categorias</h2>
          {categories.map(category => <article key={category.id} className="rounded-xl border p-3">
            <form action={updateCategory} className="flex gap-2">
              <input type="hidden" name="categoryId" value={category.id}/>
              <input name="name" required minLength={2} defaultValue={category.name} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/>
              <button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Salvar</button>
            </form>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${category.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{category.is_active ? "Ativa" : "Pausada"}</span>
              <div className="flex gap-2">
                <form action={toggleCategory}><input type="hidden" name="categoryId" value={category.id}/><input type="hidden" name="nextActive" value={String(!category.is_active)}/><button className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">{category.is_active ? "Pausar" : "Ativar"}</button></form>
                <form action={deleteCategory}><input type="hidden" name="categoryId" value={category.id}/><button className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600">Excluir</button></form>
              </div>
            </div>
          </article>)}
          <p className="text-xs text-gray-500">Categorias com produtos vinculados não podem ser excluídas.</p>
        </div>}

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
