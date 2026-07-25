"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";

function numberValue(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(String(value ?? fallback).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function createCombo(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const name = String(formData.get("name") || "").trim();
  const basePrice = Math.max(0, numberValue(formData.get("basePrice")));
  if (name.length < 2) redirect("/combos?erro=Informe o nome do combo.");

  const { error } = await supabase.from("combos").insert({
    company_id: company.id,
    category_id: String(formData.get("categoryId") || "") || null,
    name,
    description: String(formData.get("description") || "").trim() || null,
    base_price: basePrice,
    promotional_price: formData.get("promotionalPrice") ? Math.max(0, numberValue(formData.get("promotionalPrice"))) : null,
    preparation_time: Math.max(0, Math.floor(numberValue(formData.get("preparationTime")))),
  });
  if (error) redirect(`/combos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/combos");
  redirect("/combos?sucesso=Combo criado. Agora adicione as etapas de escolha.");
}

export async function createComboGroup(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const comboId = String(formData.get("comboId") || "");
  const name = String(formData.get("name") || "").trim();
  const minSelection = Math.max(0, Math.floor(numberValue(formData.get("minSelection"), 1)));
  const maxSelection = Math.max(minSelection, Math.floor(numberValue(formData.get("maxSelection"), 1)));
  const freeSelection = Math.max(0, Math.min(maxSelection, Math.floor(numberValue(formData.get("freeSelection"), 1))));
  if (!comboId || name.length < 2) redirect("/combos?erro=Selecione o combo e informe a etapa.");

  const { error } = await supabase.from("combo_groups").insert({
    company_id: company.id, combo_id: comboId, name,
    description: String(formData.get("description") || "").trim() || null,
    min_selection: minSelection, max_selection: maxSelection, free_selection: freeSelection,
  });
  if (error) redirect(`/combos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/combos");
  redirect("/combos?sucesso=Etapa adicionada ao combo.");
}

export async function addProductToComboGroup(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const groupId = String(formData.get("groupId") || "");
  const productId = String(formData.get("productId") || "");
  if (!groupId || !productId) redirect("/combos?erro=Selecione a etapa e o produto.");
  const { error } = await supabase.from("combo_group_products").insert({
    company_id: company.id,
    group_id: groupId,
    product_id: productId,
    price_delta: numberValue(formData.get("priceDelta")),
    max_quantity: Math.max(1, Math.floor(numberValue(formData.get("maxQuantity"), 1))),
  });
  if (error) redirect(`/combos?erro=${encodeURIComponent(error.code === "23505" ? "Este produto já está nesta etapa." : error.message)}`);
  revalidatePath("/combos");
  redirect("/combos?sucesso=Produto incluído na etapa.");
}

export async function toggleCombo(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active")) === "true";
  await supabase.from("combos").update({ is_active: !active, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", company.id);
  revalidatePath("/combos");
}
