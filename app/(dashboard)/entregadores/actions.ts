"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { driverOfferMessage, queueWhatsAppNotification } from "@/lib/notifications/whatsapp";

function trackingCode() {
  return `MF${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function createDriver(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim();
  const vehiclePlate = String(formData.get("vehiclePlate") || "").trim().toUpperCase();
  const defaultDeliveryValue = Math.max(0, Number(formData.get("defaultDeliveryValue") || 0));
  if (!name || !email || !phone) redirect("/entregadores?erro=Informe%20nome%20e%20telefone");

  const { supabase, company } = await getCurrentCompany();
  const { data: branch } = await supabase.from("branches").select("id").eq("company_id", company.id).limit(1).maybeSingle();

  const { error } = await supabase.from("drivers").insert({
    company_id: company.id,
    branch_id: branch?.id || null,
    name,
    email,
    phone,
    whatsapp: whatsapp || phone,
    vehicle_plate: vehiclePlate || null,
    default_delivery_value: defaultDeliveryValue,
    registration_status: "invited",
    invited_at: new Date().toISOString(),
    availability_status: "offline",
  });
  if (error) redirect(`/entregadores?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/entregadores");
  redirect("/entregadores?sucesso=Motoboy%20cadastrado");
}

export async function setDriverAvailability(formData: FormData) {
  const driverId = String(formData.get("driverId") || "");
  const status = String(formData.get("status") || "offline");
  if (!driverId || !["available", "offline"].includes(status)) return;

  const { supabase, company } = await getCurrentCompany();
  await supabase.from("drivers").update({
    availability_status: status,
    last_seen_at: new Date().toISOString(),
  }).eq("id", driverId).eq("company_id", company.id);

  revalidatePath("/entregadores");
}

export async function updateDriver(formData: FormData) {
  const driverId = String(formData.get("driverId") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim();
  const vehiclePlate = String(formData.get("vehiclePlate") || "").trim().toUpperCase();
  const defaultDeliveryValue = Math.max(0, Number(formData.get("defaultDeliveryValue") || 0));
  if (!driverId || !name || !phone) redirect('/entregadores?erro=Preencha%20nome%20e%20telefone');
  const { supabase, company, role } = await getCurrentCompany();
  if (!['owner','manager'].includes(role)) redirect('/sem-permissao');
  const { error } = await supabase.from('drivers').update({ name, phone, whatsapp: whatsapp || phone, vehicle_plate: vehiclePlate || null, default_delivery_value: defaultDeliveryValue }).eq('id',driverId).eq('company_id',company.id);
  if (error) redirect(`/entregadores?erro=${encodeURIComponent(error.message)}`);
  revalidatePath('/entregadores');
  redirect('/entregadores?sucesso=Dados%20do%20motoboy%20atualizados');
}

export async function deleteDriver(formData: FormData) {
  const driverId = String(formData.get('driverId') || '');
  const { supabase, company, role } = await getCurrentCompany();
  if (!['owner','manager'].includes(role)) redirect('/sem-permissao');
  const { count } = await supabase.from('deliveries').select('id',{count:'exact',head:true}).eq('driver_id',driverId).in('status',['offered','accepted','to_store','waiting_pickup','delivering']);
  if (count) redirect('/entregadores?erro=Finalize%20a%20corrida%20ativa%20antes%20de%20excluir');
  const { error } = await supabase.from('drivers').delete().eq('id',driverId).eq('company_id',company.id);
  if (error) redirect(`/entregadores?erro=${encodeURIComponent(error.message)}`);
  revalidatePath('/entregadores');
  redirect('/entregadores?sucesso=Motoboy%20excluído');
}

export async function assignDriver(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  const driverId = String(formData.get("driverId") || "");
  const deliveryValue = Math.max(0, Number(formData.get("deliveryValue") || 0));
  if (!orderId || !driverId) redirect("/entregadores?erro=Escolha%20pedido%20e%20motoboy");

  const { supabase, company } = await getCurrentCompany();
  const [{ data: order }, { data: driver }] = await Promise.all([
    supabase.from("orders").select("id, branch_id, order_number, customer_name, customer_phone, status, service_type, delivery_address").eq("id", orderId).eq("company_id", company.id).single(),
    supabase.from("drivers").select("id, name, whatsapp, phone, availability_status, default_delivery_value").eq("id", driverId).eq("company_id", company.id).single(),
  ]);

  if (!order || order.status !== "ready" || order.service_type !== "delivery") {
    redirect("/entregadores?erro=Pedido%20não%20está%20pronto%20para%20delivery");
  }
  if (!driver || driver.availability_status !== "available") {
    redirect("/entregadores?erro=Motoboy%20não%20está%20disponível");
  }

  const value = deliveryValue || Number(driver.default_delivery_value || 0);
  const { data: delivery, error } = await supabase.from("deliveries").upsert({
    company_id: company.id,
    branch_id: order.branch_id,
    order_id: order.id,
    driver_id: driver.id,
    tracking_code: trackingCode(),
    status: "offered",
    delivery_address: order.delivery_address || {},
    delivery_value: value,
    offered_at: new Date().toISOString(),
  }, { onConflict: "order_id" }).select("id, tracking_code").single();
  if (error || !delivery) redirect(`/entregadores?erro=${encodeURIComponent(error?.message || "Erro ao criar entrega")}`);

  await Promise.all([
    supabase.from("orders").update({ assigned_driver_id: driver.id }).eq("id", order.id).eq("company_id", company.id),
    supabase.from("drivers").update({ availability_status: "called", last_seen_at: new Date().toISOString() }).eq("id", driver.id).eq("company_id", company.id),
    supabase.from("delivery_events").insert({ delivery_id: delivery.id, event_type: "offered", actor_type: "store", payload: { order_id: order.id } }),
  ]);

  const destination = (order.delivery_address || {}) as { neighborhood?: string | null; reference?: string | null };
  await queueWhatsAppNotification({
    supabase,
    companyId: company.id,
    deliveryId: delivery.id,
    recipientType: "driver",
    recipientName: driver.name,
    phone: driver.whatsapp || driver.phone || "",
    template: "driver_offer",
    message: driverOfferMessage({
      driverName: driver.name,
      orderNumber: order.order_number,
      storeName: company.name,
      neighborhood: destination.neighborhood,
      reference: destination.reference,
      deliveryValue: value,
    }),
    metadata: { order_id: order.id, tracking_code: delivery.tracking_code },
  });

  revalidatePath("/entregadores");
  revalidatePath("/pedidos");
  redirect("/entregadores?sucesso=Corrida%20enviada%20ao%20motoboy");
}

export async function createDriverPayout(formData: FormData) {
  const driverId = String(formData.get("driverId") || "");
  if (!driverId) redirect("/entregadores?erro=Escolha%20o%20motoboy");
  const { supabase, role } = await getCurrentCompany();
  if (role !== "owner") redirect("/sem-permissao");
  const { error } = await supabase.rpc("create_driver_payout", { p_driver_id: driverId });
  if (error) redirect(`/entregadores?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/entregadores");
  revalidatePath("/entregador");
  redirect("/entregadores?sucesso=Repasse%20preparado.%20Confira%20o%20PIX%20antes%20de%20pagar");
}

export async function markDriverPayoutPaid(formData: FormData) {
  const payoutId = String(formData.get("payoutId") || "");
  const reference = String(formData.get("reference") || "").trim();
  const { supabase, role } = await getCurrentCompany();
  if (role !== "owner") redirect("/sem-permissao");
  const { error } = await supabase.rpc("mark_driver_payout_paid", { p_payout_id: payoutId, p_reference: reference });
  if (error) redirect(`/entregadores?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/entregadores");
  revalidatePath("/entregador");
  redirect("/entregadores?sucesso=Pagamento%20marcado%20como%20realizado");
}

export async function cancelDriverPayout(formData: FormData) {
  const payoutId = String(formData.get("payoutId") || "");
  const { supabase, role } = await getCurrentCompany();
  if (role !== "owner") redirect("/sem-permissao");
  const { error } = await supabase.rpc("cancel_driver_payout", { p_payout_id: payoutId });
  if (error) redirect(`/entregadores?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/entregadores");
  redirect("/entregadores?sucesso=Repasse%20cancelado");
}
