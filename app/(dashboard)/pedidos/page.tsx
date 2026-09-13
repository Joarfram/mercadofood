import { updateOrderStatus } from "./actions";
import { requirePlanModule } from "@/lib/auth/current-company";
import { PrintOrderButton } from "./print-order-button";
import { NewOrderAlert } from "@/components/orders/new-order-alert";
import { StaffOrderCart, type StaffProduct } from "@/components/orders/staff-order-cart";
import { Clock3, PackageCheck, ReceiptText, ShoppingBag } from "lucide-react";

const labels: Record<string,string> = { new:"Novo", accepted:"Aceito", preparing:"Em preparo", ready:"Pronto", out_for_delivery:"Em entrega", delivered:"Entregue", canceled:"Cancelado" };
const next: Record<string,string | undefined> = { new:"accepted", accepted:"preparing", preparing:"ready", ready:"out_for_delivery", out_for_delivery:"delivered" };
function money(value: number | string | null) { return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number(value || 0)); }

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await requirePlanModule("orders");
  const idempotencyKey = crypto.randomUUID();
  const [{ data: products, error: productsError }, { data: orders, error: ordersError }, { data: printers, error: printersError }] = await Promise.all([
    supabase.from("products").select("id,name,base_price,promotional_price,product_option_group_links!product_option_group_links_product_id_fkey(is_active,product_option_groups!product_option_group_links_group_id_fkey(id,name,min_selection,max_selection,free_selection,group_type,is_active,product_options(id,name,price_delta,max_quantity,is_active)))").eq("company_id", company.id).eq("availability_status", "available").eq("is_active", true).eq("product_option_group_links.is_active",true).eq("product_option_group_links.product_option_groups.is_active",true).eq("product_option_group_links.product_option_groups.product_options.is_active",true).order("name"),
    supabase.from("orders").select("id, order_number, customer_name, customer_phone, status, service_type, subtotal, discount_amount, delivery_fee, total, coupon_code, loyalty_points_redeemed, payment_method, payment_status, change_amount, notes, delivery_address, created_at, order_items(product_name, quantity, unit_price, total_price, notes, order_item_options(option_name, quantity, total_price))").eq("company_id", company.id).order("created_at", { ascending:false }).limit(50),
    supabase.from("thermal_printers").select("name,paper_width,print_customer,print_address,print_payment,sector,status").eq("company_id",company.id).eq("status","active").order("created_at").limit(1),
  ]);
  const activePrinter = printers?.[0] || null;
  const loadError = productsError || ordersError || printersError;
  if (loadError) console.error("[pedidos] falha ao carregar dados", { code: loadError.code, message: loadError.message });
  const staffProducts=(products||[]).map(product=>({
    id:product.id,
    name:product.name,
    price:Number(product.promotional_price||product.base_price),
    product_option_groups:(product.product_option_group_links||[]).flatMap(link=>{
      const group=Array.isArray(link.product_option_groups) ? link.product_option_groups[0] : link.product_option_groups;
      return group ? [{...group,free_selection:Number(group.free_selection||0),product_options:(group.product_options||[]).filter(option=>option.is_active).map(option=>({...option,price_delta:Number(option.price_delta||0),max_quantity:Number(option.max_quantity||1)}))}] : [];
    }),
  })) as StaffProduct[];

  const today = new Date().toLocaleDateString("pt-BR");
  const openOrders = (orders || []).filter(order => !["delivered","canceled"].includes(order.status));
  const pendingPayments = (orders || []).filter(order => order.payment_status !== "paid" && order.status !== "canceled");
  const readyOrders = (orders || []).filter(order => ["ready","out_for_delivery"].includes(order.status));

  return <main className="min-w-0 space-y-6 pb-10">
    <section className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Central operacional</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Pedidos</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">Acompanhe novos pedidos, pagamento, preparo e saída em uma visão mais rápida da {company.name}.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[430px]">
          <div className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-slate-300">Em andamento</p><strong className="mt-1 block text-2xl">{openOrders.length}</strong></div>
          <div className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-slate-300">A receber</p><strong className="mt-1 block text-2xl">{pendingPayments.length}</strong></div>
          <div className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-slate-300">Prontos</p><strong className="mt-1 block text-2xl">{readyOrders.length}</strong></div>
        </div>
      </div>
    </section>

    {query.erro && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">{query.sucesso}</div>}
    {loadError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">Não foi possível carregar todos os dados dos pedidos. Atualize a página; se continuar, informe o suporte.</div>}
    <NewOrderAlert companyId={company.id} sector="counter"/>

    <section className="grid min-w-0 gap-6 2xl:grid-cols-[400px_minmax(0,1fr)]">
      <div className="2xl:sticky 2xl:top-5 2xl:self-start">
        <StaffOrderCart products={staffProducts} idempotencyKey={idempotencyKey}/>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Fila do dia</p><h2 className="text-2xl font-black text-slate-900">Pedidos recentes</h2></div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{today}</span>
        </div>

        {!orders?.length && <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-gray-500"><ShoppingBag className="mx-auto mb-3"/>Nenhum pedido criado.</div>}
        {orders?.map(order => {
          const items = order.order_items || [];
          const target = next[order.status];
          return <article key={order.id} className="overflow-hidden rounded-3xl border bg-white shadow-sm transition-shadow hover:shadow-md">
            <div className="flex flex-col gap-4 border-b bg-slate-50/70 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">#{order.order_number}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{labels[order.status] || order.status}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${order.payment_status === "paid" ? "bg-blue-50 text-blue-800" : "bg-orange-50 text-orange-800"}`}>{order.payment_status === "paid" ? "Pago" : "Pagamento pendente"}</span></div>
                <h3 className="mt-3 truncate text-xl font-black text-slate-900">{order.customer_name || "Cliente"}</h3>
                <p className="mt-1 text-sm text-slate-500">{order.customer_phone || "Sem telefone"} • {order.service_type}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-left shadow-sm lg:text-right"><p className="text-xs font-semibold text-slate-500">Total do pedido</p>{Number(order.discount_amount||0)>0&&<p className="text-xs text-gray-400 line-through">{money(order.subtotal)}</p>}<strong className="text-2xl text-slate-950">{money(order.total)}</strong>{Number(order.discount_amount||0)>0&&<p className="text-xs font-semibold text-orange-600">Desconto {money(order.discount_amount)}{order.coupon_code?` • ${order.coupon_code}`:""}</p>}</div>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><ReceiptText size={15}/> Itens</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{items.map((i:any) => `${i.quantity}× ${i.product_name}`).join(" • ") || "Itens não carregados"}</p>
                {Number(order.loyalty_points_redeemed||0)>0 && <p className="mt-2 text-xs font-semibold text-orange-600">{order.loyalty_points_redeemed} pontos utilizados</p>}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end"><PrintOrderButton order={order as any} companyName={company.name} printer={activePrinter}/>{target && <form action={updateOrderStatus}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="status" value={target}/><button className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-emerald-800"><PackageCheck size={17}/>Avançar para {labels[target]}</button></form>}</div>
            </div>
          </article>;
        })}
      </div>
    </section>
  </main>;
}
