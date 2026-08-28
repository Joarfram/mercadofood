"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";

function amount(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
export async function createIngredient(formData: FormData) {
  const { supabase, company } = await requirePlanModule("stock");
  const name = String(formData.get("name") || "").trim();
  const unit = String(formData.get("unit") || "un");
  const currentStock = amount(formData.get("currentStock"));
  const minimumStock = amount(formData.get("minimumStock"));
  const unitCost = amount(formData.get("unitCost"));
  if (name.length < 2 || currentStock < 0 || minimumStock < 0 || unitCost < 0) redirect("/estoque?erro=Confira os dados do insumo.");
  const { error } = await supabase.from("ingredients").insert({ company_id: company.id, name, unit, current_stock: currentStock, minimum_stock: minimumStock, unit_cost: unitCost });
  if (error) redirect(`/estoque?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/estoque");
  redirect("/estoque?sucesso=Insumo cadastrado.");
}

export async function addInventoryMovement(formData: FormData) {
  const { supabase, company, user } = await requirePlanModule("stock");
  const ingredientId = String(formData.get("ingredientId") || "");
  const type = String(formData.get("movementType") || "entry");
  const allowedTypes = new Set(["entry", "exit", "adjustment_in", "adjustment_out", "loss", "return"]);
  const quantityInput = amount(formData.get("quantity"));
  const notes = String(formData.get("notes") || "").trim();
  if (!ingredientId || !allowedTypes.has(type) || quantityInput <= 0) redirect("/estoque?erro=Informe um tipo, um insumo e uma quantidade válidos.");
  const { data: ingredient, error: readError } = await supabase.from("ingredients").select("current_stock,unit_cost").eq("id", ingredientId).eq("company_id", company.id).single();
  if (readError || !ingredient) redirect("/estoque?erro=Insumo não encontrado.");
  const signed = type === "entry" || type === "return" || type === "adjustment_in" ? quantityInput : -quantityInput;
  const before = Number(ingredient.current_stock || 0);
  const after = before + signed;
  const { error: updateError } = await supabase.from("ingredients").update({ current_stock: after, updated_at: new Date().toISOString() }).eq("id", ingredientId).eq("company_id", company.id);
  if (updateError) redirect(`/estoque?erro=${encodeURIComponent(updateError.message)}`);
  const { error } = await supabase.from("inventory_movements").insert({ company_id: company.id, ingredient_id: ingredientId, movement_type: type, quantity: signed, stock_before: before, stock_after: after, unit_cost: ingredient.unit_cost, notes: notes || null, created_by: user.id });
  if (error) redirect(`/estoque?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/estoque");
  redirect("/estoque?sucesso=Movimentação registrada.");
}

export async function saveRecipeItem(formData: FormData) {
  const { supabase, company } = await requirePlanModule("stock");
  const productId = String(formData.get("productId") || "");
  const ingredientId = String(formData.get("ingredientId") || "");
  const quantity = amount(formData.get("quantity"));
  if (!productId || !ingredientId || quantity <= 0) redirect("/estoque?erro=Selecione produto, insumo e quantidade.");
  const { error } = await supabase.from("recipe_items").upsert({ company_id: company.id, product_id: productId, ingredient_id: ingredientId, quantity }, { onConflict: "product_id,ingredient_id" });
  if (error) redirect(`/estoque?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/estoque");
  redirect("/estoque?sucesso=Ficha técnica atualizada.");
}

export async function removeRecipeItem(formData: FormData) {
  const { supabase, company } = await requirePlanModule("stock");
  const id = String(formData.get("recipeItemId") || "");
  await supabase.from("recipe_items").delete().eq("id", id).eq("company_id", company.id);
  revalidatePath("/estoque");
}

export async function saveRecipe(formData: FormData) {
  const { supabase, company } = await requirePlanModule("stock");
  const productId = String(formData.get("productId") || "");
  let items: Array<{ingredientId:string;quantity:number}> = [];
  try { items = JSON.parse(String(formData.get("itemsJson") || "[]")); } catch {}
  if (!productId || !items.length || items.some(item=>!item.ingredientId||!Number.isFinite(item.quantity)||item.quantity<=0)) redirect("/estoque?erro=Revise os itens da ficha técnica.");
  const ingredientIds = [...new Set(items.map(item=>item.ingredientId))];
  const [{ data: product }, { data: validIngredients }] = await Promise.all([
    supabase.from("products").select("id").eq("id",productId).eq("company_id",company.id).maybeSingle(),
    supabase.from("ingredients").select("id").eq("company_id",company.id).in("id",ingredientIds),
  ]);
  if (!product || validIngredients?.length !== ingredientIds.length) redirect("/estoque?erro=Produto ou insumo inválido.");
  const { data: previousItems, error: previousError } = await supabase.from("recipe_items").select("id,ingredient_id").eq("company_id",company.id).eq("product_id",productId);
  if (previousError) redirect(`/estoque?erro=${encodeURIComponent(previousError.message)}`);
  const { error } = await supabase.from("recipe_items").upsert(items.map(item=>({company_id:company.id,product_id:productId,ingredient_id:item.ingredientId,quantity:item.quantity})),{onConflict:"product_id,ingredient_id"});
  if (error) redirect(`/estoque?erro=${encodeURIComponent(error.message)}`);
  const kept = new Set(ingredientIds);
  const obsoleteIds = (previousItems||[]).filter(item=>!kept.has(item.ingredient_id)).map(item=>item.id);
  if(obsoleteIds.length){const {error:removeError}=await supabase.from("recipe_items").delete().eq("company_id",company.id).in("id",obsoleteIds);if(removeError) redirect(`/estoque?erro=${encodeURIComponent(removeError.message)}`);}
  revalidatePath("/estoque");
  redirect("/estoque?sucesso=Ficha técnica completa salva.");
}

export async function updateIngredient(formData: FormData) {
  const { supabase, company } = await requirePlanModule("stock");
  const id=String(formData.get("ingredientId")||""); const name=String(formData.get("name")||"").trim(); const unit=String(formData.get("unit")||"");
  const minimumStock=amount(formData.get("minimumStock")); const unitCost=amount(formData.get("unitCost"));
  if(!id||name.length<2||!['un','g','kg','ml','l'].includes(unit)||minimumStock<0||unitCost<0) redirect("/estoque?erro=Confira os dados do insumo.");
  const {error}=await supabase.from("ingredients").update({name,unit,minimum_stock:minimumStock,unit_cost:unitCost,updated_at:new Date().toISOString()}).eq("id",id).eq("company_id",company.id);
  if(error) redirect(`/estoque?erro=${encodeURIComponent(error.message)}`); revalidatePath("/estoque"); redirect("/estoque?sucesso=Insumo atualizado.");
}

export async function deleteIngredient(formData: FormData) {
  const { supabase, company, role } = await requirePlanModule("stock");
  if(!['owner','manager'].includes(role)) redirect("/estoque?erro=Somente proprietário ou gerente pode excluir insumos.");
  const id=String(formData.get("ingredientId")||""); if(!id) redirect("/estoque?erro=Insumo inválido.");
  const {error}=await supabase.from("ingredients").update({is_active:false,updated_at:new Date().toISOString()}).eq("id",id).eq("company_id",company.id);
  if(error) redirect(`/estoque?erro=${encodeURIComponent(error.message)}`); revalidatePath("/estoque"); redirect("/estoque?sucesso=Insumo excluído do estoque. O histórico foi preservado.");
}
