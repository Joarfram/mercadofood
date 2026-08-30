"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlanModule } from "@/lib/auth/current-company";

const fixedOptionSchema = z.object({
  quantity: z.coerce.number().positive(),
  unit: z.enum(["g", "kg"]),
  price: z.coerce.number().positive(),
});

const deliverySimpleProductSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto."),
  description: z.string().trim().max(500).optional(),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  sellingMode: z.enum(["unit", "weight", "fixed_weight"]),
  basePrice: z.coerce.number().positive("Informe um preço válido."),
  referenceQuantity: z.coerce.number().positive().optional(),
  referenceUnit: z.enum(["g", "kg"]).optional(),
  minimumSaleQuantity: z.coerce.number().positive().optional(),
  saleIncrement: z.coerce.number().positive().optional(),
  stockUnit: z.enum(["unit", "g", "kg"]),
  trackStock: z.boolean(),
  stockQuantity: z.coerce.number().min(0),
  minimumStock: z.coerce.number().min(0),
});

function parseFixedOptions(value: FormDataEntryValue | null) {
  try {
    const raw = JSON.parse(String(value || "[]"));
    const parsed = z.array(fixedOptionSchema).max(20).safeParse(raw);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export async function createDeliverySimpleProduct(formData: FormData) {
  const parsed = deliverySimpleProductSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    sellingMode: formData.get("sellingMode"),
    basePrice: formData.get("basePrice"),
    referenceQuantity: formData.get("referenceQuantity") || undefined,
    referenceUnit: formData.get("referenceUnit") || undefined,
    minimumSaleQuantity: formData.get("minimumSaleQuantity") || undefined,
    saleIncrement: formData.get("saleIncrement") || undefined,
    stockUnit: formData.get("stockUnit"),
    trackStock: formData.get("trackStock") === "on",
    stockQuantity: formData.get("stockQuantity") || 0,
    minimumStock: formData.get("minimumStock") || 0,
  });

  if (!parsed.success) {
    redirect(`/produtos/delivery-simples?erro=${encodeURIComponent(parsed.error.issues[0]?.message || "Dados inválidos")}`);
  }

  const data = parsed.data;
  if (data.sellingMode === "weight") {
    if (!data.referenceQuantity || !data.referenceUnit || !data.minimumSaleQuantity || !data.saleIncrement) {
      redirect("/produtos/delivery-simples?erro=Complete%20os%20campos%20da%20venda%20por%20peso");
    }
  }

  const fixedOptions = parseFixedOptions(formData.get("fixedWeightOptions"));
  if (data.sellingMode === "fixed_weight" && fixedOptions.length === 0) {
    redirect("/produtos/delivery-simples?erro=Adicione%20ao%20menos%20uma%20op%C3%A7%C3%A3o%20de%20peso");
  }

  const { supabase, company } = await requirePlanModule("products");
  const { error } = await supabase.from("products").insert({
    company_id: company.id,
    name: data.name,
    description: data.description || null,
    category_id: data.categoryId || null,
    base_price: data.basePrice,
    selling_mode: data.sellingMode,
    reference_quantity: data.sellingMode === "weight" ? data.referenceQuantity : null,
    reference_unit: data.sellingMode === "weight" ? data.referenceUnit : null,
    minimum_sale_quantity: data.sellingMode === "weight" ? data.minimumSaleQuantity : null,
    sale_increment: data.sellingMode === "weight" ? data.saleIncrement : null,
    fixed_weight_options: data.sellingMode === "fixed_weight" ? fixedOptions : [],
    stock_unit: data.stockUnit,
    track_stock: data.trackStock,
    stock_quantity: data.stockQuantity,
    minimum_stock: data.minimumStock,
    availability_status: "available",
    is_active: true,
    available_delivery: true,
    available_pickup: true,
    available_dine_in: false,
  });

  if (error) {
    redirect(`/produtos/delivery-simples?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/produtos");
  revalidatePath("/produtos/delivery-simples");
  revalidatePath(`/cardapio/${company.slug}`);
  redirect("/produtos/delivery-simples?sucesso=Produto%20cadastrado%20com%20sucesso");
}
