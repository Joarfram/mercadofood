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

const updateProductSchema = productSchema.extend({
  productId: z.string().uuid(),
  promotionalPrice: z.union([z.literal(""), z.coerce.number().min(0.01)]).optional(),
  imageFit: z.enum(["cover", "contain"]),
  imagePosition: z.enum(["center", "top", "bottom", "left", "right"]),
});

export async function createCategory(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) redirect("/produtos?erro=Informe%20uma%20categoria%20válida");
  const { supabase, company } = await getCurrentCompany();
  const { data: lastCategory } = await supabase
    .from("categories")
    .select("sort_order")
    .eq("company_id", company.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("categories").insert({
    company_id: company.id,
    name,
    sort_order: Number(lastCategory?.sort_order ?? -1) + 1,
  });
  if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/produtos");
  redirect("/produtos?sucesso=Categoria%20criada");
}

export async function updateCategory(formData: FormData) {
  const categoryId = String(formData.get("categoryId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!z.string().uuid().safeParse(categoryId).success || name.length < 2) {
    redirect("/produtos?erro=Informe%20uma%20categoria%20válida");
  }
  const { supabase, company } = await getCurrentCompany();
  const { error } = await supabase
    .from("categories")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", categoryId)
    .eq("company_id", company.id);
  if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/produtos");
  revalidatePath(`/cardapio/${company.slug}`);
  redirect("/produtos?sucesso=Categoria%20atualizada");
}

export async function toggleCategory(formData: FormData) {
  const categoryId = String(formData.get("categoryId") || "");
  const nextActive = String(formData.get("nextActive") || "") === "true";
  if (!z.string().uuid().safeParse(categoryId).success) redirect("/produtos?erro=Categoria%20inválida");
  const { supabase, company } = await getCurrentCompany();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: nextActive, updated_at: new Date().toISOString() })
    .eq("id", categoryId)
    .eq("company_id", company.id);
  if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/produtos");
  revalidatePath(`/cardapio/${company.slug}`);
  redirect(`/produtos?sucesso=Categoria%20${nextActive ? "ativada" : "pausada"}`);
}

export async function deleteCategory(formData: FormData) {
  const categoryId = String(formData.get("categoryId") || "");
  if (!z.string().uuid().safeParse(categoryId).success) redirect("/produtos?erro=Categoria%20inválida");
  const { supabase, company } = await getCurrentCompany();
  const { error: unlinkError } = await supabase
    .from("products")
    .update({ category_id: null, updated_at: new Date().toISOString() })
    .eq("company_id", company.id)
    .eq("category_id", categoryId);
  if (unlinkError) redirect(`/produtos?erro=${encodeURIComponent(unlinkError.message)}`);
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("company_id", company.id);
  if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/produtos");
  revalidatePath(`/cardapio/${company.slug}`);
  redirect("/produtos?sucesso=Categoria%20excluída.%20Os%20produtos%20foram%20mantidos%20sem%20categoria");
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

export async function updateProduct(formData: FormData) {
  const parsed = updateProductSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    description: formData.get("description"),
    basePrice: formData.get("basePrice"),
    promotionalPrice: formData.get("promotionalPrice") || "",
    categoryId: formData.get("categoryId"),
    preparationTime: formData.get("preparationTime") || 0,
    imageFit: formData.get("imageFit"),
    imagePosition: formData.get("imagePosition"),
  });
  if (!parsed.success) {
    redirect(`/produtos?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Dados inválidos")}`);
  }
  if (parsed.data.promotionalPrice && Number(parsed.data.promotionalPrice) >= parsed.data.basePrice) {
    redirect("/produtos?erro=O%20preço%20promocional%20deve%20ser%20menor%20que%20o%20preço%20normal");
  }

  const { supabase, company } = await getCurrentCompany();
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      base_price: parsed.data.basePrice,
      promotional_price: parsed.data.promotionalPrice || null,
      category_id: parsed.data.categoryId || null,
      preparation_time: parsed.data.preparationTime || null,
      image_fit: parsed.data.imageFit,
      image_position: parsed.data.imagePosition,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.productId)
    .eq("company_id", company.id);
  if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/produtos");
  revalidatePath(`/cardapio/${company.slug}`);
  redirect("/produtos?sucesso=Produto%20atualizado");
}

export async function toggleProduct(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const nextStatus = String(formData.get("nextStatus") || "unavailable");
  const { supabase, company } = await getCurrentCompany();
  await supabase.from("products").update({ availability_status: nextStatus }).eq("id", productId).eq("company_id", company.id);
  revalidatePath("/produtos");
}
