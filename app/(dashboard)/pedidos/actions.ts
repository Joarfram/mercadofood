"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";

export async function createOrder(formData: FormData) {
  const customerName = String(formData.get("customerName") || "").trim();
  const customerPhone = String(formData.get("customerPhone") || "").replace(/\D/g, "");
  const productId = String(formData.get("productId") || "");
  const quantity = Math.max(1, Number(formData.get("quantity") || 1));
  const serviceType = String(formData.get("serviceType") || "delivery");
  const notes = String(formData.get("notes") || "").trim();
  const paymentMethod = String(formData.get("paymentMethod") || "pix");
  const deliveryStreet = String(formData.get("deliveryStreet") || "").trim();
  const deliveryNeighborhood = String(formData.get("deliveryNeighborhood") || "").trim();
  const deliveryReference = String(formData.get("deliveryReference") || "").trim();
  const couponCode = String(formData.get("couponCode") || "").trim().toUpperCase().replace(/\s+/g, "");
  const redeemLoyalty = formData.get("redeemLoyalty") === "on";
  const idempotencyKey = String(formData.get("idempotencyKey") || "");
  if (!customerName || !productId) redirect("/pedidos?erro=Preencha cliente e produto.");
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
      product_id: productId,
      quantity,
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

export async function updateOrderStatus(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  const status = String(formData.get("status") || "new");
  const allowed = ["new", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "canceled"];
  if (!allowed.includes(status)) return;
  const { supabase, company } = await requirePlanModule("orders");
  const timestamps: Record<string, string> = { accepted: "accepted_at", preparing: "started_at", ready: "ready_at", delivered: "delivered_at", canceled: "canceled_at" };
  const payload: Record<string, string> = { status };
  if (timestamps[status]) payload[timestamps[status]] = new Date().toISOString();
  await supabase.from("orders").update(payload).eq("id", orderId).eq("company_id", company.id);
  revalidatePath("/pedidos"); revalidatePath("/cozinha");
}
