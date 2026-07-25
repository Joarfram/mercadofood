"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { buildPixPayload } from "@/lib/payments/pix";

export async function generatePix(formData: FormData) {
  const orderId = String(formData.get("orderId") || "");
  if (!orderId) return;
  const { supabase, company } = await getCurrentCompany();
  const [{ data: order }, { data: settings }] = await Promise.all([
    supabase.from("orders").select("id,order_number,total").eq("id", orderId).eq("company_id", company.id).single(),
    supabase.from("company_pix_settings").select("pix_key,merchant_name,merchant_city,description,is_active").eq("company_id", company.id).maybeSingle(),
  ]);
  if (!order) redirect("/pagamentos?erro=Pedido%20não%20encontrado");
  if (!settings?.is_active) redirect("/configuracoes/pix?erro=Configure%20o%20PIX%20antes%20de%20gerar%20a%20cobrança");

  const txid = `MF${String(order.order_number).replace(/\D/g, "")}`.slice(0, 25);
  let payload: string;
  try {
    payload = buildPixPayload({
      key: settings.pix_key,
      merchantName: settings.merchant_name,
      merchantCity: settings.merchant_city,
      amount: Number(order.total),
      txid,
      description: settings.description || `Pedido ${order.order_number}`,
    });
  } catch (error) {
    redirect(`/pagamentos/${orderId}?erro=${encodeURIComponent(error instanceof Error ? error.message : "Erro ao gerar PIX")}`);
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60 * 1000);
  const { error } = await supabase.from("order_payments").upsert({
    company_id: company.id,
    order_id: order.id,
    method: "pix",
    status: "pending",
    amount: Number(order.total),
    pix_payload: payload,
    pix_txid: txid,
    pix_generated_at: now.toISOString(),
    pix_expires_at: expires.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: "order_id" });
  if (error) redirect(`/pagamentos/${orderId}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(`/pagamentos/${orderId}`);
  revalidatePath("/pagamentos");
  redirect(`/pagamentos/${orderId}?sucesso=PIX%20gerado`);
}
