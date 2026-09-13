import { requirePlanModule } from "@/lib/auth/current-company";
import { adjustSimpleStock, configureSimpleStock } from "./actions";

const movementLabel: Record<string,string> = {
  entry:"Entrada",
  exit:"Saída",
  adjustment_in:"Ajuste positivo",
  adjustment_out:"Ajuste negativo",
  loss:"Perda",
  return:"Retorno",
  sale:"Venda",
};

function qty(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export default async function SimpleStockPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("stock_basic");

  const [{ data: products }, { data: movements }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,track_stock,stock_quantity,minimum_stock,is_active")
      .eq("company_id", company.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("inventory_movements")
      .select("id,product_id,movement_type,quantity,stock_before,stock_after,notes,created_at,product:products(name)")
      .eq("company_id", company.id)
      .not("product_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const controlled = (products || []).filter(product => product.track_stock);
  const low = controlled.filter(product => Number(product.stock_quantity || 0) <= Number(product.minimum_stock || 0));
  const totalUnits = controlled.reduce((sum, product) => sum + Number(product.stock_quantity || 0), 0);

  return <main className="space-y-6">
    <header>
      <p className="text-sm font-semibold text-emerald-700">Plano Profissional e Premium</p>
      <h1 className="text-3xl font-bold">Estoque simples</h1>
      <p className="text-gray-500">Controle produtos acabados por unidade, com baixa automática quando a venda é confirmada.</p>
    </header>

    {query.erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-4 md:grid-cols-3">
      <Card label="Produtos controlados" value={String(controlled.length)} note="Com estoque ativo" />
      <Card label="Estoque baixo" value={String(low.length)} note="No mínimo ou abaixo" tone={low.length ? "orange" : undefined} />
      <Card label="Unidades em estoque" value={qty(totalUnits)} note="Soma dos produtos controlados" />
    </section>

    {low.length > 0 && <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
      <h2 className="font-bold text-orange-800">Atenção ao estoque</h2>
      <div className="mt-3 flex flex-wrap gap-2">{low.map(product => <span key={product.id} className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-orange-700">{product.name}: {qty(product.stock_quantity)}</span>)}</div>
    </section>}

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Produtos</h2><p className="text-sm text-gray-500">Ative o controle e defina o saldo inicial e o alerta mínimo.</p></div>
        <span className="text-sm text-gray-500">{products?.length || 0} itens</span>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {(products || []).map(product => {
          const isLow = product.track_stock && Number(product.stock_quantity || 0) <= Number(product.minimum_stock || 0);
          return <article key={product.id} className="rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="font-bold">{product.name}</h3><p className="text-sm text-gray-500">{product.track_stock ? `Saldo: ${qty(product.stock_quantity)} · mínimo: ${qty(product.minimum_stock)}` : "Controle de estoque desativado"}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${!product.track_stock ? "bg-gray-100 text-gray-600" : isLow ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>{!product.track_stock ? "Desativado" : isLow ? "Estoque baixo" : "Normal"}</span>
            </div>

            <form action={configureSimpleStock} className="mt-4 grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="productId" value={product.id}/>
              <label className="text-sm font-semibold">Saldo<input name="stockQuantity" type="number" min="0" step="0.001" defaultValue={Number(product.stock_quantity || 0)} className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
              <label className="text-sm font-semibold">Mínimo<input name="minimumStock" type="number" min="0" step="0.001" defaultValue={Number(product.minimum_stock || 0)} className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
              <label className="text-sm font-semibold">Controle<select name="enabled" defaultValue={product.track_stock ? "true" : "false"} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="true">Ativo</option><option value="false">Desativado</option></select></label>
              <button className="sm:col-span-3 rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white">Salvar configuração</button>
            </form>

            {product.track_stock && <form action={adjustSimpleStock} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
              <input type="hidden" name="productId" value={product.id}/>
              <label className="text-sm font-semibold">Movimentação<select name="operation" className="mt-1 w-full rounded-xl border px-3 py-2"><option value="entry">Entrada</option><option value="exit">Saída</option><option value="adjustment_in">Ajuste positivo</option><option value="adjustment_out">Ajuste negativo</option><option value="loss">Perda</option><option value="return">Retorno</option></select></label>
              <label className="text-sm font-semibold">Quantidade<input name="quantity" required type="number" min="0.001" step="0.001" className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
              <label className="text-sm font-semibold sm:col-span-2">Observação<input name="notes" className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Ex.: reposição do fornecedor"/></label>
              <button className="sm:col-span-2 rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white">Registrar movimentação</button>
            </form>}
          </article>;
        })}
      </div>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold">Últimas movimentações</h2>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Saldo</th><th>Observação</th></tr></thead><tbody>{(movements || []).map((movement:any) => {const product = Array.isArray(movement.product) ? movement.product[0] : movement.product; return <tr key={movement.id} className="border-b last:border-0"><td className="py-3">{new Date(movement.created_at).toLocaleString("pt-BR")}</td><td className="font-semibold">{product?.name || "Produto removido"}</td><td>{movementLabel[movement.movement_type] || movement.movement_type}</td><td className={Number(movement.quantity) < 0 ? "text-orange-600" : "text-emerald-700"}>{Number(movement.quantity) > 0 ? "+" : ""}{qty(movement.quantity)}</td><td>{qty(movement.stock_after)}</td><td className="text-gray-500">{movement.notes || "—"}</td></tr>})}</tbody></table></div>
    </section>
  </main>;
}

function Card({label,value,note,tone}:{label:string;value:string;note:string;tone?:"orange"}) {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{label}</p><strong className={`mt-1 block text-2xl ${tone === "orange" ? "text-orange-600" : "text-emerald-700"}`}>{value}</strong><p className="mt-1 text-sm text-gray-500">{note}</p></div>;
}
