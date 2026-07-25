import { getCurrentCompany } from "@/lib/auth/current-company";
import { addProductToComboGroup, createCombo, createComboGroup, toggleCombo } from "./actions";

function money(value: number | string | null) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default async function CombosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  const [{ data: categories }, { data: products }, { data: combos }, { data: groups }] = await Promise.all([
    supabase.from("categories").select("id,name").eq("company_id", company.id).order("name"),
    supabase.from("products").select("id,name,base_price").eq("company_id", company.id).eq("is_active", true).order("name"),
    supabase.from("combos").select("id,name,description,base_price,promotional_price,is_active,availability_status,combo_groups(id,name,min_selection,max_selection,free_selection,combo_group_products(id,price_delta,max_quantity,products(id,name)))").eq("company_id", company.id).order("created_at", { ascending: false }),
    supabase.from("combo_groups").select("id,name,combo_id,combos(name)").eq("company_id", company.id).eq("is_active", true).order("name"),
  ]);

  return <main className="space-y-6">
    <header>
      <p className="text-sm font-semibold text-emerald-700">Refeições montadas por etapas</p>
      <h1 className="text-3xl font-bold">Combos</h1>
      <p className="text-gray-500">Crie combos com lanche, acompanhamento, bebida e opções de troca.</p>
    </header>

    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-5 xl:grid-cols-3">
      <form action={createCombo} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">1. Criar combo</h2>
        <label className="mt-4 block text-sm font-semibold">Nome</label>
        <input name="name" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Combo Família" />
        <label className="mt-3 block text-sm font-semibold">Descrição</label>
        <textarea name="description" className="mt-1 min-h-20 w-full rounded-xl border px-3 py-3" placeholder="Escolha os itens da sua refeição" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-semibold">Preço base</label><input name="basePrice" type="number" step="0.01" min="0" required className="mt-1 w-full rounded-xl border px-3 py-3" /></div>
          <div><label className="block text-sm font-semibold">Promoção</label><input name="promotionalPrice" type="number" step="0.01" min="0" className="mt-1 w-full rounded-xl border px-3 py-3" /></div>
        </div>
        <label className="mt-3 block text-sm font-semibold">Categoria</label>
        <select name="categoryId" className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Combos</option>{categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label className="mt-3 block text-sm font-semibold">Preparo (min)</label>
        <input name="preparationTime" type="number" min="0" className="mt-1 w-full rounded-xl border px-3 py-3" />
        <button className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Salvar combo</button>
      </form>

      <form action={createComboGroup} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">2. Criar etapa</h2>
        <label className="mt-4 block text-sm font-semibold">Combo</label>
        <select name="comboId" required className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Selecione</option>{combos?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label className="mt-3 block text-sm font-semibold">Nome da etapa</label>
        <input name="name" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Escolha a bebida" />
        <label className="mt-3 block text-sm font-semibold">Orientação</label>
        <input name="description" className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Escolha 1 opção" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div><label className="block text-xs font-semibold">Mínimo</label><input name="minSelection" defaultValue="1" type="number" min="0" className="mt-1 w-full rounded-xl border px-2 py-3" /></div>
          <div><label className="block text-xs font-semibold">Máximo</label><input name="maxSelection" defaultValue="1" type="number" min="1" className="mt-1 w-full rounded-xl border px-2 py-3" /></div>
          <div><label className="block text-xs font-semibold">Grátis</label><input name="freeSelection" defaultValue="1" type="number" min="0" className="mt-1 w-full rounded-xl border px-2 py-3" /></div>
        </div>
        <button className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white">Adicionar etapa</button>
      </form>

      <form action={addProductToComboGroup} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">3. Adicionar opção</h2>
        <label className="mt-4 block text-sm font-semibold">Etapa</label>
        <select name="groupId" required className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Selecione</option>{groups?.map(g => { const combo = Array.isArray(g.combos) ? g.combos[0] : g.combos; return <option key={g.id} value={g.id}>{combo?.name} — {g.name}</option>; })}</select>
        <label className="mt-3 block text-sm font-semibold">Produto</label>
        <select name="productId" required className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Selecione</option>{products?.map(p => <option key={p.id} value={p.id}>{p.name} — {money(p.base_price)}</option>)}</select>
        <label className="mt-3 block text-sm font-semibold">Acréscimo</label>
        <input name="priceDelta" type="number" step="0.01" defaultValue="0" className="mt-1 w-full rounded-xl border px-3 py-3" />
        <label className="mt-3 block text-sm font-semibold">Quantidade máxima</label>
        <input name="maxQuantity" type="number" min="1" defaultValue="1" className="mt-1 w-full rounded-xl border px-3 py-3" />
        <button className="mt-4 w-full rounded-xl border border-emerald-700 px-4 py-3 font-semibold text-emerald-800">Incluir no combo</button>
      </form>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Combos cadastrados</h2><span className="text-sm text-gray-500">{combos?.length || 0} combos</span></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {!combos?.length && <p className="rounded-xl bg-gray-50 p-5 text-gray-500">Nenhum combo cadastrado.</p>}
        {combos?.map(combo => <article key={combo.id} className="rounded-2xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="text-lg font-bold">{combo.name}</h3><p className="text-sm text-gray-500">{combo.description || "Sem descrição"}</p><p className="mt-2 font-bold text-emerald-700">{money(combo.promotional_price ?? combo.base_price)}</p></div>
            <form action={toggleCombo}><input type="hidden" name="id" value={combo.id}/><input type="hidden" name="active" value={String(combo.is_active)}/><button className="rounded-xl border px-3 py-2 text-sm font-semibold">{combo.is_active ? "Pausar" : "Ativar"}</button></form>
          </div>
          <div className="mt-4 space-y-3">
            {combo.combo_groups?.map(group => <div key={group.id} className="rounded-xl bg-gray-50 p-3">
              <div className="flex items-center justify-between"><strong>{group.name}</strong><span className="text-xs text-gray-500">{group.min_selection}–{group.max_selection} escolhas • {group.free_selection} grátis</span></div>
              <div className="mt-2 flex flex-wrap gap-2">{group.combo_group_products?.length ? group.combo_group_products.map(item => { const product = Array.isArray(item.products) ? item.products[0] : item.products; return <span key={item.id} className="rounded-full bg-white px-3 py-1 text-xs shadow-sm">{product?.name}{Number(item.price_delta) ? ` + ${money(item.price_delta)}` : ""}</span>; }) : <span className="text-xs text-gray-400">Sem opções</span>}</div>
            </div>)}
          </div>
        </article>)}
      </div>
    </section>
  </main>;
}
