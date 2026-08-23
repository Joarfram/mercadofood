import { requirePlanModule } from "@/lib/auth/current-company";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { addInventoryMovement, createIngredient, deleteIngredient, removeRecipeItem } from "./actions";
import { RecipeCalculator } from "./recipe-calculator";

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
function qty(value: number | string | null | undefined) { return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 }); }
const unitLabel: Record<string,string> = {un:"un",g:"g",kg:"kg",ml:"ml",l:"L"};
const movementLabel: Record<string,string> = {entry:"Entrada",sale:"Venda",adjustment:"Ajuste",loss:"Perda",return:"Retorno"};

export default async function EstoquePage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("stock");
  const [{ data: ingredients }, { data: products }, { data: recipes }, { data: movements }] = await Promise.all([
    supabase.from("ingredients").select("*").eq("company_id", company.id).eq("is_active", true).order("name"),
    supabase.from("products").select("id,name,base_price").eq("company_id", company.id).eq("is_active", true).order("name"),
    supabase.from("recipe_items").select("id,quantity,product_id,ingredient_id,product:products(name),ingredient:ingredients(name,unit,unit_cost)").eq("company_id", company.id).order("created_at", { ascending: false }),
    supabase.from("inventory_movements").select("id,movement_type,quantity,stock_after,notes,created_at,ingredient:ingredients(name,unit)").eq("company_id", company.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const low = (ingredients || []).filter(i => Number(i.current_stock) <= Number(i.minimum_stock));
  const stockValue = (ingredients || []).reduce((s,i)=>s+Number(i.current_stock)*Number(i.unit_cost),0);

  return <main className="space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">Controle de insumos</p><h1 className="text-3xl font-bold">Estoque e ficha técnica</h1><p className="text-gray-500">Cadastre ingredientes, registre entradas e defina quanto cada produto consome.</p></header>
    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-4 md:grid-cols-3">
      <Card label="Insumos cadastrados" value={String(ingredients?.length || 0)} note="Ativos no estoque" />
      <Card label="Estoque baixo" value={String(low.length)} note="No mínimo ou abaixo" tone={low.length ? "orange" : undefined} />
      <Card label="Valor estimado" value={money(stockValue)} note="Estoque atual × custo" />
    </section>

    {low.length > 0 && <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5"><h2 className="font-bold text-orange-800">Atenção ao estoque</h2><div className="mt-3 flex flex-wrap gap-2">{low.map(i=><span key={i.id} className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-orange-700">{i.name}: {qty(i.current_stock)} {unitLabel[i.unit]}</span>)}</div></section>}

    <section className="grid gap-6 xl:grid-cols-3">
      <form action={createIngredient} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Novo insumo</h2>
        <label className="mt-4 block text-sm font-semibold">Nome</label><input name="name" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Ex.: Queijo muçarela" />
        <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Unidade<select name="unit" className="mt-1 w-full rounded-xl border px-3 py-3"><option value="un">Unidade</option><option value="g">Grama</option><option value="kg">Quilo</option><option value="ml">Mililitro</option><option value="l">Litro</option></select></label><label className="text-sm font-semibold">Custo por unidade<input name="unitCost" type="number" min="0" step="0.0001" defaultValue="0" className="mt-1 w-full rounded-xl border px-3 py-3" /></label></div>
        <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Estoque atual<input name="currentStock" type="number" min="0" step="0.001" defaultValue="0" className="mt-1 w-full rounded-xl border px-3 py-3" /></label><label className="text-sm font-semibold">Estoque mínimo<input name="minimumStock" type="number" min="0" step="0.001" defaultValue="0" className="mt-1 w-full rounded-xl border px-3 py-3" /></label></div>
        <button className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Cadastrar insumo</button>
      </form>

      <form action={addInventoryMovement} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Movimentar estoque</h2>
        <label className="mt-4 block text-sm font-semibold">Insumo</label><select name="ingredientId" required className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Selecione</option>{ingredients?.map(i=><option key={i.id} value={i.id}>{i.name} — {qty(i.current_stock)} {unitLabel[i.unit]}</option>)}</select>
        <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Tipo<select name="movementType" className="mt-1 w-full rounded-xl border px-3 py-3"><option value="entry">Entrada</option><option value="loss">Perda</option><option value="adjustment">Saída/Ajuste</option><option value="return">Retorno</option></select></label><label className="text-sm font-semibold">Quantidade<input name="quantity" required type="number" min="0.001" step="0.001" className="mt-1 w-full rounded-xl border px-3 py-3" /></label></div>
        <label className="mt-3 block text-sm font-semibold">Observação</label><input name="notes" className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Ex.: compra do fornecedor" />
        <button className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white">Registrar movimentação</button>
      </form>

      <div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Como o custo é calculado</h2><ol className="mt-4 space-y-3 text-sm text-gray-500"><li><b>1.</b> Cadastre o custo na mesma unidade usada na receita.</li><li><b>2.</b> Informe a quantidade líquida e a perda de limpeza/preparo.</li><li><b>3.</b> Defina rendimento, embalagem, taxas, impostos, custos operacionais e margem.</li><li><b>4.</b> O sistema calcula custo por porção e três faixas de venda.</li></ol></div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Insumos</h2><span className="text-sm text-gray-500">{ingredients?.length || 0} itens</span></div><div className="mt-4 space-y-3">{!ingredients?.length && <p className="rounded-xl bg-gray-50 p-5 text-gray-500">Nenhum insumo cadastrado.</p>}{ingredients?.map(i=>{const isLow=Number(i.current_stock)<=Number(i.minimum_stock);return <article key={i.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center"><div><h3 className="font-bold">{i.name}</h3><p className="text-sm text-gray-500">Mínimo: {qty(i.minimum_stock)} {unitLabel[i.unit]} • Custo: {money(i.unit_cost)}/{unitLabel[i.unit]}</p></div><strong className={isLow?"text-orange-600":"text-emerald-700"}>{qty(i.current_stock)} {unitLabel[i.unit]}</strong><span className={`rounded-full px-3 py-1 text-xs font-semibold ${isLow?"bg-orange-50 text-orange-700":"bg-emerald-50 text-emerald-700"}`}>{isLow?"Estoque baixo":"Normal"}</span><div className="flex gap-2"><Link title="Editar insumo" href={`/estoque/editar/${i.id}`} className="rounded-lg border p-2"><Pencil size={17}/></Link><form action={deleteIngredient}><input type="hidden" name="ingredientId" value={i.id}/><button title="Excluir insumo" className="rounded-lg border p-2 text-red-600"><Trash2 size={17}/></button></form></div></article>})}</div></div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Itens das fichas técnicas</h2><div className="mt-4 space-y-3">{!recipes?.length && <p className="rounded-xl bg-gray-50 p-5 text-gray-500">Nenhuma ficha técnica cadastrada.</p>}{recipes?.map((r:any)=>{const product=Array.isArray(r.product)?r.product[0]:r.product;const ingredient=Array.isArray(r.ingredient)?r.ingredient[0]:r.ingredient;const cost=Number(r.quantity)*Number(ingredient?.unit_cost||0);return <article key={r.id} className="flex items-center justify-between gap-3 rounded-xl border p-4"><div><h3 className="font-bold">{product?.name}</h3><p className="text-sm text-gray-500">{ingredient?.name}: {qty(r.quantity)} {unitLabel[ingredient?.unit]} • custo {money(cost)}</p></div><form action={removeRecipeItem}><input type="hidden" name="recipeItemId" value={r.id}/><button className="rounded-lg border px-3 py-2 text-sm font-semibold text-red-600">Remover</button></form></article>})}</div></div>
    </section>

    <RecipeCalculator ingredients={(ingredients||[]) as any} products={(products||[]) as any}/>

    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Últimas movimentações</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Data</th><th>Insumo</th><th>Tipo</th><th>Quantidade</th><th>Saldo</th><th>Observação</th></tr></thead><tbody>{movements?.map((m:any)=>{const ing=Array.isArray(m.ingredient)?m.ingredient[0]:m.ingredient;return <tr key={m.id} className="border-b last:border-0"><td className="py-3">{new Date(m.created_at).toLocaleString("pt-BR")}</td><td className="font-semibold">{ing?.name}</td><td>{movementLabel[m.movement_type]||m.movement_type}</td><td className={Number(m.quantity)<0?"text-orange-600":"text-emerald-700"}>{Number(m.quantity)>0?"+":""}{qty(m.quantity)} {unitLabel[ing?.unit]}</td><td>{qty(m.stock_after)} {unitLabel[ing?.unit]}</td><td className="text-gray-500">{m.notes||"—"}</td></tr>})}</tbody></table></div></section>
  </main>;
}
function Card({label,value,note,tone}:{label:string;value:string;note:string;tone?:"orange"}) { return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{label}</p><strong className={`mt-1 block text-2xl ${tone==="orange"?"text-orange-600":"text-emerald-700"}`}>{value}</strong><p className="mt-1 text-sm text-gray-500">{note}</p></div> }
