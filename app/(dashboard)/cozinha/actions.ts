"use server";

import { revalidatePath } from "next/cache";
import { requirePlanModule } from "@/lib/auth/current-company";

const allowedTransitions: Record<string, string[]> = {
  new: ["accepted", "canceled"],
  accepted: ["preparing", "canceled"],
  preparing: ["ready", "canceled"],
  ready: ["out_for_delivery", "delivered", "canceled"],
};

export async function advanceKitchenOrder(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  const currentStatus = String(formData.get("currentStatus") || "");
  const nextStatus = String(formData.get("nextStatus") || "");
  if (!orderId || !allowedTransitions[currentStatus]?.includes(nextStatus)) return;

  const { supabase, company } = await requirePlanModule("kitchen");
  const timestamps: Record<string, string> = {
    accepted: "accepted_at",
    preparing: "started_at",
    ready: "ready_at",
    delivered: "delivered_at",
    canceled: "canceled_at",
  };
  const payload: Record<string, string> = { status: nextStatus };
  if (timestamps[nextStatus]) payload[timestamps[nextStatus]] = new Date().toISOString();

  await supabase
    .from("orders")
    .update(payload)
    .eq("id", orderId)
    .eq("company_id", company.id)
    .eq("status", currentStatus);

  revalidatePath("/cozinha");
  revalidatePath("/pedidos");
}
