"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentCompany } from "@/lib/auth/current-company";

const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto."),
  description: z.string().trim().max(500).optional(),
  basePrice: z.coerce.number().min(0.01, "Informe um preço válido."),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  preparationTime: z.coerce.number().int().min(0).max(240).optional(),
});

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) redirect("/produtos?erro=Informe%20uma%20categoria%20válida");
  const { supabase, company } = await getCurrentCompany();
  const { error } = await supabase.from("categories").insert({ company_id: company.id, name });
  if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/produtos");
  redirect("/produtos?sucesso=Categoria%20criada");
}

export async function createProduct(formData: FormData) {
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    basePrice: formData.get("basePrice"),
    categoryId: formData.get("categoryId"),
    preparationTime: formData.get("preparationTime") || 0,
  });
  if (!parsed.success) redirect(`/produtos?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Dados inválidos")}`);

  const { supabase, company } = await getCurrentCompany();
  const { error } = await supabase.from("products").insert({
    company_id: company.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    base_price: parsed.data.basePrice,
    category_id: parsed.data.categoryId || null,
    preparation_time: parsed.data.preparationTime || null,
    availability_status: "available",
    is_active: true,
  });
  if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/produtos");
  redirect("/produtos?sucesso=Produto%20cadastrado");
}

export async function toggleProduct(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const nextStatus = String(formData.get("nextStatus") || "unavailable");
  const { supabase, company } = await getCurrentCompany();
  await supabase.from("products").update({ availability_status: nextStatus }).eq("id", productId).eq("company_id", company.id);
  revalidatePath("/produtos");
}
