"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";

function amount(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function configureSimpleStock(formData: FormData) {
  const { supabase, company } = await requirePlanModule("stock_basic");
  const productId = String(formData.get("productId") || "");
  const enabled = String(formData.get("enabled") || "") === "true";
  const stockQuantity = amount(formData.get("stockQuantity"));
  const minimumStock = amount(formData.get("minimumStock"));

  if (!productId || stockQuantity < 0 || minimumStock < 0) {
    redirect("/estoque-simples?erro=Confira%20os%20dados%20do%20produto.");
  }

  const { error } = await supabase
    .from("products")
    .update({
      track_stock: enabled,
      stock_quantity: stockQuantity,
      minimum_stock: minimumStock,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("company_id", company.id);

  if (error) redirect(`/estoque-simples?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/estoque-simples");
  revalidatePath("/produtos");
  redirect("/estoque-simples?sucesso=Estoque%20do%20produto%20atualizado.");
}

export async function adjustSimpleStock(formData: FormData) {
  const { supabase, company, user } = await requirePlanModule("stock_basic");
  const productId = String(formData.get("productId") || "");
  const operation = String(formData.get("operation") || "entry");
  const quantity = amount(formData.get("quantity"));
  const notes = String(formData.get("notes") || "").trim();

  if (!productId || !["entry", "exit", "adjustment_in", "adjustment_out", "loss", "return"].includes(operation) || quantity <= 0) {
    redirect("/estoque-simples?erro=Informe%20uma%20movimentação%20válida.");
  }

  const { data: product, error: readError } = await supabase
    .from("products")
    .select("id,name,track_stock,stock_quantity")
    .eq("id", productId)
    .eq("company_id", company.id)
    .single();

  if (readError || !product || !product.track_stock) {
    redirect("/estoque-simples?erro=Produto%20sem%20controle%20de%20estoque%20ativo.");
  }

  const signed = ["entry", "return", "adjustment_in"].includes(operation) ? quantity : -quantity;
  const before = Number(product.stock_quantity || 0);
  const after = before + signed;
  if (after < 0) redirect("/estoque-simples?erro=O%20estoque%20não%20pode%20ficar%20negativo.");

  const { error: updateError } = await supabase
    .from("products")
    .update({ stock_quantity: after, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("company_id", company.id)
    .eq("stock_quantity", before);

  if (updateError) redirect(`/estoque-simples?erro=${encodeURIComponent(updateError.message)}`);

  const { error: movementError } = await supabase.from("inventory_movements").insert({
    company_id: company.id,
    product_id: productId,
    movement_type: operation,
    quantity: signed,
    stock_before: before,
    stock_after: after,
    notes: notes || `Ajuste manual de ${product.name}`,
    created_by: user.id,
  });

  if (movementError) redirect(`/estoque-simples?erro=${encodeURIComponent(movementError.message)}`);
  revalidatePath("/estoque-simples");
  revalidatePath("/produtos");
  redirect("/estoque-simples?sucesso=Movimentação%20registrada.");
}
