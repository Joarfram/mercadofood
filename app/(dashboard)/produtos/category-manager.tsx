"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteCategory, toggleCategory, updateCategory } from "./actions";

type Category = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

export function CategoryManager({ initialCategories, companyId }: { initialCategories: Category[]; companyId: string }) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragReadyId, setDragReadyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId || saving) return;
    const from = categories.findIndex(category => category.id === draggedId);
    const to = categories.findIndex(category => category.id === targetId);
    if (from < 0 || to < 0) return;

    const previous = categories;
    const next = [...categories];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reordered = next.map((category, index) => ({ ...category, sort_order: index }));
    setCategories(reordered);
    setDraggedId(null);
    setSaving(true);
    setMessage("Salvando nova ordem...");

    const supabase = createClient();
    const results = await Promise.all(reordered.map(category =>
      supabase
        .from("categories")
        .update({ sort_order: category.sort_order, updated_at: new Date().toISOString() })
        .eq("id", category.id)
        .eq("company_id", companyId)
    ));

    if (results.some(result => result.error)) {
      setCategories(previous);
      setMessage("Não foi possível salvar a ordem. Tente novamente.");
    } else {
      setMessage("Ordem atualizada no cardápio digital.");
      router.refresh();
    }
    setSaving(false);
  }

  return <div className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
    <div>
      <h2 className="font-bold">Editar e ordenar categorias</h2>
      <p className="mt-1 text-xs text-gray-500">Segure pelo ícone ⋮⋮ e arraste para a posição desejada.</p>
    </div>
    {message && <p className={`rounded-lg px-3 py-2 text-xs font-semibold ${message.startsWith("Não") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p>}
    {categories.map(category => <article
      key={category.id}
      draggable={!saving && dragReadyId === category.id}
      onDragStart={() => setDraggedId(category.id)}
      onDragEnd={() => { setDraggedId(null); setDragReadyId(null); }}
      onDragOver={event => event.preventDefault()}
      onDrop={() => dropOn(category.id)}
      className={`rounded-xl border p-3 transition ${draggedId === category.id ? "border-orange-400 bg-orange-50 opacity-60" : "bg-white"}`}
    >
      <div className="flex items-center gap-2">
        <span title="Segure e arraste" onMouseDown={() => setDragReadyId(category.id)} onMouseUp={() => { if (!draggedId) setDragReadyId(null); }} className="cursor-grab touch-none rounded-lg bg-gray-100 p-2 text-gray-500 active:cursor-grabbing"><GripVertical size={19}/></span>
        <form action={updateCategory} className="flex min-w-0 flex-1 gap-2">
          <input type="hidden" name="categoryId" value={category.id}/>
          <input name="name" required minLength={2} defaultValue={category.name} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"/>
          <button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Salvar</button>
        </form>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${category.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{category.is_active ? "Ativa" : "Pausada"}</span>
        <div className="flex gap-2">
          <form action={toggleCategory}><input type="hidden" name="categoryId" value={category.id}/><input type="hidden" name="nextActive" value={String(!category.is_active)}/><button className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">{category.is_active ? "Pausar" : "Ativar"}</button></form>
          <form action={deleteCategory} onSubmit={event => { if (!window.confirm(`Excluir permanentemente a categoria "${category.name}"? Todos os produtos, combos, fotos, complementos e fichas técnicas vinculados a ela também serão excluídos. O histórico dos pedidos será preservado.`)) event.preventDefault(); }}><input type="hidden" name="categoryId" value={category.id}/><button className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600">Excluir</button></form>
        </div>
      </div>
    </article>)}
    <p className="text-xs text-red-600">A exclusão remove permanentemente a categoria e todo o conteúdo ligado a ela. O histórico de pedidos permanece preservado.</p>
  </div>;
}
