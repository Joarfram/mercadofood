"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createTableOrder(token: string, formData: FormData) {
  const customerName = String(formData.get("customerName") || "").trim();
  const customerPhone = String(formData.get("customerPhone") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const itemsRaw = String(formData.get("items") || "[]");
  let items: unknown[] = [];
  try { items = JSON.parse(itemsRaw); } catch { redirect(`/mesa/${token}?erro=Carrinho inválido.`); }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_table_qr_order", { p_token:token, p_customer_name:customerName, p_customer_phone:customerPhone, p_items:items, p_notes:notes || null });
  if (error) redirect(`/mesa/${token}?erro=${encodeURIComponent(error.message)}`);
  redirect(`/mesa/${token}/pedido-confirmado?pedido=${data.order_number}`);
}
