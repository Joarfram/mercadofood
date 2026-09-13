"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";

function amount(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function configureSimpleStock(formData: FormData) {
  const { supabase } = await requirePlanModule("stock_basic");
  const productId = String(formData.get("productId") || "");
  const enabled = String(formData.get("enabled") || "") === "true";
  const stockQuantity = amount(formData.get("stockQuantity"));
  const minimumStock = amount(formData.get("minimumStock"));

  if (!productId || stockQuantity < 0 || minimumStock < 0) {
    redirect("/estoque-simples?erro=Confira%20os%20dados%20do%20produto.");
  }

  const { error } = await supabase.rpc("configure_simple_product_stock", {
    p_product_id: productId,
    p_enabled: enabled,
    p_stock_quantity: stockQuantity,
    p_minimum_stock: minimumStock,
  });

  if (error) redirect(`/estoque-simples?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/estoque-simples");
  revalidatePath("/produtos");
  redirect("/estoque-simples?sucesso=Estoque%20do%20produto%20atualizado.");
}

export async function adjustSimpleStock(formData: FormData) {
  const { supabase } = await requirePlanModule("stock_basic");
  const productId = String(formData.get("productId") || "");
  const operation = String(formData.get("operation") || "entry");
  const quantity = amount(formData.get("quantity"));
  const notes = String(formData.get("notes") || "").trim();

  if (!productId || !["entry", "exit", "adjustment_in", "adjustment_out", "loss", "return"].includes(operation) || quantity <= 0) {
    redirect("/estoque-simples?erro=Informe%20uma%20movimentação%20válida.");
  }

  const { error } = await supabase.rpc("adjust_simple_product_stock", {
    p_product_id: productId,
    p_movement_type: operation,
    p_quantity: quantity,
    p_notes: notes || null,
  });

  if (error) redirect(`/estoque-simples?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/estoque-simples");
  revalidatePath("/produtos");
  redirect("/estoque-simples?sucesso=Movimentação%20registrada.");
}
