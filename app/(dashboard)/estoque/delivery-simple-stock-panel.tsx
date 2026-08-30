import Link from "next/link";
import { addProductStockMovement } from "./actions";

const unitLabel: Record<string,string> = {unit:"un",un:"un",g:"g",kg:"kg"};
const movementLabel: Record<string,string> = {
  entry:"Entrada", sale_delivery:"Venda delivery", sale_store:"Venda loja",
  adjustment_in:"Ajuste positivo", adjustment_out:"Ajuste negativo", loss:"Perda", return:"Retorno",
};
function qty(value:number|string|null|undefined){return Number(value||0).toLocaleString("pt-BR",{maximumFractionDigits:3});}

type ProductRow={id:string;name:string;selling_mode:string|null;stock_unit:string|null;physical:number;reserved:number;available:number;minimum:number;low:boolean};
type Movement={id:string;movement_type:string;quantity:number|string;unit:string;stock_before:number|string;stock_after:number|string;notes:string|null;created_at:string;product:any};

export function DeliverySimpleStockPanel({query,products,movements}:{query:{erro?:string;sucesso?:string};products:ProductRow[];movements:Movement[]}){
  const lowProducts=products.filter(p=>p.low);
  const unavailableProducts=products.filter(p=>p.available<=0);
  const totalReserved=products.reduce((sum,p)=>sum+p.reserved,0);
  return <main className="space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">Gestão Delivery Simples</p><h1 className="text-3xl font-bold">Estoque de produtos</h1><p className="text-gray-500">Controle o mesmo saldo usado no cardápio, nos pedidos online e nas vendas feitas diretamente na loja.</p></header>
    {query.erro&&<div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso&&<div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card label="Produtos controlados" value={String(products.length)} note="Com controle de estoque ativo"/>
      <Card label="Estoque baixo" value={String(lowProducts.length)} note="No mínimo ou abaixo" tone={lowProducts.length?"orange":undefined}/>
      <Card label="Sem estoque" value={String(unavailableProducts.length)} note="Considerando reservas" tone={unavailableProducts.length?"orange":undefined}/>
      <Card label="Reservado" value={qty(totalReserved)} note="Separado para pedidos"/>
    </section>

    {lowProducts.length>0&&<section className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold text-orange-900">Atenção ao estoque</h2><p className="text-sm text-orange-800">Estes produtos chegaram ao estoque mínimo ou ficaram sem saldo disponível. Você pode repor daqui mesmo.</p></div><span className="w-fit rounded-full bg-white px-3 py-1 text-sm font-bold text-orange-700">{lowProducts.length} item(ns)</span></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{lowProducts.map(product=>{
        const unit=unitLabel[product.stock_unit||"unit"]||product.stock_unit||"un";
        const suggested=Math.max(product.minimum*2-product.physical, product.minimum-product.available, product.stock_unit==="unit"?1:0.001);
        return <article key={product.id} className="rounded-xl border border-orange-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{product.name}</h3><p className="mt-1 text-sm text-gray-600">Disponível: <b className={product.available<=0?"text-red-700":"text-orange-700"}>{qty(product.available)} {unit}</b> • mínimo: {qty(product.minimum)} {unit}</p>{product.reserved>0&&<p className="mt-1 text-xs text-gray-500">Há {qty(product.reserved)} {unit} reservado(s) para pedidos.</p>}</div><span className={`rounded-full px-3 py-1 text-xs font-bold ${product.available<=0?"bg-red-50 text-red-700":"bg-orange-100 text-orange-800"}`}>{product.available<=0?"Sem estoque":"Estoque baixo"}</span></div>
          <form action={addProductStockMovement} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="productId" value={product.id}/><input type="hidden" name="movementType" value="entry"/><input type="hidden" name="notes" value="Reposição rápida pelo alerta de estoque"/>
            <label className="flex-1 text-sm font-semibold">Quantidade para repor<input name="quantity" type="number" min="0.001" step="0.001" defaultValue={Number(suggested.toFixed(3))} required className="mt-1 w-full rounded-xl border px-3 py-2"/></label>
            <button className="rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white">Repor agora</button>
          </form>
          <p className="mt-2 text-xs text-gray-500">Quantidade em {unit}. A sugestão tenta deixar o saldo acima do mínimo.</p>
        </article>})}</div>
    </section>}

    <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Saldo atual</h2><p className="text-sm text-gray-500">Físico menos reservado = disponível para novas vendas.</p></div><Link href="/produtos" className="text-sm font-bold text-emerald-700">Gerenciar produtos</Link></div>
        {!products.length?<p className="mt-4 rounded-xl bg-gray-50 p-5 text-gray-500">Ative o controle de estoque em pelo menos um produto.</p>:<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Produto</th><th>Físico</th><th>Reservado</th><th>Disponível</th><th>Mínimo</th><th>Situação</th></tr></thead><tbody>{products.map(product=><tr key={product.id} className="border-b last:border-0"><td className="py-4 font-semibold">{product.name}</td><td>{qty(product.physical)} {unitLabel[product.stock_unit||"unit"]||product.stock_unit}</td><td className={product.reserved>0?"font-semibold text-orange-600":"text-gray-500"}>{qty(product.reserved)} {unitLabel[product.stock_unit||"unit"]||product.stock_unit}</td><td className={product.low?"font-bold text-orange-600":"font-bold text-emerald-700"}>{qty(product.available)} {unitLabel[product.stock_unit||"unit"]||product.stock_unit}</td><td>{qty(product.minimum)} {unitLabel[product.stock_unit||"unit"]||product.stock_unit}</td><td><span className={`rounded-full px-3 py-1 text-xs font-bold ${product.available<=0?"bg-red-50 text-red-700":product.low?"bg-orange-50 text-orange-700":"bg-emerald-50 text-emerald-700"}`}>{product.available<=0?"Sem estoque":product.low?"Estoque baixo":"Normal"}</span></td></tr>)}</tbody></table></div>}
      </div>

      <form action={addProductStockMovement} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Registrar movimentação</h2><p className="mt-1 text-sm text-gray-500">Use para entrada de compra, venda no balcão, perda, retorno ou correção de saldo.</p>
        <label className="mt-4 block text-sm font-semibold">Produto</label><select name="productId" required className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Selecione</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — disponível {qty(p.available)} {unitLabel[p.stock_unit||"unit"]||p.stock_unit}</option>)}</select>
        <label className="mt-3 block text-sm font-semibold">Tipo</label><select name="movementType" className="mt-1 w-full rounded-xl border px-3 py-3"><option value="entry">Entrada de mercadoria</option><option value="sale_store">Venda feita na loja</option><option value="loss">Perda</option><option value="return">Retorno ao estoque</option><option value="adjustment_in">Ajuste positivo</option><option value="adjustment_out">Ajuste negativo</option></select>
        <label className="mt-3 block text-sm font-semibold">Quantidade</label><input name="quantity" type="number" min="0.001" step="0.001" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Ex.: 10 ou 500"/><p className="mt-1 text-xs text-gray-500">Informe na unidade cadastrada no produto: un, g ou kg.</p>
        <label className="mt-3 block text-sm font-semibold">Custo unitário da entrada <span className="font-normal text-gray-400">(opcional)</span></label><input name="unitCost" type="number" min="0" step="0.0001" className="mt-1 w-full rounded-xl border px-3 py-3"/>
        <label className="mt-3 block text-sm font-semibold">Observação</label><input name="notes" className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Ex.: compra fornecedor X ou venda balcão"/>
        <button className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Registrar movimentação</button>
      </form>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Histórico</h2><p className="mt-1 text-sm text-gray-500">Todas as alterações ficam registradas para conferência.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Data</th><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Antes</th><th>Depois</th><th>Observação</th></tr></thead><tbody>{!movements.length?<tr><td colSpan={7} className="py-6 text-center text-gray-500">Nenhuma movimentação registrada.</td></tr>:movements.map(m=>{const product=Array.isArray(m.product)?m.product[0]:m.product;return <tr key={m.id} className="border-b last:border-0"><td className="py-3">{new Date(m.created_at).toLocaleString("pt-BR")}</td><td className="font-semibold">{product?.name||"Produto"}</td><td>{movementLabel[m.movement_type]||m.movement_type}</td><td className={Number(m.quantity)<0?"text-orange-600":"text-emerald-700"}>{Number(m.quantity)>0?"+":""}{qty(m.quantity)} {unitLabel[m.unit]||m.unit}</td><td>{qty(m.stock_before)} {unitLabel[m.unit]||m.unit}</td><td>{qty(m.stock_after)} {unitLabel[m.unit]||m.unit}</td><td className="text-gray-500">{m.notes||"—"}</td></tr>})}</tbody></table></div></section>
  </main>;
}

function Card({label,value,note,tone}:{label:string;value:string;note:string;tone?:"orange"}){return <div className={`rounded-2xl border bg-white p-5 shadow-sm ${tone==="orange"?"border-orange-200":""}`}><p className="text-sm text-gray-500">{label}</p><p className={`mt-2 text-3xl font-bold ${tone==="orange"?"text-orange-600":""}`}>{value}</p><p className="mt-1 text-xs text-gray-400">{note}</p></div>}
