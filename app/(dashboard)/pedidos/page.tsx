import { createOrder, updateOrderStatus } from "./actions";
import { getCurrentCompany } from "@/lib/auth/current-company";

const labels: Record<string,string> = { new:"Novo", accepted:"Aceito", preparing:"Em preparo", ready:"Pronto", out_for_delivery:"Em entrega", delivered:"Entregue", canceled:"Cancelado" };
const next: Record<string,string | undefined> = { new:"accepted", accepted:"preparing", preparing:"ready", ready:"out_for_delivery", out_for_delivery:"delivered" };
function money(value: number | string | null) { return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number(value || 0)); }

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  const [{ data: products }, { data: orders }] = await Promise.all([
    supabase.from("products").select("id, name, base_price").eq("company_id", company.id).eq("availability_status", "available").eq("is_active", true).order("name"),
    supabase.from("orders").select("id, order_number, customer_name, customer_phone, status, service_type, subtotal, discount_amount, total, coupon_code, loyalty_points_redeemed, payment_method, payment_status, change_amount, created_at, order_items(product_name, quantity)").eq("company_id", company.id).order("created_at", { ascending:false }).limit(50),
  ]);

  return <main className="space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">Fluxo salvo no Supabase</p><h1 className="text-3xl font-bold">Pedidos</h1><p className="text-gray-500">Crie e atualize pedidos reais da {company.name}.</p></header>
    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <form action={createOrder} className="h-fit rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Novo pedido</h2>
        <label className="mt-4 block text-sm font-semibold">Cliente</label><input name="customerName" required className="mt-1 w-full rounded-xl border px-3 py-3" />
        <label className="mt-3 block text-sm font-semibold">WhatsApp</label><input name="customerPhone" className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="79 99999-9999" />
        <label className="mt-3 block text-sm font-semibold">Produto</label><select name="productId" required className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Selecione</option>{products?.map(p => <option key={p.id} value={p.id}>{p.name} — {money(p.base_price)}</option>)}</select>
        <div className="mt-3 grid grid-cols-2 gap-3"><div><label className="block text-sm font-semibold">Quantidade</label><input name="quantity" type="number" min="1" defaultValue="1" className="mt-1 w-full rounded-xl border px-3 py-3" /></div><div><label className="block text-sm font-semibold">Atendimento</label><select name="serviceType" className="mt-1 w-full rounded-xl border px-3 py-3"><option value="delivery">Delivery</option><option value="pickup">Retirada</option><option value="dine_in">Salão</option></select></div></div>
        <label className="mt-3 block text-sm font-semibold">Endereço de entrega</label><input name="deliveryStreet" className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Rua, número e complemento" />
        <div className="mt-3 grid grid-cols-2 gap-3"><input name="deliveryNeighborhood" className="w-full rounded-xl border px-3 py-3" placeholder="Bairro" /><input name="deliveryReference" className="w-full rounded-xl border px-3 py-3" placeholder="Referência" /></div>
        <label className="mt-3 block text-sm font-semibold">Cupom de desconto</label><input name="couponCode" className="mt-1 w-full rounded-xl border px-3 py-3 uppercase" placeholder="Ex.: BEMVINDO10"/><label className="mt-3 flex items-center gap-2 rounded-xl bg-orange-50 p-3 text-sm"><input name="redeemLoyalty" type="checkbox"/> Usar recompensa de fidelidade disponível</label><label className="mt-3 block text-sm font-semibold">Forma de pagamento</label><select name="paymentMethod" className="mt-1 w-full rounded-xl border px-3 py-3"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="card_on_delivery">Cartão na entrega</option><option value="online_card">Cartão online</option></select><label className="mt-3 block text-sm font-semibold">Observações</label><textarea name="notes" className="mt-1 min-h-20 w-full rounded-xl border px-3 py-3" />
        <button disabled={!products?.length} className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50">Criar pedido</button>
        {!products?.length && <p className="mt-2 text-sm text-orange-700">Cadastre um produto disponível primeiro.</p>}
      </form>

      <div className="space-y-3">
        {!orders?.length && <div className="rounded-2xl border bg-white p-8 text-gray-500">Nenhum pedido criado.</div>}
        {orders?.map(order => {
          const items = order.order_items || [];
          const target = next[order.status];
          return <article key={order.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><p className="text-sm font-semibold text-emerald-700">Pedido #{order.order_number}</p><h2 className="text-xl font-bold">{order.customer_name || "Cliente"}</h2><p className="text-sm text-gray-500">{order.customer_phone || "Sem telefone"} • {order.service_type}</p><p className="mt-2 text-sm">{items.map((i:any) => `${i.quantity}× ${i.product_name}`).join(" • ") || "Itens não carregados"}</p></div>
              <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{labels[order.status] || order.status}</span><div className="text-right">{Number(order.discount_amount||0)>0&&<p className="text-xs text-gray-400 line-through">{money(order.subtotal)}</p>}<strong>{money(order.total)}</strong>{Number(order.discount_amount||0)>0&&<p className="text-xs font-semibold text-orange-600">Desconto {money(order.discount_amount)}{order.coupon_code?` • ${order.coupon_code}`:""}{Number(order.loyalty_points_redeemed||0)>0?` • ${order.loyalty_points_redeemed} pts`:""}</p>}</div><span className={`rounded-full px-3 py-2 text-sm font-semibold ${order.payment_status === "paid" ? "bg-blue-50 text-blue-800" : "bg-orange-50 text-orange-800"}`}>{order.payment_status === "paid" ? "Pago" : "Pagamento pendente"}</span>{target && <form action={updateOrderStatus}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="status" value={target}/><button className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white">Avançar para {labels[target]}</button></form>}</div>
            </div>
          </article>;
        })}
      </div>
    </section>
  </main>;
}
