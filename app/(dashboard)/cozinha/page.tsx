import { getCurrentCompany } from "@/lib/auth/current-company";
import { KitchenBoard, KitchenOrder } from "@/components/kitchen/kitchen-board";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const { supabase, company } = await getCurrentCompany();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, status, service_type, notes, created_at, accepted_at, started_at, ready_at, order_items(product_name, quantity)")
    .eq("company_id", company.id)
    .in("status", ["new", "accepted", "preparing", "ready"])
    .order("created_at", { ascending: true });

  return <main className="space-y-6">
    <header>
      <p className="text-sm font-semibold text-orange-600">Operação em tempo real</p>
      <h1 className="text-3xl font-bold">Painel da cozinha</h1>
      <p className="text-gray-500">Organize a produção da {company.name} por filas e atualize cada pedido.</p>
    </header>
    {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">Não foi possível carregar a cozinha: {error.message}</div>}
    <KitchenBoard initialOrders={(orders || []) as KitchenOrder[]} companyId={company.id} />
  </main>;
}
