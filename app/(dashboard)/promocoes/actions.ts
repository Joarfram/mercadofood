"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";

function num(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(String(value ?? fallback).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function createCoupon(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const code = String(formData.get("code") || "").trim().toUpperCase().replace(/\s+/g, "");
  const name = String(formData.get("name") || "").trim();
  const discountType = String(formData.get("discountType") || "percentage");
  const discountValue = Math.max(0, num(formData.get("discountValue")));
  if (code.length < 3 || name.length < 2 || discountValue <= 0) redirect("/promocoes?erro=Preencha os dados do cupom corretamente.");
  const payload = {
    company_id: company.id, code, name,
    description: String(formData.get("description") || "").trim() || null,
    discount_type: discountType,
    discount_value: discountValue,
    minimum_order_value: Math.max(0, num(formData.get("minimumOrderValue"))),
    maximum_discount: formData.get("maximumDiscount") ? Math.max(0, num(formData.get("maximumDiscount"))) : null,
    starts_at: String(formData.get("startsAt") || "") || null,
    ends_at: String(formData.get("endsAt") || "") || null,
    usage_limit: formData.get("usageLimit") ? Math.max(1, Math.floor(num(formData.get("usageLimit")))) : null,
    per_customer_limit: Math.max(1, Math.floor(num(formData.get("perCustomerLimit"), 1))),
    is_active: true,
  };
  const { error } = await supabase.from("coupons").insert(payload);
  if (error) redirect(`/promocoes?erro=${encodeURIComponent(error.code === "23505" ? "Este código já existe." : error.message)}`);
  revalidatePath("/promocoes"); revalidatePath("/pedidos");
  redirect("/promocoes?sucesso=Cupom criado.");
}

export async function createPromotion(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const title = String(formData.get("title") || "").trim();
  if (title.length < 3) redirect("/promocoes?erro=Informe o título da promoção.");
  const { error } = await supabase.from("promotions").insert({
    company_id: company.id,
    title,
    description: String(formData.get("description") || "").trim() || null,
    promotion_type: String(formData.get("promotionType") || "offer"),
    starts_at: String(formData.get("startsAt") || "") || null,
    ends_at: String(formData.get("endsAt") || "") || null,
    is_active: true,
  });
  if (error) redirect(`/promocoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/promocoes");
  redirect("/promocoes?sucesso=Promoção criada.");
}

export async function toggleCoupon(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active")) === "true";
  await supabase.from("coupons").update({ is_active: !active, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", company.id);
  revalidatePath("/promocoes"); revalidatePath("/pedidos");
}

export async function togglePromotion(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active")) === "true";
  await supabase.from("promotions").update({ is_active: !active, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", company.id);
  revalidatePath("/promocoes");
}
