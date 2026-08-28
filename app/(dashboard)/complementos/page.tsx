import Link from "next/link";
import { CirclePlus, PackageCheck, SlidersHorizontal } from "lucide-react";
import { requirePlanModule } from "@/lib/auth/current-company";
import { linkGroupToProduct, unlinkGroupFromProduct } from "./actions";

const money = (value: number | string | null) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(Number(value || 0));

type ProductOption = {
  id: string;
  name: string;
  price_delta: number | string;
  is_active: boolean;
};

type OptionGroup = {
  id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  group_type: "single" | "multiple" | "quantity";
  min_selection: number;
  max_selection: number;
  is_active: boolean;
  product_options: ProductOption[] | null;
};

type Product = { id: string; name: string };
type GroupLink = { group_id: string; product_id: string };

export default async function ComplementosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("products");
  const [{ data, error }, { data: productData }, { data: linkData }] = await Promise.all([
    supabase.from("product_option_groups")
      .select("id, product_id, name, description, group_type, min_selection, max_selection, is_active, product_options(id, name, price_delta, is_active)")
      .eq("company_id", company.id).order("name"),
    supabase.from("products").select("id, name").eq("company_id", company.id).eq("is_active", true).order("name"),
    supabase.from("product_option_group_links").select("group_id, product_id").eq("company_id", company.id).eq("is_active", true),
  ]);

  const groups = (data || []) as OptionGroup[];
  const products = (productData || []) as Product[];
  const links = (linkData || []) as GroupLink[];
  const activeGroups = groups.filter((group) => group.is_active).length;
  const options = groups.flatMap((group) => group.product_options || []);

  return <main className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-orange-600">Operação do cardápio</p>
        <h1 className="text-3xl font-bold text-slate-900">Complementos e Adicionais</h1>
        <p className="mt-1 max-w-3xl text-slate-600">Gerencie as escolhas que o cliente combina com os produtos, como bacon, molhos, tamanhos, bordas e acompanhamentos.</p>
      </div>
      <Link href="/produtos" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800">
        <CirclePlus size={18}/>Adicionar em um produto
      </Link>
    </header>

    {query.erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Grupos cadastrados</p><strong className="mt-1 block text-2xl text-slate-900">{groups.length}</strong></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Grupos ativos</p><strong className="mt-1 block text-2xl text-emerald-700">{activeGroups}</strong></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Opções cadastradas</p><strong className="mt-1 block text-2xl text-orange-600">{options.length}</strong></div>
    </section>

    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">Não foi possível carregar os complementos: {error.message}</div>}

    {!error && !groups.length && <section className="rounded-2xl border bg-white p-10 text-center shadow-sm">
      <SlidersHorizontal className="mx-auto text-emerald-700" size={36}/>
      <h2 className="mt-3 text-xl font-bold text-slate-900">Nenhum complemento cadastrado</h2>
      <p className="mt-1 text-slate-500">Abra Produtos, edite um item e crie o primeiro grupo de adicionais.</p>
      <Link href="/produtos" className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Ir para Produtos</Link>
    </section>}

    <section className="grid gap-4 xl:grid-cols-2">
      {groups.map((group) => {
        const groupOptions = group.product_options || [];
        const activeOptions = groupOptions.filter((option) => option.is_active).length;
        const groupLinks = links.filter((link) => link.group_id === group.id);
        const linkedProducts = groupLinks.map((link) => products.find((product) => product.id === link.product_id)).filter((product): product is Product => Boolean(product));
        const availableProducts = products.filter((product) => !groupLinks.some((link) => link.product_id === product.id));
        return <article key={group.id} className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-slate-900">{group.name}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${group.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{group.is_active ? "Ativo" : "Pausado"}</span></div>
              <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-700"><PackageCheck size={15}/>{linkedProducts.length} {linkedProducts.length === 1 ? "produto vinculado" : "produtos vinculados"}</p>
              {group.description && <p className="mt-1 text-sm text-slate-500">{group.description}</p>}
            </div>
            {group.product_id && <Link href={`/produtos/${group.product_id}/complementos`} className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-sm font-bold text-emerald-800">Editar grupo</Link>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600"><span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{group.group_type === "single" ? "Escolha única" : group.group_type === "quantity" ? "Quantidade por opção" : "Múltipla escolha"}</span><span className="rounded-lg bg-slate-100 px-2.5 py-1.5">Mín. {group.min_selection}</span><span className="rounded-lg bg-slate-100 px-2.5 py-1.5">Máx. {group.max_selection}</span><span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{activeOptions} de {groupOptions.length} opções ativas</span></div>
          <div className="mt-4 divide-y rounded-xl border bg-slate-50 px-3">
            {!groupOptions.length && <p className="py-3 text-sm text-slate-500">Nenhuma opção neste grupo.</p>}
            {groupOptions.slice(0, 5).map((option) => <div key={option.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className={option.is_active ? "font-semibold text-slate-800" : "text-slate-400 line-through"}>{option.name}</span><span className="shrink-0 text-slate-600">{Number(option.price_delta) > 0 ? `+ ${money(option.price_delta)}` : "Sem acréscimo"}</span></div>)}
            {groupOptions.length > 5 && <p className="py-2.5 text-xs font-semibold text-slate-500">+ {groupOptions.length - 5} opções</p>}
          </div>
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Usado nos produtos</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {!linkedProducts.length && <span className="text-sm text-slate-500">Grupo ainda não vinculado.</span>}
              {linkedProducts.map((product) => <form action={unlinkGroupFromProduct} key={product.id} className="inline-flex items-center rounded-full border border-emerald-200 bg-white pl-3 text-sm font-semibold text-slate-700">
                <input type="hidden" name="groupId" value={group.id}/><input type="hidden" name="productId" value={product.id}/>
                <span>{product.name}</span><button className="ml-2 rounded-full px-2 py-1 text-red-600" aria-label={`Desvincular ${product.name}`}>×</button>
              </form>)}
            </div>
            {!!availableProducts.length && <form action={linkGroupToProduct} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="groupId" value={group.id}/>
              <select name="productId" required defaultValue="" className="min-w-0 flex-1 rounded-xl border bg-white p-2.5 text-sm"><option value="" disabled>Selecionar outro produto</option>{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
              <button className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">Vincular produto</button>
            </form>}
          </div>
        </article>;
      })}
    </section>
  </main>;
}


