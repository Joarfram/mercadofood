"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";

export async function createTable(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const seats = Math.max(1, Number(formData.get("seats") || 4));
  if (!name || !code) redirect("/mesas?erro=Informe nome e código da mesa.");
  const { supabase, company } = await getCurrentCompany();
  const { data: branch } = await supabase.from("branches").select("id").eq("company_id", company.id).limit(1).maybeSingle();
  const { error } = await supabase.from("restaurant_tables").insert({ company_id: company.id, branch_id: branch?.id || null, name, code, seats });
  if (error) redirect(`/mesas?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/mesas"); redirect("/mesas?sucesso=Mesa cadastrada.");
}

export async function openTab(formData: FormData) {
  const tableId = String(formData.get("tableId") || "");
  const customerName = String(formData.get("customerName") || "").trim();
  const customerPhone = String(formData.get("customerPhone") || "").replace(/\D/g, "");
  const guestCount = Math.max(1, Number(formData.get("guestCount") || 1));
  const { supabase, company, user } = await getCurrentCompany();
  const { data: table } = await supabase.from("restaurant_tables").select("id,branch_id").eq("id", tableId).eq("company_id", company.id).single();
  if (!table) redirect("/mesas?erro=Mesa não encontrada.");
  const { error } = await supabase.from("table_tabs").insert({ company_id: company.id, branch_id: table.branch_id, table_id: table.id, customer_name: customerName || null, customer_phone: customerPhone || null, guest_count: guestCount, created_by: user.id });
  if (error) redirect(`/mesas?erro=${encodeURIComponent(error.message)}`);
  await supabase.from("restaurant_tables").update({ status: "occupied", updated_at: new Date().toISOString() }).eq("id", tableId).eq("company_id", company.id);
  revalidatePath("/mesas"); redirect("/mesas?sucesso=Comanda aberta.");
}

export async function requestClosing(formData: FormData) {
  const tabId = String(formData.get("tabId") || "");
  const { supabase, company } = await getCurrentCompany();
  await supabase.from("table_tabs").update({ status:"requested_closing", requested_closing_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq("id",tabId).eq("company_id",company.id);
  revalidatePath("/mesas");
}

export async function closeTab(formData: FormData) {
  const tabId = String(formData.get("tabId") || "");
  const paymentMethod = String(formData.get("paymentMethod") || "cash");
  const { supabase, company } = await getCurrentCompany();
  const { data: tab } = await supabase.from("table_tabs").select("id,table_id,total").eq("id",tabId).eq("company_id",company.id).single();
  if (!tab) return;
  await supabase.from("orders").update({ payment_status:"paid", payment_method:paymentMethod, paid_at:new Date().toISOString() }).eq("table_tab_id",tab.id).eq("company_id",company.id).neq("status","canceled");
  await supabase.from("table_tabs").update({ status:"closed", closed_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq("id",tab.id).eq("company_id",company.id);
  await supabase.from("restaurant_tables").update({ status:"available", updated_at:new Date().toISOString() }).eq("id",tab.table_id).eq("company_id",company.id);
  revalidatePath("/mesas"); revalidatePath("/pagamentos"); revalidatePath("/financeiro");
}
