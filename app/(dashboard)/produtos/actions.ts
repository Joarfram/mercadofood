"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlanModule } from "@/lib/auth/current-company";

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
  const { supabase, company } = await requirePlanModule("products");
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
  const { supabase, company } = await requirePlanModule("products");
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
  const { supabase, company } = await requirePlanModule("products");
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
  const { supabase, company, role } = await requirePlanModule("products");
  if (role !== "owner" && role !== "manager") {
    redirect("/produtos?erro=Somente%20o%20propriet%C3%A1rio%20ou%20gerente%20pode%20excluir%20uma%20categoria");
  }
  const [{ data: products, error: productsError }, { data: combos, error: combosError }] = await Promise.all([
    supabase.from("products").select("id").eq("company_id", company.id).eq("category_id", categoryId),
    supabase.from("combos").select("id").eq("company_id", company.id).eq("category_id", categoryId),
  ]);
  const lookupError = productsError || combosError;
  if (lookupError) redirect(`/produtos?erro=${encodeURIComponent(lookupError.message)}`);

  const productIds = (products || []).map(product => product.id);
  const comboIds = (combos || []).map(combo => combo.id);
  const entityIds = [...productIds, ...comboIds];
  let storagePaths: string[] = [];
  if (entityIds.length) {
    const { data: media, error: mediaError } = await supabase
      .from("media_assets")
      .select("storage_path")
      .eq("company_id", company.id)
      .in("entity_id", entityIds);
    if (mediaError) redirect(`/produtos?erro=${encodeURIComponent(mediaError.message)}`);
    storagePaths = (media || []).map(asset => asset.storage_path);
  }

  // Remove referências operacionais; o resumo histórico do pedido permanece em order_items.
  if (productIds.length) {
    const { error } = await supabase.from("order_item_combo_choices").delete().eq("company_id", company.id).in("product_id", productIds);
    if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  }
  if (comboIds.length) {
    const { error } = await supabase.from("order_item_combo_choices").delete().eq("company_id", company.id).in("combo_id", comboIds);
    if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  }
  if (entityIds.length) {
    const { error } = await supabase.from("media_assets").delete().eq("company_id", company.id).in("entity_id", entityIds);
    if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  }
  if (comboIds.length) {
    const { error } = await supabase.from("combos").delete().eq("company_id", company.id).in("id", comboIds);
    if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  }
  if (productIds.length) {
    const { error } = await supabase.from("products").delete().eq("company_id", company.id).in("id", productIds);
    if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  }
  const { error: categoryError } = await supabase.from("categories").delete().eq("company_id", company.id).eq("id", categoryId);
  if (categoryError) redirect(`/produtos?erro=${encodeURIComponent(categoryError.message)}`);
  if (storagePaths.length) await supabase.storage.from("company-media").remove(storagePaths);
  revalidatePath("/produtos");
  revalidatePath("/midias");
  revalidatePath(`/cardapio/${company.slug}`);
  redirect("/produtos?sucesso=Categoria%20e%20todo%20o%20seu%20conte%C3%BAdo%20foram%20exclu%C3%ADdos");
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

  const { supabase, company } = await requirePlanModule("products");
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

const integratedProductSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto."),
  description: z.string().trim().max(500).optional(),
  sku: z.string().trim().max(50).optional(),
  basePrice: z.coerce.number().min(0.01, "Informe um preço válido."),
  promotionalPrice: z.union([z.literal(""), z.coerce.number().min(0.01)]).optional(),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  newCategory: z.string().trim().max(80).optional(),
  preparationTime: z.coerce.number().int().min(0).max(240),
  trackStock: z.boolean(),
  stockQuantity: z.coerce.number().min(0),
  minimumStock: z.coerce.number().min(0),
  available: z.boolean(),
  availableDelivery: z.boolean(),
  availablePickup: z.boolean(),
  availableDineIn: z.boolean(),
});

type AddonInput = { name: string; description?: string; required?: boolean; min?: number; max?: number; options?: { name: string; price?: number }[] };
type VariantInput = { name: string; price?: number; stock?: number };

const importedMenuSchema = z.array(z.object({
  category: z.string().trim().max(80),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500),
  price: z.coerce.number().positive().max(1000000),
})).min(1).max(100);

export type MenuImportResult = {
  ok: boolean;
  message: string;
  imported?: number;
  skipped?: number;
};

function normalizeMenuText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

function parseJsonList<T>(value: FormDataEntryValue | null): T[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createIntegratedProduct(formData: FormData) {
  const parsed = integratedProductSchema.safeParse({
    name: formData.get("name"), description: formData.get("description"), sku: formData.get("sku"),
    basePrice: formData.get("basePrice"), promotionalPrice: formData.get("promotionalPrice") || "",
    categoryId: formData.get("categoryId"), newCategory: formData.get("newCategory"),
    preparationTime: formData.get("preparationTime") || 0,
    trackStock: formData.get("trackStock") === "on", stockQuantity: formData.get("stockQuantity") || 0,
    minimumStock: formData.get("minimumStock") || 0, available: formData.get("available") === "on",
    availableDelivery: formData.get("availableDelivery") === "on",
    availablePickup: formData.get("availablePickup") === "on", availableDineIn: formData.get("availableDineIn") === "on",
  });
  if (!parsed.success) redirect(`/produtos?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Dados inválidos")}`);
  if (parsed.data.promotionalPrice && Number(parsed.data.promotionalPrice) >= parsed.data.basePrice) {
    redirect("/produtos?erro=O%20preço%20promocional%20deve%20ser%20menor%20que%20o%20preço%20normal");
  }
  if (!parsed.data.availableDelivery && !parsed.data.availablePickup && !parsed.data.availableDineIn) {
    redirect("/produtos?erro=Selecione%20ao%20menos%20um%20canal%20de%20venda");
  }
  const image = formData.get("image");
  if (image instanceof File && image.size > 0 && (image.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.type))) {
    redirect("/produtos?erro=A%20imagem%20deve%20ser%20JPG,%20PNG,%20WEBP%20ou%20GIF%20com%20at%C3%A9%208MB");
  }

  const addons = parseJsonList<AddonInput>(formData.get("addonsJson"));
  const variants = parseJsonList<VariantInput>(formData.get("variantsJson"));
  const { supabase, company, user } = await requirePlanModule("products");
  let categoryId = parsed.data.categoryId || null;
  if (!categoryId && parsed.data.newCategory && parsed.data.newCategory.length >= 2) {
    const { data: category, error } = await supabase.from("categories").insert({ company_id: company.id, name: parsed.data.newCategory }).select("id").single();
    if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
    categoryId = category.id;
  }

  const { data: product, error } = await supabase.from("products").insert({
    company_id: company.id, name: parsed.data.name, description: parsed.data.description || null,
    sku: parsed.data.sku || null, base_price: parsed.data.basePrice,
    promotional_price: parsed.data.promotionalPrice || null, category_id: categoryId,
    preparation_time: parsed.data.preparationTime || null,
    availability_status: parsed.data.available ? "available" : "unavailable", is_active: true,
    track_stock: parsed.data.trackStock, stock_quantity: parsed.data.stockQuantity,
    minimum_stock: parsed.data.minimumStock, available_delivery: parsed.data.availableDelivery,
    available_pickup: parsed.data.availablePickup, available_dine_in: parsed.data.availableDineIn,
  }).select("id").single();
  if (error || !product) redirect(`/produtos?erro=${encodeURIComponent(error?.message || "Não foi possível criar o produto")}`);

  for (const [groupIndex, group] of addons.entries()) {
    const name = String(group.name || "").trim();
    const options = (group.options || []).filter(option => String(option.name || "").trim());
    if (!name || !options.length) continue;
    const max = Math.max(1, Math.min(Number(group.max || 1), options.length));
    const min = group.required ? Math.max(1, Math.min(Number(group.min || 1), max)) : 0;
    const { data: createdGroup, error: groupError } = await supabase.from("product_option_groups").insert({
      company_id: company.id, product_id: product.id, name, description: String(group.description || "").trim() || null, min_selection: min, max_selection: max,
      sort_order: groupIndex, is_active: true,
    }).select("id").single();
    if (groupError || !createdGroup) continue;
    await supabase.from("product_options").insert(options.map((option, index) => ({
      company_id: company.id, group_id: createdGroup.id, name: String(option.name).trim(),
      price_delta: Math.max(0, Number(option.price || 0)), sort_order: index, is_active: true,
    })));
  }

  const cleanVariants = variants.filter(variant => String(variant.name || "").trim());
  if (cleanVariants.length) await supabase.from("product_variants").insert(cleanVariants.map((variant, index) => ({
    company_id: company.id, product_id: product.id, name: String(variant.name).trim(),
    price_delta: Number(variant.price || 0), stock_quantity: Math.max(0, Number(variant.stock || 0)), sort_order: index,
  })));

  if (image instanceof File && image.size > 0) {
    if (image.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.type)) {
      redirect("/produtos?erro=A%20imagem%20deve%20ser%20JPG,%20PNG,%20WEBP%20ou%20GIF%20com%20até%208MB");
    }
    const extension = image.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const storagePath = `${company.id}/product/${product.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("company-media").upload(storagePath, await image.arrayBuffer(), { contentType: image.type, upsert: false });
    if (uploadError) {
      await supabase.from("products").delete().eq("id", product.id).eq("company_id", company.id);
      redirect(`/produtos?erro=${encodeURIComponent(`Não foi possível enviar a foto: ${uploadError.message}`)}`);
    }
    const { data: url } = supabase.storage.from("company-media").getPublicUrl(storagePath);
    const { error: assetError } = await supabase.from("media_assets").insert({ company_id: company.id, entity_type: "product", entity_id: product.id,
      kind: "gallery", storage_path: storagePath, public_url: url.publicUrl, alt_text: parsed.data.name,
      mime_type: image.type, byte_size: image.size, sort_order: 0, created_by: user.id });
    if (assetError) {
      await supabase.storage.from("company-media").remove([storagePath]);
      await supabase.from("products").delete().eq("id", product.id).eq("company_id", company.id);
      redirect(`/produtos?erro=${encodeURIComponent(`Não foi possível vincular a foto ao produto: ${assetError.message}`)}`);
    }
  }

  revalidatePath("/produtos");
  revalidatePath(`/cardapio/${company.slug}`);
  redirect("/produtos?sucesso=Produto%20cadastrado%20com%20todas%20as%20configurações");
}

export async function updateIntegratedProduct(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  if (!z.string().uuid().safeParse(productId).success) redirect("/produtos?erro=Produto%20inválido");
  const parsed = integratedProductSchema.safeParse({
    name: formData.get("name"), description: formData.get("description"), sku: formData.get("sku"),
    basePrice: formData.get("basePrice"), promotionalPrice: formData.get("promotionalPrice") || "",
    categoryId: formData.get("categoryId"), newCategory: "", preparationTime: formData.get("preparationTime") || 0,
    trackStock: formData.get("trackStock") === "on", stockQuantity: formData.get("stockQuantity") || 0,
    minimumStock: formData.get("minimumStock") || 0, available: formData.get("available") === "on",
    availableDelivery: formData.get("availableDelivery") === "on",
    availablePickup: formData.get("availablePickup") === "on", availableDineIn: formData.get("availableDineIn") === "on",
  });
  if (!parsed.success) redirect(`/produtos?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Dados inválidos")}`);
  if (parsed.data.promotionalPrice && Number(parsed.data.promotionalPrice) >= parsed.data.basePrice) {
    redirect("/produtos?erro=O%20preço%20promocional%20deve%20ser%20menor%20que%20o%20preço%20normal");
  }
  if (!parsed.data.availableDelivery && !parsed.data.availablePickup && !parsed.data.availableDineIn) {
    redirect("/produtos?erro=Selecione%20ao%20menos%20um%20canal%20de%20venda");
  }
  const { supabase, company, user } = await requirePlanModule("products");
  const { error } = await supabase.from("products").update({
    name: parsed.data.name, description: parsed.data.description || null, sku: parsed.data.sku || null,
    base_price: parsed.data.basePrice, promotional_price: parsed.data.promotionalPrice || null,
    category_id: parsed.data.categoryId || null, preparation_time: parsed.data.preparationTime || null,
    availability_status: parsed.data.available ? "available" : "unavailable",
    track_stock: parsed.data.trackStock, stock_quantity: parsed.data.stockQuantity,
    minimum_stock: parsed.data.minimumStock, available_delivery: parsed.data.availableDelivery,
    available_pickup: parsed.data.availablePickup, available_dine_in: parsed.data.availableDineIn,
    updated_at: new Date().toISOString(),
  }).eq("id", productId).eq("company_id", company.id);
  if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);

  if (formData.has("addonsJson")) {
    const addons = parseJsonList<AddonInput>(formData.get("addonsJson"));
    const { error: removeError } = await supabase.from("product_option_groups").delete().eq("company_id", company.id).eq("product_id", productId);
    if (removeError) redirect(`/produtos?erro=${encodeURIComponent(removeError.message)}`);
    for (const [groupIndex, group] of addons.entries()) {
      const name = String(group.name || "").trim();
      const options = (group.options || []).filter(option => String(option.name || "").trim());
      if (!name || !options.length) continue;
      const max = Math.max(1, Math.min(Number(group.max || options.length || 1), options.length));
      const min = group.required ? Math.max(1, Math.min(Number(group.min || 1), max)) : 0;
      const { data: createdGroup, error: groupError } = await supabase.from("product_option_groups").insert({
        company_id: company.id, product_id: productId, name,
        description: String(group.description || "").trim() || null,
        min_selection: min, max_selection: max, sort_order: groupIndex, is_active: true,
      }).select("id").single();
      if (groupError || !createdGroup) redirect(`/produtos?erro=${encodeURIComponent(groupError?.message || "Erro ao salvar complementos")}`);
      const { error: optionsError } = await supabase.from("product_options").insert(options.map((option, index) => ({
        company_id: company.id, group_id: createdGroup.id, name: String(option.name).trim(),
        price_delta: Math.max(0, Number(option.price || 0)), sort_order: index, is_active: true,
      })));
      if (optionsError) redirect(`/produtos?erro=${encodeURIComponent(optionsError.message)}`);
    }
  }

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.type)) {
      redirect("/produtos?erro=A%20imagem%20deve%20ser%20JPG,%20PNG,%20WEBP%20ou%20GIF%20com%20até%208MB");
    }
    const extension = image.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const storagePath = `${company.id}/product/${productId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("company-media").upload(storagePath, await image.arrayBuffer(), { contentType: image.type, upsert: false });
    if (uploadError) redirect(`/produtos?erro=${encodeURIComponent(`Não foi possível enviar a foto: ${uploadError.message}`)}`);
    const { data: url } = supabase.storage.from("company-media").getPublicUrl(storagePath);
    const { data: lastAsset } = await supabase.from("media_assets").select("sort_order").eq("company_id", company.id).eq("entity_type", "product").eq("entity_id", productId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { error: assetError } = await supabase.from("media_assets").insert({ company_id: company.id, entity_type: "product", entity_id: productId,
      kind: "gallery", storage_path: storagePath, public_url: url.publicUrl, alt_text: parsed.data.name,
      mime_type: image.type, byte_size: image.size, sort_order: Number(lastAsset?.sort_order ?? -1) + 1, created_by: user.id });
    if (assetError) {
      await supabase.storage.from("company-media").remove([storagePath]);
      redirect(`/produtos?erro=${encodeURIComponent(`Não foi possível vincular a foto ao produto: ${assetError.message}`)}`);
    }
  }
  revalidatePath("/produtos");
  revalidatePath(`/cardapio/${company.slug}`);
  redirect("/produtos?sucesso=Alterações%20do%20produto%20salvas");
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

  const { supabase, company } = await requirePlanModule("products");
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

export async function deleteProduct(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  if (!z.string().uuid().safeParse(productId).success) redirect("/produtos?erro=Produto%20inválido");
  const { supabase, company, role } = await requirePlanModule("products");
  if (role !== "owner" && role !== "manager") {
    redirect("/produtos?erro=Somente%20o%20propriet%C3%A1rio%20ou%20gerente%20pode%20excluir%20um%20produto");
  }

  const { data: media, error: mediaError } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("company_id", company.id)
    .eq("entity_type", "product")
    .eq("entity_id", productId);
  if (mediaError) redirect(`/produtos?erro=${encodeURIComponent(mediaError.message)}`);

  const { error: choicesError } = await supabase
    .from("order_item_combo_choices")
    .delete()
    .eq("company_id", company.id)
    .eq("product_id", productId);
  if (choicesError) redirect(`/produtos?erro=${encodeURIComponent(choicesError.message)}`);

  const { error: assetError } = await supabase
    .from("media_assets")
    .delete()
    .eq("company_id", company.id)
    .eq("entity_type", "product")
    .eq("entity_id", productId);
  if (assetError) redirect(`/produtos?erro=${encodeURIComponent(assetError.message)}`);

  const { error } = await supabase.from("products").delete().eq("company_id", company.id).eq("id", productId);
  if (error) redirect(`/produtos?erro=${encodeURIComponent(error.message)}`);
  const storagePaths = (media || []).map(asset => asset.storage_path);
  if (storagePaths.length) await supabase.storage.from("company-media").remove(storagePaths);

  revalidatePath("/produtos");
  revalidatePath("/midias");
  revalidatePath(`/cardapio/${company.slug}`);
  redirect("/produtos?sucesso=Produto%20e%20todo%20o%20seu%20conte%C3%BAdo%20foram%20exclu%C3%ADdos");
}

export async function toggleProduct(formData: FormData) {
  const productId = String(formData.get("productId") || "");
  const nextStatus = String(formData.get("nextStatus") || "unavailable");
  const { supabase, company } = await requirePlanModule("products");
  await supabase.from("products").update({ availability_status: nextStatus }).eq("id", productId).eq("company_id", company.id);
  revalidatePath("/produtos");
}

export async function importReviewedMenu(rawProducts: unknown): Promise<MenuImportResult> {
  const parsed = importedMenuSchema.safeParse(rawProducts);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Revise os produtos antes de importar." };
  }

  const { supabase, company } = await requirePlanModule("products");
  const [{ data: existingCategories, error: categoryLookupError }, { data: existingProducts, error: productLookupError }] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order").eq("company_id", company.id).order("sort_order"),
    supabase.from("products").select("name, category_id").eq("company_id", company.id),
  ]);
  if (categoryLookupError || productLookupError) {
    return { ok: false, message: "Não foi possível conferir os dados atuais do cardápio." };
  }

  const categoryByName = new Map((existingCategories || []).map(item => [normalizeMenuText(item.name), item.id]));
  let nextSortOrder = Math.max(-1, ...(existingCategories || []).map(item => Number(item.sort_order ?? -1))) + 1;

  for (const product of parsed.data) {
    const categoryName = product.category.trim();
    const categoryKey = normalizeMenuText(categoryName);
    if (!categoryName || categoryByName.has(categoryKey)) continue;
    const { data: created, error } = await supabase.from("categories").insert({
      company_id: company.id,
      name: categoryName,
      sort_order: nextSortOrder++,
      is_active: true,
    }).select("id").single();
    if (error || !created) return { ok: false, message: `Não foi possível criar a categoria ${categoryName}.` };
    categoryByName.set(categoryKey, created.id);
  }

  const existingKeys = new Set((existingProducts || []).map(product =>
    `${product.category_id || "none"}::${normalizeMenuText(product.name)}`,
  ));
  const rows: Array<Record<string, unknown>> = [];
  let skipped = 0;

  for (const product of parsed.data) {
    const categoryId = categoryByName.get(normalizeMenuText(product.category)) || null;
    const key = `${categoryId || "none"}::${normalizeMenuText(product.name)}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);
    rows.push({
      company_id: company.id,
      category_id: categoryId,
      name: product.name,
      description: product.description || null,
      base_price: product.price,
      availability_status: "unavailable",
      is_active: true,
      track_stock: false,
      stock_quantity: 0,
      minimum_stock: 0,
      available_delivery: true,
      available_pickup: true,
      available_dine_in: true,
    });
  }

  if (!rows.length) {
    return { ok: false, message: "Todos os itens selecionados já existem neste cardápio.", imported: 0, skipped };
  }
  const { error: insertError } = await supabase.from("products").insert(rows);
  if (insertError) return { ok: false, message: "Não foi possível salvar os produtos importados." };

  revalidatePath("/produtos");
  revalidatePath(`/cardapio/${company.slug}`);
  return {
    ok: true,
    imported: rows.length,
    skipped,
    message: `${rows.length} ${rows.length === 1 ? "produto importado" : "produtos importados"} como pausados${skipped ? `; ${skipped} repetidos foram ignorados` : ""}.`,
  };
}
