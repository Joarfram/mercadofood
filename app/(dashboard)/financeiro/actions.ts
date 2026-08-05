"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany, requirePlanModule } from "@/lib/auth/current-company";

function amountFrom(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function openCashSession(formData: FormData) {
  const { supabase, company, user } = await getCurrentCompany();
  const openingBalance = amountFrom(formData.get("openingBalance"));
  if (openingBalance < 0) redirect("/financeiro?erro=O saldo inicial não pode ser negativo.");

  const { data: existing } = await supabase.from("cash_sessions")
    .select("id").eq("company_id", company.id).eq("status", "open").maybeSingle();
  if (existing) redirect("/financeiro?erro=Já existe um caixa aberto.");

  const { error } = await supabase.from("cash_sessions").insert({
    company_id: company.id,
    opened_by: user.id,
    opening_balance: openingBalance,
    status: "open",
  });
  if (error) redirect(`/financeiro?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/financeiro");
  redirect("/financeiro?sucesso=Caixa aberto com sucesso.");
}

export async function addCashMovement(formData: FormData) {
  const { supabase, company, user } = await getCurrentCompany();
  const sessionId = String(formData.get("sessionId") || "");
  const movementType = String(formData.get("movementType") || "expense");
  const paymentMethod = String(formData.get("paymentMethod") || "cash");
  const description = String(formData.get("description") || "").trim();
  const amount = amountFrom(formData.get("amount"));

  if (!sessionId || !description || amount <= 0) {
    redirect("/financeiro?erro=Preencha descrição e valor corretamente.");
  }

  const { error } = await supabase.from("cash_movements").insert({
    company_id: company.id,
    cash_session_id: sessionId,
    movement_type: movementType,
    payment_method: paymentMethod,
    description,
    amount,
    created_by: user.id,
  });
  if (error) redirect(`/financeiro?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/financeiro");
  redirect("/financeiro?sucesso=Movimentação registrada.");
}

export async function createCounterSale(formData: FormData) {
  const { supabase, company } = await requirePlanModule("finance");
  const sessionId = String(formData.get("sessionId") || "");
  const paymentMethod = String(formData.get("paymentMethod") || "cash");
  const customerName = String(formData.get("customerName") || "").trim() || "Venda balcão";
  const notes = String(formData.get("notes") || "").trim();
  const allowedMethods = ["cash", "pix", "debit_card", "credit_card"];

  let requestedItems: Array<{ productId: string; quantity: number }> = [];
  try {
    requestedItems = JSON.parse(String(formData.get("items") || "[]"));
  } catch {
    redirect("/financeiro?erro=Os itens da venda não puderam ser lidos.");
  }
  requestedItems = requestedItems.filter(item => typeof item.productId === "string" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99);
  if (!sessionId || !allowedMethods.includes(paymentMethod) || !requestedItems.length) redirect("/financeiro?erro=Adicione os produtos e escolha o pagamento.");

  const { data: session } = await supabase.from("cash_sessions").select("id").eq("id", sessionId).eq("company_id", company.id).eq("status", "open").maybeSingle();
  if (!session) redirect("/financeiro?erro=Este caixa não está mais aberto.");

  const productIds = [...new Set(requestedItems.map(item => item.productId))];
  const { data: products, error: productError } = await supabase.from("products").select("id,name,base_price,promotional_price,availability_status").eq("company_id", company.id).in("id", productIds);
  if (productError || !products || products.length !== productIds.length) redirect("/financeiro?erro=Um dos produtos não foi encontrado.");

  const productMap = new Map(products.map(product => [product.id, product]));
  const saleItems = requestedItems.map(item => {
    const product = productMap.get(item.productId)!;
    if (product.availability_status !== "available") redirect(`/financeiro?erro=${encodeURIComponent(`${product.name} está indisponível.`)}`);
    const price = Number(product.promotional_price || product.base_price);
    return { ...item, name: product.name, price, total: Math.round(price * item.quantity * 100) / 100 };
  });
  const total = Math.round(saleItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  const informedReceived = amountFrom(formData.get("amountReceived"));
  if (paymentMethod === "cash" && informedReceived < total) redirect("/financeiro?erro=O valor recebido é menor que o total da venda.");
  const amountReceived = paymentMethod === "cash" ? informedReceived : total;
  const changeAmount = paymentMethod === "cash" ? Math.round((amountReceived - total) * 100) / 100 : 0;

  let { data: branch } = await supabase.from("branches").select("id").eq("company_id", company.id).limit(1).maybeSingle();
  if (!branch) {
    const { data: createdBranch, error: branchError } = await supabase.from("branches").insert({ company_id: company.id, name: "Matriz", is_open: true }).select("id").single();
    if (branchError || !createdBranch) redirect(`/financeiro?erro=${encodeURIComponent(branchError?.message || "Não foi possível criar a unidade.")}`);
    branch = createdBranch;
  }

  const paidAt = new Date().toISOString();
  const { data: order, error: orderError } = await supabase.from("orders").insert({
    company_id: company.id,
    branch_id: branch.id,
    cash_session_id: session.id,
    customer_name: customerName,
    channel: "counter",
    service_type: "counter",
    status: "new",
    payment_status: "paid",
    payment_method: paymentMethod,
    subtotal: total,
    discount_amount: 0,
    delivery_fee: 0,
    total,
    amount_received: amountReceived,
    change_amount: changeAmount,
    paid_at: paidAt,
    notes: notes || null,
    delivery_address: {},
  }).select("id,order_number").single();
  if (orderError || !order) redirect(`/financeiro?erro=${encodeURIComponent(orderError?.message || "Não foi possível criar a venda.")}`);

  const { error: itemsError } = await supabase.from("order_items").insert(saleItems.map(item => ({
    company_id: company.id,
    order_id: order.id,
    product_id: item.productId,
    product_name: item.name,
    unit_price: item.price,
    quantity: item.quantity,
    total_price: item.total,
  })));
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id).eq("company_id", company.id);
    redirect(`/financeiro?erro=${encodeURIComponent(itemsError.message)}`);
  }

  const { error: paymentError } = await supabase.from("order_payments").insert({
    company_id: company.id,
    order_id: order.id,
    method: paymentMethod,
    status: "paid",
    amount: total,
    amount_received: amountReceived,
    change_amount: changeAmount,
    paid_at: paidAt,
  });
  if (paymentError) {
    await supabase.from("orders").delete().eq("id", order.id).eq("company_id", company.id);
    redirect(`/financeiro?erro=${encodeURIComponent(paymentError.message)}`);
  }

  revalidatePath("/financeiro"); revalidatePath("/pedidos"); revalidatePath("/cozinha"); revalidatePath("/pagamentos");
  const message = `Venda #${order.order_number} finalizada.${changeAmount > 0 ? ` Troco: R$ ${changeAmount.toFixed(2).replace(".", ",")}.` : ""}`;
  redirect(`/financeiro?sucesso=${encodeURIComponent(message)}`);
}

export async function closeCashSession(formData: FormData) {
  const { supabase, company, user } = await getCurrentCompany();
  const sessionId = String(formData.get("sessionId") || "");
  const countedBalance = amountFrom(formData.get("countedBalance"));
  const expectedBalance = amountFrom(formData.get("expectedBalance"));
  const notes = String(formData.get("notes") || "").trim();

  if (!sessionId || countedBalance < 0) redirect("/financeiro?erro=Informe o valor contado no caixa.");
  const difference = countedBalance - expectedBalance;

  const { error } = await supabase.from("cash_sessions").update({
    closed_by: user.id,
    closed_at: new Date().toISOString(),
    expected_balance: expectedBalance,
    counted_balance: countedBalance,
    difference,
    status: "closed",
    notes: notes || null,
    updated_at: new Date().toISOString(),
  }).eq("id", sessionId).eq("company_id", company.id).eq("status", "open");

  if (error) redirect(`/financeiro?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/financeiro");
  redirect("/financeiro?sucesso=Caixa fechado com sucesso.");
}
