import { createCategory, createProduct, deleteProduct, toggleProduct, updateProduct } from "./actions";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { CategoryManager } from "./category-manager";
import { MediaManager } from "@/components/media/media-manager";
import type { MediaAsset } from "@/lib/media/types";

function money(value: number | string | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  const [{ data: categories }, { data: products }, { data: productAssets }] = await Promise.all([
    supabase.from("categories").select("id, name, is_active, sort_order").eq("company_id", company.id).order("sort_order").order("name"),
    supabase.from("products").select("id, name, description, base_price, promotional_price, preparation_time, availability_status, category_id, image_fit, image_position, categories(name)").eq("company_id", company.id).order("created_at", { ascending: false }),
    supabase.from("media_assets").select("id,entity_id,storage_path,public_url,alt_text,mime_type,byte_size,sort_order").eq("company_id", company.id).eq("entity_type", "product").eq("kind", "gallery").order("sort_order"),
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
        {!!categories?.length && <CategoryManager initialCategories={categories} companyId={company.id}/>}

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
            const media = (productAssets || []).filter(asset => asset.entity_id === product.id) as MediaAsset[];
            return <article key={product.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div><div className="flex items-center gap-2"><h3 className="font-bold">{product.name}</h3><span className={`rounded-full px-2 py-1 text-xs font-semibold ${available ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{available ? "Disponível" : "Indisponível"}</span></div><p className="text-sm text-gray-500">{cat?.name || "Sem categoria"} • {product.preparation_time || 0} min</p><p className="mt-1 text-sm">{product.description || "Sem descrição"}</p></div>
                <div className="flex flex-wrap items-center gap-2"><div>{product.promotional_price && <span className="mr-2 text-xs text-gray-400 line-through">{money(product.base_price)}</span>}<strong>{money(product.promotional_price || product.base_price)}</strong></div><a href={`/produtos/${product.id}/complementos`} className="rounded-xl bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">Complementos</a><form action={toggleProduct}><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="nextStatus" value={available ? "unavailable" : "available"}/><button className="rounded-xl border px-3 py-2 text-sm font-semibold">{available ? "Pausar" : "Ativar"}</button></form></div>
              </div>
              <details className="mt-4 border-t pt-3">
                <summary className="cursor-pointer font-semibold text-emerald-700">Editar informações do produto</summary>
                <form action={updateProduct} className="mt-4 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="productId" value={product.id}/>
                  <input type="hidden" name="imageFit" value="contain"/>
                  <input type="hidden" name="imagePosition" value="center"/>
                  <label className="text-sm font-semibold">Nome<input name="name" required minLength={2} defaultValue={product.name} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal"/></label>
                  <label className="text-sm font-semibold">Categoria<select name="categoryId" defaultValue={product.category_id || ""} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal"><option value="">Sem categoria</option>{categories?.map(category => <option key={category.id} value={category.id}>{category.name}{category.is_active ? "" : " (pausada)"}</option>)}</select></label>
                  <label className="text-sm font-semibold md:col-span-2">Descrição<textarea name="description" maxLength={500} rows={3} defaultValue={product.description || ""} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal" placeholder="Ingredientes, tamanho e detalhes do produto"/></label>
                  <label className="text-sm font-semibold">Preço normal<input name="basePrice" type="number" step="0.01" min="0.01" required defaultValue={Number(product.base_price)} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal"/></label>
                  <label className="text-sm font-semibold">Preço promocional<input name="promotionalPrice" type="number" step="0.01" min="0.01" defaultValue={product.promotional_price ? Number(product.promotional_price) : ""} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal" placeholder="Opcional"/></label>
                  <label className="text-sm font-semibold">Tempo de preparo (min)<input name="preparationTime" type="number" min="0" max="240" defaultValue={product.preparation_time || 0} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal"/></label>
                  <div className="flex items-end"><button className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white">Salvar alterações</button></div>
                </form>
                <div className="mt-5"><MediaManager companyId={company.id} entityType="product" entityId={product.id} initialAssets={media} title="Foto do produto" description="Adicione ou troque a foto sem sair do cadastro. A primeira imagem será a capa no cardápio." recommendedSize="1000 × 1000 px (proporção 1:1)"/></div>
                <form action={deleteProduct} onSubmit={event => { if (!window.confirm(`Excluir permanentemente o produto "${product.name}"? A descrição, fotos, complementos e ficha técnica também serão removidos.`)) event.preventDefault(); }} className="mt-4 border-t pt-4">
                  <input type="hidden" name="productId" value={product.id}/>
                  <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Excluir produto permanentemente</button>
                </form>
              </details>
            </article>;
          })}
        </div>
      </div>
    </section>
  </main>;
}
