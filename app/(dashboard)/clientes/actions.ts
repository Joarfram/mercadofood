"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";

function numberValue(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(String(value ?? fallback).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function createCustomer(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").replace(/\D/g, "");
  const email = String(formData.get("email") || "").trim() || null;
  const birthDate = String(formData.get("birthDate") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const marketingConsent = formData.get("marketingConsent") === "on";
  if (name.length < 2 || phone.length < 8) redirect("/clientes?erro=Informe nome e telefone válidos.");
  const { error } = await supabase.from("customers").insert({ company_id: company.id, name, phone, email, birth_date: birthDate, notes, marketing_consent: marketingConsent });
  if (error) redirect(`/clientes?erro=${encodeURIComponent(error.code === "23505" ? "Telefone já cadastrado." : error.message)}`);
  revalidatePath("/clientes");
  redirect("/clientes?sucesso=Cliente cadastrado.");
}

export async function saveLoyaltySettings(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const payload = {
    company_id: company.id,
    is_enabled: formData.get("isEnabled") === "on",
    points_per_currency: Math.max(0, numberValue(formData.get("pointsPerCurrency"), 1)),
    minimum_order_value: Math.max(0, numberValue(formData.get("minimumOrderValue"), 0)),
    reward_name: String(formData.get("rewardName") || "Desconto fidelidade").trim(),
    reward_points: Math.max(1, Math.floor(numberValue(formData.get("rewardPoints"), 100))),
    reward_value: Math.max(0, numberValue(formData.get("rewardValue"), 10)),
    points_expire_days: formData.get("pointsExpireDays") ? Math.max(1, Math.floor(numberValue(formData.get("pointsExpireDays")))) : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("loyalty_settings").upsert(payload, { onConflict: "company_id" });
  if (error) redirect(`/clientes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/clientes");
  redirect("/clientes?sucesso=Programa de fidelidade atualizado.");
}

export async function adjustCustomerPoints(formData: FormData) {
  const { supabase, company, user } = await getCurrentCompany();
  const customerId = String(formData.get("customerId") || "");
  const points = Math.trunc(numberValue(formData.get("points")));
  const description = String(formData.get("description") || "Ajuste manual").trim();
  if (!customerId || points === 0) redirect("/clientes?erro=Informe o cliente e a quantidade de pontos.");
  const { data: customer, error: readError } = await supabase.from("customers").select("loyalty_points").eq("id", customerId).eq("company_id", company.id).single();
  if (readError || !customer) redirect("/clientes?erro=Cliente não encontrado.");
  const next = Math.max(0, Number(customer.loyalty_points || 0) + points);
  const actual = next - Number(customer.loyalty_points || 0);
  const { error: updateError } = await supabase.from("customers").update({ loyalty_points: next, updated_at: new Date().toISOString() }).eq("id", customerId).eq("company_id", company.id);
  if (updateError) redirect(`/clientes?erro=${encodeURIComponent(updateError.message)}`);
  const { error } = await supabase.from("loyalty_movements").insert({ company_id: company.id, customer_id: customerId, movement_type: actual >= 0 ? "adjustment" : "redeem", points: actual, balance_after: next, description, created_by: user.id });
  if (error) redirect(`/clientes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/clientes");
  redirect("/clientes?sucesso=Pontos atualizados.");
}
