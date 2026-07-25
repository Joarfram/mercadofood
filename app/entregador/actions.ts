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

const transitions: Record<string, { next: string; event: string; timestamp?: string }> = {
  accepted: { next: "to_store", event: "to_store" },
  to_store: { next: "waiting_pickup", event: "arrived_store", timestamp: "arrived_store_at" },
  waiting_pickup: { next: "delivering", event: "picked_up", timestamp: "picked_up_at" },
  delivering: { next: "completed", event: "completed", timestamp: "completed_at" },
};

export async function advanceOwnDelivery(formData: FormData) {
  const deliveryId = String(formData.get("deliveryId") || "");
  const currentStatus = String(formData.get("currentStatus") || "");
  const transition = transitions[currentStatus];
  if (!transition) return;
  const { supabase, driver } = await currentDriver();
  const { data: delivery } = await supabase.from("deliveries")
    .select("id, order_id, status, tracking_code, orders(order_number, customer_name, customer_phone), drivers(name), companies(name)")
    .eq("id", deliveryId).eq("driver_id", driver.id).single();
  if (!delivery || delivery.status !== currentStatus) return;
  const payload: Record<string, string> = { status: transition.next };
  if (transition.timestamp) payload[transition.timestamp] = new Date().toISOString();
  if (transition.next === "delivering") payload.started_at = new Date().toISOString();
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
}
