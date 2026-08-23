import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { requirePlanModule } from "@/lib/auth/current-company";
import { updateIngredient } from "../../actions";

export default async function EditIngredientPage({params}:{params:Promise<{ingredientId:string}>}) {
  const {ingredientId}=await params;
  const {supabase,company}=await requirePlanModule("stock");
  const {data:ingredient}=await supabase.from("ingredients").select("id,name,unit,unit_cost,minimum_stock,current_stock").eq("id",ingredientId).eq("company_id",company.id).eq("is_active",true).maybeSingle();
  if(!ingredient) notFound();
  return <main className="mx-auto max-w-2xl space-y-6">
    <Link href="/estoque" className="inline-flex items-center gap-2 font-semibold text-emerald-700"><ArrowLeft size={18}/>Voltar ao estoque</Link>
    <form action={updateIngredient} className="rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
      <input type="hidden" name="ingredientId" value={ingredient.id}/>
      <p className="text-sm font-bold text-emerald-700">Controle de insumos</p><h1 className="mt-1 text-3xl font-bold">Editar insumo</h1><p className="mt-2 text-gray-500">Altere os dados de {ingredient.name}. O saldo atual é ajustado somente por uma movimentação de estoque.</p>
      <label className="mt-6 block text-sm font-semibold">Nome<input name="name" required defaultValue={ingredient.name} className="mt-1 w-full rounded-xl border px-4 py-3"/></label>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Unidade<select name="unit" defaultValue={ingredient.unit} className="mt-1 w-full rounded-xl border px-4 py-3"><option value="un">Unidade</option><option value="g">Grama</option><option value="kg">Quilo</option><option value="ml">Mililitro</option><option value="l">Litro</option></select></label><label className="text-sm font-semibold">Custo por unidade<input name="unitCost" type="number" min="0" step="0.0001" defaultValue={Number(ingredient.unit_cost)} className="mt-1 w-full rounded-xl border px-4 py-3"/></label></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Estoque mínimo<input name="minimumStock" type="number" min="0" step="0.001" defaultValue={Number(ingredient.minimum_stock)} className="mt-1 w-full rounded-xl border px-4 py-3"/></label><div className="rounded-xl border bg-gray-50 px-4 py-3"><p className="text-xs font-semibold text-gray-500">Saldo atual</p><strong>{Number(ingredient.current_stock).toLocaleString("pt-BR",{maximumFractionDigits:3})} {ingredient.unit}</strong><p className="mt-1 text-xs text-gray-500">Use “Movimentar estoque” para alterar.</p></div></div>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/estoque" className="rounded-xl border px-5 py-3 text-center font-semibold">Cancelar</Link><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white"><Save size={18}/>Salvar alterações</button></div>
    </form>
  </main>;
}
