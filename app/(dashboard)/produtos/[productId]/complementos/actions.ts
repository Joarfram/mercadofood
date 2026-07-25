"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentCompany } from "@/lib/auth/current-company";

const groupSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().trim().min(2),
  description: z.string().trim().max(250).optional(),
  groupType: z.enum(["single", "multiple", "quantity"]),
  minSelection: z.coerce.number().int().min(0).max(50),
  maxSelection: z.coerce.number().int().min(1).max(50),
  freeSelection: z.coerce.number().int().min(0).max(50),
});

export async function createOptionGroup(formData: FormData) {
  const parsed = groupSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    description: formData.get("description"),
    groupType: formData.get("groupType"),
    minSelection: formData.get("minSelection") || 0,
    maxSelection: formData.get("maxSelection") || 1,
    freeSelection: formData.get("freeSelection") || 0,
  });
  if (!parsed.success) redirect(`/produtos?erro=${encodeURIComponent("Dados do grupo inválidos")}`);
  if (parsed.data.minSelection > parsed.data.maxSelection) {
    redirect(`/produtos/${parsed.data.productId}/complementos?erro=${encodeURIComponent("O mínimo não pode ser maior que o máximo")}`);
  }
  const { supabase, company } = await getCurrentCompany();
  const { error } = await supabase.from("product_option_groups").insert({
    company_id: company.id,
    product_id: parsed.data.productId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    group_type: parsed.data.groupType,
    min_selection: parsed.data.minSelection,
    max_selection: parsed.data.maxSelection,
    free_selection: parsed.data.freeSelection,
    is_active: true,
  });
  if (error) redirect(`/produtos/${parsed.data.productId}/complementos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(`/produtos/${parsed.data.productId}/complementos`);
  redirect(`/produtos/${parsed.data.productId}/complementos?sucesso=Grupo%20criado`);
}

export async function createOption(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const groupId = String(formData.get("groupId") || "");
  const name = String(formData.get("name") || "").trim();
  const priceDelta = Number(formData.get("priceDelta") || 0);
  const maxQuantity = Math.max(1, Number(formData.get("maxQuantity") || 1));
  if (!productId || !groupId || name.length < 2 || Number.isNaN(priceDelta)) {
    redirect(`/produtos/${productId}/complementos?erro=${encodeURIComponent("Preencha a opção corretamente")}`);
  }
  const { supabase, company } = await getCurrentCompany();
  const { error } = await supabase.from("product_options").insert({
    company_id: company.id,
    group_id: groupId,
    name,
    price_delta: priceDelta,
    max_quantity: maxQuantity,
    is_active: true,
  });
  if (error) redirect(`/produtos/${productId}/complementos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(`/produtos/${productId}/complementos`);
  redirect(`/produtos/${productId}/complementos?sucesso=Opção%20adicionada`);
}

export async function toggleGroup(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const groupId = String(formData.get("groupId") || "");
  const active = String(formData.get("active")) === "true";
  const { supabase, company } = await getCurrentCompany();
  await supabase.from("product_option_groups").update({ is_active: active }).eq("id", groupId).eq("company_id", company.id);
  revalidatePath(`/produtos/${productId}/complementos`);
}

export async function toggleOption(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const optionId = String(formData.get("optionId") || "");
  const active = String(formData.get("active")) === "true";
  const { supabase, company } = await getCurrentCompany();
  await supabase.from("product_options").update({ is_active: active }).eq("id", optionId).eq("company_id", company.id);
  revalidatePath(`/produtos/${productId}/complementos`);
}
