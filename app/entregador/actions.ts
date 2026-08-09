"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { customerDeliveredMessage, customerOutForDeliveryMessage, queueWhatsAppNotification } from "@/lib/notifications/whatsapp";

async function currentDriver() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entregador/login");
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, company_id, availability_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!driver) redirect("/entregador/login?erro=Conta%20não%20vinculada%20a%20um%20motoboy");
  return { supabase, driver };
}

export async function driverSignIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/entregador/login?erro=${encodeURIComponent("E-mail ou senha incorretos")}`);
  redirect("/entregador");
}

export async function driverSignUp(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || password.length < 6) redirect("/entregador/cadastro?erro=Use%20uma%20senha%20com%20pelo%20menos%206%20caracteres");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) redirect(`/entregador/cadastro?erro=${encodeURIComponent(error.message)}`);
  redirect("/entregador/login?sucesso=Conta%20criada.%20Entre%20com%20seus%20dados");
}

export async function driverSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entregador/login");
}

export async function setOwnAvailability(formData: FormData) {
  const status = String(formData.get("status") || "offline");
  if (!["available", "offline"].includes(status)) return;
  const { supabase, driver } = await currentDriver();
  await supabase.from("drivers").update({ availability_status: status, last_seen_at: new Date().toISOString() }).eq("id", driver.id);
  revalidatePath("/entregador");
}

export async function respondToDelivery(formData: FormData) {
  const deliveryId = String(formData.get("deliveryId") || "");
  const response = String(formData.get("response") || "");
  const { supabase, driver } = await currentDriver();
  const { data: delivery } = await supabase.from("deliveries").select("id, order_id, status").eq("id", deliveryId).eq("driver_id", driver.id).single();
  if (!delivery || delivery.status !== "offered") return;
  if (response === "accept") {
    await supabase.from("deliveries").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", delivery.id);
    await supabase.from("drivers").update({ availability_status: "busy" }).eq("id", driver.id);
    await supabase.from("delivery_events").insert({ delivery_id: delivery.id, event_type: "accepted", actor_type: "driver", actor_id: driver.id });
  } else if (response === "decline") {
    await supabase.from("deliveries").update({ status: "waiting_assignment", driver_id: null, offered_at: null }).eq("id", delivery.id);
    await supabase.from("orders").update({ assigned_driver_id: null }).eq("id", delivery.order_id);
    await supabase.from("drivers").update({ availability_status: "available" }).eq("id", driver.id);
  }
  revalidatePath("/entregador");
}

export async function saveOwnPayoutProfile(formData: FormData) {
  const { supabase } = await currentDriver();
  const { error } = await supabase.rpc("update_own_driver_payout_profile", {
    p_method: String(formData.get("payoutMethod") || "pix"),
    p_pix_key_type: String(formData.get("pixKeyType") || "random"),
    p_pix_key: String(formData.get("pixKey") || "").trim(),
    p_holder_name: String(formData.get("holderName") || "").trim(),
    p_city: String(formData.get("city") || "").trim(),
    p_bank_name: String(formData.get("bankName") || "").trim(),
    p_bank_branch: String(formData.get("bankBranch") || "").trim(),
    p_bank_account: String(formData.get("bankAccount") || "").trim(),
    p_bank_account_type: String(formData.get("bankAccountType") || "checking"),
  });
  if (error) redirect(`/entregador?tab=perfil&erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/entregador");
  redirect("/entregador?tab=perfil&sucesso=Dados%20de%20recebimento%20salvos");
}

export async function confirmOwnPayout(formData: FormData) {
  const payoutId = String(formData.get("payoutId") || "");
  if (!payoutId) return;
  const { supabase } = await currentDriver();
  const { error } = await supabase.rpc("confirm_own_driver_payout", { p_payout_id: payoutId });
  if (error) redirect(`/entregador?tab=ganhos&erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/entregador");
  redirect("/entregador?tab=ganhos&sucesso=Recebimento%20confirmado");
}

const transitions: Record<string, { next: string; event: string; timestamp?: string }> = {
  accepted: { next: "to_store", event: "to_store" },
  to_store: { next: "waiting_pickup", event: "arrived_store", timestamp: "arrived_store_at" },
};

export async function advanceOwnDelivery(formData: FormData) {
  const deliveryId = String(formData.get("deliveryId") || "");
  const currentStatus = String(formData.get("currentStatus") || "");
  if (currentStatus === "waiting_pickup") return startOwnDelivery(formData);
  const transition = transitions[currentStatus];
  if (!transition) return;
  const { supabase, driver } = await currentDriver();
  const { data: delivery } = await supabase.from("deliveries")
    .select("id, order_id, status, tracking_code, orders(order_number, customer_name, customer_phone), drivers(name), companies(name)")
    .eq("id", deliveryId).eq("driver_id", driver.id).single();
  if (!delivery || delivery.status !== currentStatus) return;
  const payload: Record<string, string> = { status: transition.next };
  if (transition.timestamp) payload[transition.timestamp] = new Date().toISOString();
  if (transition.next === "to_store") payload.started_at = new Date().toISOString();
  await supabase.from("deliveries").update(payload).eq("id", delivery.id);
  await supabase.from("delivery_events").insert({ delivery_id: delivery.id, event_type: transition.event, actor_type: "driver", actor_id: driver.id });
  const order = Array.isArray(delivery.orders) ? delivery.orders[0] : delivery.orders;
  const driverInfo = Array.isArray(delivery.drivers) ? delivery.drivers[0] : delivery.drivers;
  const company = Array.isArray(delivery.companies) ? delivery.companies[0] : delivery.companies;

  if (transition.next === "delivering") {
    await supabase.from("orders").update({ status: "out_for_delivery" }).eq("id", delivery.order_id);
    await queueWhatsAppNotification({
      supabase,
      companyId: driver.company_id,
      deliveryId: delivery.id,
      recipientType: "customer",
      recipientName: order?.customer_name,
      phone: order?.customer_phone || "",
      template: "customer_out_for_delivery",
      message: customerOutForDeliveryMessage({
        customerName: order?.customer_name,
        orderNumber: order?.order_number || "—",
        storeName: company?.name || "MercadoFood",
        driverName: driverInfo?.name,
        trackingCode: delivery.tracking_code,
      }),
      metadata: { order_id: delivery.order_id, tracking_code: delivery.tracking_code },
    });
  }
  if (transition.next === "completed") {
    await supabase.from("orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", delivery.order_id);
    await supabase.from("drivers").update({ availability_status: "available" }).eq("id", driver.id);
    await queueWhatsAppNotification({
      supabase,
      companyId: driver.company_id,
      deliveryId: delivery.id,
      recipientType: "customer",
      recipientName: order?.customer_name,
      phone: order?.customer_phone || "",
      template: "customer_delivered",
      message: customerDeliveredMessage({
        customerName: order?.customer_name,
        orderNumber: order?.order_number || "—",
        storeName: company?.name || "MercadoFood",
      }),
      metadata: { order_id: delivery.order_id },
    });
  }
  revalidatePath("/entregador");
  if (transition.next === "completed") redirect("/entregador?entrega=concluida");
}

export async function startOwnDelivery(formData: FormData) {
  const deliveryId = String(formData.get("deliveryId") || "");
  const { supabase, driver } = await currentDriver();
  const { data: delivery } = await supabase.from("deliveries")
    .select("id, order_id, tracking_code, orders(order_number, customer_name, customer_phone), drivers(name), companies(name)")
    .eq("id", deliveryId).eq("driver_id", driver.id).single();
  if (!delivery) redirect("/entregador?erro=Entrega%20não%20encontrada");
  const { data, error } = await supabase.rpc("start_delivery_with_confirmation", { p_delivery_id: deliveryId });
  if (error) redirect(`/entregador?erro=${encodeURIComponent(error.message)}`);
  const result = data as { ok?: boolean; confirmation_code?: string } | null;
  if (!result?.ok || !result.confirmation_code) redirect("/entregador?erro=Não%20foi%20possível%20gerar%20o%20código");
  const order = Array.isArray(delivery.orders) ? delivery.orders[0] : delivery.orders;
  const driverInfo = Array.isArray(delivery.drivers) ? delivery.drivers[0] : delivery.drivers;
  const company = Array.isArray(delivery.companies) ? delivery.companies[0] : delivery.companies;
  await queueWhatsAppNotification({
    supabase, companyId: driver.company_id, deliveryId: delivery.id, recipientType: "customer",
    recipientName: order?.customer_name, phone: order?.customer_phone || "", template: "customer_out_for_delivery",
    message: customerOutForDeliveryMessage({ customerName: order?.customer_name, orderNumber: order?.order_number || "—",
      storeName: company?.name || "MercadoFood", driverName: driverInfo?.name,
      trackingCode: delivery.tracking_code, confirmationCode: result.confirmation_code }),
    metadata: { order_id: delivery.order_id, tracking_code: delivery.tracking_code },
  });
  revalidatePath("/entregador");
  redirect("/entregador?sucesso=Pedido%20retirado.%20Código%20enviado%20ao%20cliente");
}

export async function confirmOwnDelivery(formData: FormData) {
  const deliveryId = String(formData.get("deliveryId") || "");
  const code = String(formData.get("confirmationCode") || "").replace(/\D/g, "");
  if (code.length !== 6) redirect("/entregador?erro=Digite%20o%20código%20de%206%20dígitos");
  const { supabase, driver } = await currentDriver();
  const { data: delivery } = await supabase.from("deliveries")
    .select("id, order_id, orders(order_number, customer_name, customer_phone), companies(name)")
    .eq("id", deliveryId).eq("driver_id", driver.id).single();
  if (!delivery) redirect("/entregador?erro=Entrega%20não%20encontrada");
  const { data, error } = await supabase.rpc("confirm_delivery_with_code", { p_delivery_id: deliveryId, p_code: code });
  if (error) redirect(`/entregador?erro=${encodeURIComponent(error.message)}`);
  const result = data as { ok?: boolean; message?: string } | null;
  if (!result?.ok) redirect(`/entregador?erro=${encodeURIComponent(result?.message || "Código inválido")}`);
  const order = Array.isArray(delivery.orders) ? delivery.orders[0] : delivery.orders;
  const company = Array.isArray(delivery.companies) ? delivery.companies[0] : delivery.companies;
  await queueWhatsAppNotification({ supabase, companyId: driver.company_id, deliveryId: delivery.id,
    recipientType: "customer", recipientName: order?.customer_name, phone: order?.customer_phone || "",
    template: "customer_delivered", message: customerDeliveredMessage({ customerName: order?.customer_name,
      orderNumber: order?.order_number || "—", storeName: company?.name || "MercadoFood" }), metadata: { order_id: delivery.order_id } });
  revalidatePath("/entregador");
  redirect("/entregador?entrega=concluida");
}
