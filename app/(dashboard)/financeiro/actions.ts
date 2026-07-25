"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";

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
