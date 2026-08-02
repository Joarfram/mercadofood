import Link from "next/link";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { createOption, createOptionGroup, toggleGroup, toggleOption } from "./actions";

const money = (value: number | string | null) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

export default async function ComplementosPage({ params, searchParams }: { params: Promise<{ productId: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const { productId } = await params;
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  const [{ data: product }, { data: groups }] = await Promise.all([
    supabase.from("products").select("id, name, base_price").eq("id", productId).eq("company_id", company.id).single(),
    supabase.from("product_option_groups").select("id, name, description, group_type, min_selection, max_selection, free_selection, is_active, product_options(id, name, price_delta, max_quantity, is_active)").eq("product_id", productId).eq("company_id", company.id).order("sort_order"),
  ]);

  if (!product) return <main className="rounded-2xl border bg-white p-8"><h1 className="text-2xl font-bold">Produto não encontrado</h1><Link href="/produtos" className="mt-4 inline-block text-emerald-700">Voltar para produtos</Link></main>;

  return <main className="space-y-6">
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><Link href="/produtos" className="text-sm font-semibold text-emerald-700">← Produtos</Link><p className="mt-2 text-sm font-semibold text-orange-600">Complementos e adicionais</p><h1 className="text-3xl font-bold">{product.name}</h1><p className="text-gray-500">Preço base {money(product.base_price)}. Configure as escolhas extras que aparecerão para o cliente antes de adicionar o produto ao carrinho.</p></div></header>
    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <form action={createOptionGroup} className="h-fit rounded-2xl border bg-white p-5 shadow-sm">
        <input type="hidden" name="productId" value={product.id}/><h2 className="text-xl font-bold">Novo grupo de escolhas</h2>
        <p className="mt-1 text-sm text-gray-500">Crie um conjunto como “Adicionais”, “Escolha o tamanho” ou “Molhos”. Depois, cadastre as opções e seus valores.</p>
        <label className="mt-4 block text-sm font-semibold">Nome do grupo</label><input name="name" required placeholder="Ex.: Adicionais" className="mt-1 w-full rounded-xl border p-3"/>
        <label className="mt-3 block text-sm font-semibold">Orientação para o cliente</label><input name="description" placeholder="Ex.: Escolha até 3 adicionais" className="mt-1 w-full rounded-xl border p-3"/>
        <label className="mt-3 block text-sm font-semibold">Tipo de escolha</label><select name="groupType" className="mt-1 w-full rounded-xl border p-3"><option value="single">Uma opção</option><option value="multiple">Várias opções</option><option value="quantity">Quantidade por opção</option></select>
        <div className="mt-3 grid grid-cols-3 gap-2"><div><label className="block text-xs font-semibold">Mínimo</label><input name="minSelection" type="number" min="0" defaultValue="0" className="mt-1 w-full rounded-xl border p-3"/></div><div><label className="block text-xs font-semibold">Máximo</label><input name="maxSelection" type="number" min="1" defaultValue="1" className="mt-1 w-full rounded-xl border p-3"/></div><div><label className="block text-xs font-semibold">Grátis</label><input name="freeSelection" type="number" min="0" defaultValue="0" className="mt-1 w-full rounded-xl border p-3"/></div></div>
        <button className="mt-5 w-full rounded-xl bg-emerald-700 py-3 font-bold text-white">Criar grupo de escolhas</button>
      </form>

      <div className="space-y-4">
        {!groups?.length && <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">Nenhum complemento ou adicional criado para este produto.</div>}
        {groups?.map((group: any) => <article key={group.id} className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-xl font-bold">{group.name}</h2><span className={`rounded-full px-2 py-1 text-xs font-semibold ${group.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{group.is_active ? "Ativo" : "Pausado"}</span></div><p className="text-sm text-gray-500">{group.group_type === "single" ? "Escolha única" : group.group_type === "quantity" ? "Quantidade por opção" : "Múltipla escolha"} • mínimo {group.min_selection} • máximo {group.max_selection} • {group.free_selection || 0} grátis</p><p className="text-sm text-gray-600">{group.description}</p></div><form action={toggleGroup}><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="groupId" value={group.id}/><input type="hidden" name="active" value={String(!group.is_active)}/><button className="rounded-xl border px-3 py-2 text-sm font-semibold">{group.is_active ? "Pausar" : "Ativar"}</button></form></div>
          <div className="mt-4 space-y-2">{(group.product_options || []).map((option: any) => <div key={option.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3"><div><strong>{option.name}</strong><p className="text-xs text-gray-500">{Number(option.price_delta) > 0 ? `+ ${money(option.price_delta)}` : "Sem acréscimo"} • até {option.max_quantity || 1}</p></div><form action={toggleOption}><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="optionId" value={option.id}/><input type="hidden" name="active" value={String(!option.is_active)}/><button className="text-sm font-semibold text-emerald-700">{option.is_active ? "Pausar" : "Ativar"}</button></form></div>)}</div>
          <form action={createOption} className="mt-4 grid gap-2 border-t pt-4 md:grid-cols-[1fr_150px_120px_auto]"><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="groupId" value={group.id}/><input name="name" required placeholder="Nome do adicional" className="rounded-xl border p-3"/><input name="priceDelta" type="number" step="0.01" defaultValue="0" placeholder="Valor extra" className="rounded-xl border p-3"/><input name="maxQuantity" type="number" min="1" defaultValue="1" title="Quantidade máxima" className="rounded-xl border p-3"/><button className="rounded-xl bg-orange-500 px-4 py-3 font-bold text-white">Adicionar opção</button></form>
        </article>)}
      </div>
    </section>
  </main>;
}
