"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";

const methods = ["pix", "cash", "debit_card", "credit_card", "card_on_delivery", "online_card", "other"];

export async function updatePayment(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  const method = String(formData.get("method") || "pix");
  const status = String(formData.get("status") || "pending");
  const received = Number(formData.get("amountReceived") || 0);
  if (!orderId || !methods.includes(method) || !["pending", "paid", "canceled", "refunded"].includes(status)) return;

  const { supabase } = await requirePlanModule("payments");
  const { error } = await supabase.rpc("record_order_payment", {
    p_order_id: orderId,
    p_method: method,
    p_status: status,
    p_amount_received: received > 0 ? received : null,
  });
  if (error) redirect(`/financeiro?erro=${encodeURIComponent(error.message)}#pagamentos`);

  revalidatePath("/pagamentos");
  revalidatePath("/financeiro");
  revalidatePath("/pedidos");
  revalidatePath("/estoque");
  revalidatePath("/produtos");
  redirect("/financeiro?sucesso=Pagamento%20atualizado#pagamentos");
}
