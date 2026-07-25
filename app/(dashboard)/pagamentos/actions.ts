"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";

const methods = ["pix", "cash", "card_on_delivery", "online_card", "other"];

export async function updatePayment(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  const method = String(formData.get("method") || "pix");
  const status = String(formData.get("status") || "pending");
  const received = Number(formData.get("amountReceived") || 0);
  if (!orderId || !methods.includes(method) || !["pending", "paid", "canceled", "refunded"].includes(status)) return;

  const { supabase, company } = await getCurrentCompany();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,total")
    .eq("id", orderId)
    .eq("company_id", company.id)
    .single();
  if (orderError || !order) redirect(`/pagamentos?erro=${encodeURIComponent("Pedido não encontrado")}`);

  const total = Number(order.total || 0);
  const amountReceived = method === "cash" && received > 0 ? received : total;
  const changeAmount = method === "cash" ? Math.max(0, amountReceived - total) : 0;
  const paidAt = status === "paid" ? new Date().toISOString() : null;

  const { error: paymentError } = await supabase.from("order_payments").upsert({
    company_id: company.id,
    order_id: orderId,
    method,
    status,
    amount: total,
    amount_received: amountReceived,
    change_amount: changeAmount,
    paid_at: paidAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "order_id" });
  if (paymentError) redirect(`/pagamentos?erro=${encodeURIComponent(paymentError.message)}`);

  const { error: updateError } = await supabase.from("orders").update({
    payment_method: method,
    payment_status: status,
    amount_received: amountReceived,
    change_amount: changeAmount,
    paid_at: paidAt,
  }).eq("id", orderId).eq("company_id", company.id);
  if (updateError) redirect(`/pagamentos?erro=${encodeURIComponent(updateError.message)}`);

  revalidatePath("/pagamentos");
  revalidatePath("/pedidos");
  redirect("/pagamentos?sucesso=Pagamento%20atualizado");
}
