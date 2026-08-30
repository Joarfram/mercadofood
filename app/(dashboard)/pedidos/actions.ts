"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";

function refreshOrderViews() {
  revalidatePath("/pedidos");
  revalidatePath("/cozinha");
  revalidatePath("/estoque");
  revalidatePath("/dashboard");
}

export async function createOrder(formData: FormData) {
  const customerName = String(formData.get("customerName") || "").trim();
  const customerPhone = String(formData.get("customerPhone") || "").replace(/\D/g, "");
  let items:unknown[]=[];
  try{const parsed=JSON.parse(String(formData.get("items")||"[]"));items=Array.isArray(parsed)?parsed:[]}catch{redirect("/pedidos?erro=Os itens do pedido não puderam ser lidos.")}
  const serviceType = String(formData.get("serviceType") || "delivery");
  const notes = String(formData.get("notes") || "").trim();
  const paymentMethod = String(formData.get("paymentMethod") || "pix");
  const deliveryStreet = String(formData.get("deliveryStreet") || "").trim();
  const deliveryNeighborhood = String(formData.get("deliveryNeighborhood") || "").trim();
  const deliveryReference = String(formData.get("deliveryReference") || "").trim();
  const couponCode = String(formData.get("couponCode") || "").trim().toUpperCase().replace(/\s+/g, "");
  const redeemLoyalty = formData.get("redeemLoyalty") === "on";
  const idempotencyKey = String(formData.get("idempotencyKey") || "");
  if (!customerName || !items.length) redirect("/pedidos?erro=Preencha cliente e adicione pelo menos um produto.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    redirect("/pedidos?erro=Atualize a página e tente criar o pedido novamente.");
  }

  const { supabase, company } = await requirePlanModule("orders");
  const { data, error } = await supabase.rpc("create_staff_order", {
    p_idempotency_key: idempotencyKey,
    p_payload: {
      company_id: company.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      items,
      service_type: serviceType,
      payment_method: paymentMethod,
      coupon_code: couponCode,
      redeem_loyalty: redeemLoyalty,
      notes,
      delivery_address: { street: deliveryStreet, neighborhood: deliveryNeighborhood, reference: deliveryReference },
    },
  });
  if (error || !data) redirect(`/pedidos?erro=${encodeURIComponent(error?.message || "Erro ao criar pedido")}`);
  const discountAmount = Number((data as { discount_amount?: number }).discount_amount || 0);
  revalidatePath("/pedidos"); revalidatePath("/cozinha"); revalidatePath("/clientes"); revalidatePath("/promocoes");
  redirect(`/pedidos?sucesso=${encodeURIComponent(`Pedido criado. Desconto: R$ ${discountAmount.toFixed(2)}`)}`);
}

export async function revalidateOrderStock(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return;
  const { supabase } = await requirePlanModule("orders");
  const { error } = await supabase.rpc("delivery_simple_revalidate_order_stock", { p_order_id: orderId });
  if (error) redirect(`/pedidos?erro=${encodeURIComponent(error.message)}`);
  refreshOrderViews();
  redirect("/pedidos?sucesso=Reserva%20de%20estoque%20revalidada");
}

export async function confirmOrderPayment(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return;
  const { supabase } = await requirePlanModule("orders");
  const { error } = await supabase.rpc("delivery_simple_confirm_payment", { p_order_id: orderId });
  if (error) redirect(`/pedidos?erro=${encodeURIComponent(error.message)}`);
  refreshOrderViews();
  redirect("/pedidos?sucesso=Pagamento%20confirmado%20e%20estoque%20baixado");
}

export async function updateOrderStatus(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  const status = String(formData.get("status") || "new");
  const allowed = ["new", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "canceled"];
  if (!orderId || !allowed.includes(status)) return;

  const { supabase } = await requirePlanModule("orders");
  const { error } = await supabase.rpc("delivery_simple_transition_order_status", {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) redirect(`/pedidos?erro=${encodeURIComponent(error.message)}`);
  refreshOrderViews();
}
