import { updateOrderStatus } from "./actions";
import { requirePlanModule } from "@/lib/auth/current-company";
import { PrintOrderButton } from "./print-order-button";
import { NewOrderAlert } from "@/components/orders/new-order-alert";
import { StaffOrderCart, type StaffProduct } from "@/components/orders/staff-order-cart";

const labels: Record<string,string> = { new:"Novo", accepted:"Aceito", preparing:"Em preparo", ready:"Pronto", out_for_delivery:"Em entrega", delivered:"Entregue", canceled:"Cancelado" };
const next: Record<string,string | undefined> = { new:"accepted", accepted:"preparing", preparing:"ready", ready:"out_for_delivery", out_for_delivery:"delivered" };
function money(value: number | string | null) { return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number(value || 0)); }

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("orders");
  const idempotencyKey = crypto.randomUUID();
  const [{ data: products }, { data: orders }, { data: printers }] = await Promise.all([
    supabase.from("products").select("id,name,base_price,promotional_price,product_option_groups(id,name,min_selection,max_selection,free_selection,group_type,product_options(id,name,price_delta,max_quantity,is_active))").eq("company_id", company.id).eq("availability_status", "available").eq("is_active", true).eq("product_option_groups.is_active",true).eq("product_option_groups.product_options.is_active",true).order("name"),
    supabase.from("orders").select("id, order_number, customer_name, customer_phone, status, service_type, subtotal, discount_amount, delivery_fee, total, coupon_code, loyalty_points_redeemed, payment_method, payment_status, change_amount, notes, delivery_address, created_at, order_items(product_name, quantity, unit_price, total_price, notes, order_item_options(option_name, quantity, total_price))").eq("company_id", company.id).order("created_at", { ascending:false }).limit(50),
    supabase.from("thermal_printers").select("name,paper_width,print_customer,print_address,print_payment,sector,status").eq("company_id",company.id).eq("status","active").order("created_at").limit(1),
  ]);
  const activePrinter = printers?.[0] || null;
  const staffProducts=(products||[]).map(product=>({id:product.id,name:product.name,price:Number(product.promotional_price||product.base_price),product_option_groups:(product.product_option_groups||[]).map(group=>({...group,free_selection:Number(group.free_selection||0),product_options:(group.product_options||[]).filter(option=>option.is_active).map(option=>({...option,price_delta:Number(option.price_delta||0),max_quantity:Number(option.max_quantity||1)}))}))})) as StaffProduct[];

  return <main className="space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">Fluxo salvo no Supabase</p><h1 className="text-3xl font-bold">Pedidos</h1><p className="text-gray-500">Crie e atualize pedidos reais da {company.name}.</p></header>
    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}
    <NewOrderAlert companyId={company.id} sector="counter"/>

    <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <StaffOrderCart products={staffProducts} idempotencyKey={idempotencyKey}/>

      <div className="space-y-3">
        {!orders?.length && <div className="rounded-2xl border bg-white p-8 text-gray-500">Nenhum pedido criado.</div>}
        {orders?.map(order => {
          const items = order.order_items || [];
          const target = next[order.status];
          return <article key={order.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><p className="text-sm font-semibold text-emerald-700">Pedido #{order.order_number}</p><h2 className="text-xl font-bold">{order.customer_name || "Cliente"}</h2><p className="text-sm text-gray-500">{order.customer_phone || "Sem telefone"} • {order.service_type}</p><p className="mt-2 text-sm">{items.map((i:any) => `${i.quantity}× ${i.product_name}`).join(" • ") || "Itens não carregados"}</p></div>
              <div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{labels[order.status] || order.status}</span><div className="text-right">{Number(order.discount_amount||0)>0&&<p className="text-xs text-gray-400 line-through">{money(order.subtotal)}</p>}<strong>{money(order.total)}</strong>{Number(order.discount_amount||0)>0&&<p className="text-xs font-semibold text-orange-600">Desconto {money(order.discount_amount)}{order.coupon_code?` • ${order.coupon_code}`:""}{Number(order.loyalty_points_redeemed||0)>0?` • ${order.loyalty_points_redeemed} pts`:""}</p>}</div><span className={`rounded-full px-3 py-2 text-sm font-semibold ${order.payment_status === "paid" ? "bg-blue-50 text-blue-800" : "bg-orange-50 text-orange-800"}`}>{order.payment_status === "paid" ? "Pago" : "Pagamento pendente"}</span><PrintOrderButton order={order as any} companyName={company.name} printer={activePrinter}/>{target && <form action={updateOrderStatus}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="status" value={target}/><button className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white">Avançar para {labels[target]}</button></form>}</div>
            </div>
          </article>;
        })}
      </div>
    </section>
  </main>;
}
