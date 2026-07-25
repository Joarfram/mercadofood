"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";

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
  if (!customerName || !productId) redirect("/pedidos?erro=Preencha cliente e produto.");

  const { supabase, company, user } = await getCurrentCompany();
  const { data: branch } = await supabase.from("branches").select("id").eq("company_id", company.id).limit(1).maybeSingle();
  let branchId = branch?.id;
  if (!branchId) {
    const { data: createdBranch, error: branchError } = await supabase.from("branches").insert({ company_id: company.id, name: "Matriz", is_open: true }).select("id").single();
    if (branchError) redirect(`/pedidos?erro=${encodeURIComponent(branchError.message)}`);
    branchId = createdBranch.id;
  }

  const { data: product, error: productError } = await supabase.from("products").select("id,name,base_price").eq("id", productId).eq("company_id", company.id).single();
  if (productError || !product) redirect("/pedidos?erro=Produto não encontrado.");

  let customerId: string | null = null;
  let customerPoints = 0;
  if (customerPhone) {
    const { data: existing } = await supabase.from("customers").select("id,loyalty_points").eq("company_id", company.id).eq("phone", customerPhone).maybeSingle();
    if (existing) { customerId = existing.id; customerPoints = Number(existing.loyalty_points || 0); }
    else {
      const { data: createdCustomer, error: customerError } = await supabase.from("customers").insert({ company_id: company.id, name: customerName, phone: customerPhone }).select("id,loyalty_points").single();
      if (customerError) redirect(`/pedidos?erro=${encodeURIComponent(customerError.message)}`);
      customerId = createdCustomer?.id || null;
      customerPoints = Number(createdCustomer?.loyalty_points || 0);
    }
  }

  const subtotal = Number(product.base_price) * quantity;
  let coupon: any = null;
  let couponDiscount = 0;
  if (couponCode) {
    const now = new Date().toISOString();
    const { data } = await supabase.from("coupons").select("*").eq("company_id", company.id).eq("code", couponCode).eq("is_active", true).maybeSingle();
    if (!data) redirect("/pedidos?erro=Cupom inválido ou inativo.");
    if (data.starts_at && data.starts_at > now) redirect("/pedidos?erro=Este cupom ainda não começou.");
    if (data.ends_at && data.ends_at < now) redirect("/pedidos?erro=Este cupom expirou.");
    if (data.usage_limit && Number(data.usage_count) >= Number(data.usage_limit)) redirect("/pedidos?erro=O limite deste cupom foi atingido.");
    if (subtotal < Number(data.minimum_order_value || 0)) redirect(`/pedidos?erro=${encodeURIComponent("Pedido mínimo do cupom: R$ " + Number(data.minimum_order_value).toFixed(2))}`);
    if (customerId && data.per_customer_limit) {
      const { count } = await supabase.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", data.id).eq("customer_id", customerId);
      if ((count || 0) >= Number(data.per_customer_limit)) redirect("/pedidos?erro=Este cliente já atingiu o limite do cupom.");
    }
    coupon = data;
    couponDiscount = data.discount_type === "percentage" ? subtotal * Number(data.discount_value) / 100 : Number(data.discount_value);
    if (data.maximum_discount) couponDiscount = Math.min(couponDiscount, Number(data.maximum_discount));
    couponDiscount = Math.min(subtotal, Math.round(couponDiscount * 100) / 100);
  }

  let loyaltyPointsRedeemed = 0;
  let loyaltyDiscount = 0;
  let loyaltySettings: any = null;
  if (redeemLoyalty) {
    if (!customerId) redirect("/pedidos?erro=Informe o WhatsApp de um cliente cadastrado para usar pontos.");
    const { data: settings } = await supabase.from("loyalty_settings").select("*").eq("company_id", company.id).eq("is_enabled", true).maybeSingle();
    if (!settings) redirect("/pedidos?erro=O programa de fidelidade não está ativo.");
    if (customerPoints < Number(settings.reward_points)) redirect("/pedidos?erro=O cliente ainda não possui pontos suficientes.");
    loyaltySettings = settings;
    loyaltyPointsRedeemed = Number(settings.reward_points);
    loyaltyDiscount = Math.min(subtotal - couponDiscount, Number(settings.reward_value));
  }

  const discountAmount = Math.min(subtotal, couponDiscount + loyaltyDiscount);
  const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const { data: order, error } = await supabase.from("orders").insert({
    company_id: company.id, branch_id: branchId, customer_id: customerId,
    customer_name: customerName, customer_phone: customerPhone || null,
    service_type: serviceType, status: "new", payment_status: "pending", payment_method: paymentMethod,
    subtotal, discount_amount: discountAmount, total, coupon_id: coupon?.id || null, coupon_code: coupon?.code || null,
    loyalty_points_redeemed: loyaltyPointsRedeemed, loyalty_discount_amount: loyaltyDiscount,
    notes: notes || null,
    delivery_address: serviceType === "delivery" ? { street: deliveryStreet, neighborhood: deliveryNeighborhood, reference: deliveryReference } : {},
  }).select("id,order_number").single();
  if (error || !order) redirect(`/pedidos?erro=${encodeURIComponent(error?.message || "Erro ao criar pedido")}`);

  const { error: itemError } = await supabase.from("order_items").insert({ company_id: company.id, order_id: order.id, product_id: product.id, product_name: product.name, unit_price: product.base_price, quantity, total_price: subtotal });
  if (itemError) redirect(`/pedidos?erro=${encodeURIComponent(itemError.message)}`);
  const { error: paymentError } = await supabase.from("order_payments").insert({ company_id: company.id, order_id: order.id, method: paymentMethod, status: "pending", amount: total });
  if (paymentError) redirect(`/pedidos?erro=${encodeURIComponent(paymentError.message)}`);

  if (coupon && couponDiscount > 0) {
    await supabase.from("coupon_redemptions").insert({ company_id: company.id, coupon_id: coupon.id, customer_id: customerId, order_id: order.id, discount_amount: couponDiscount });
    await supabase.from("coupons").update({ usage_count: Number(coupon.usage_count || 0) + 1, updated_at: new Date().toISOString() }).eq("id", coupon.id).eq("company_id", company.id);
  }
  if (loyaltySettings && customerId && loyaltyPointsRedeemed > 0) {
    const nextBalance = Math.max(0, customerPoints - loyaltyPointsRedeemed);
    await supabase.from("customers").update({ loyalty_points: nextBalance, updated_at: new Date().toISOString() }).eq("id", customerId).eq("company_id", company.id);
    await supabase.from("loyalty_movements").insert({ company_id: company.id, customer_id: customerId, order_id: order.id, movement_type: "redeem", points: -loyaltyPointsRedeemed, balance_after: nextBalance, description: `${loyaltySettings.reward_name} no pedido #${order.order_number}`, created_by: user.id });
  }

  revalidatePath("/pedidos"); revalidatePath("/cozinha"); revalidatePath("/clientes"); revalidatePath("/promocoes");
  redirect(`/pedidos?sucesso=${encodeURIComponent(`Pedido criado. Desconto: R$ ${discountAmount.toFixed(2)}`)}`);
}

export async function updateOrderStatus(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  const status = String(formData.get("status") || "new");
  const allowed = ["new", "accepted", "preparing", "ready", "out_for_delivery", "delivered", "canceled"];
  if (!allowed.includes(status)) return;
  const { supabase, company } = await getCurrentCompany();
  const timestamps: Record<string, string> = { accepted: "accepted_at", preparing: "started_at", ready: "ready_at", delivered: "delivered_at", canceled: "canceled_at" };
  const payload: Record<string, string> = { status };
  if (timestamps[status]) payload[timestamps[status]] = new Date().toISOString();
  await supabase.from("orders").update(payload).eq("id", orderId).eq("company_id", company.id);
  revalidatePath("/pedidos"); revalidatePath("/cozinha");
}
