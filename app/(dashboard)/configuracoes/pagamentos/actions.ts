"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { createAdminClient } from "@/lib/supabase/admin";

export async function disconnectMercadoPago() {
  const { company, role } = await getCurrentCompany();
  if (!['owner', 'manager'].includes(role)) throw new Error("Sem permissão para alterar pagamentos.");
  const { error } = await createAdminClient().from("company_mercado_pago_integrations").update({
    status: "disconnected", access_token_encrypted: null, refresh_token_encrypted: null,
    access_token_expires_at: null, disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("company_id", company.id);
  if (error) throw new Error("Não foi possível desconectar o Mercado Pago.");
  revalidatePath("/configuracoes/pagamentos");
}

export async function setMercadoPagoCardEnabled(formData: FormData) {
  const { company, role } = await getCurrentCompany();
  if (!['owner', 'manager'].includes(role)) throw new Error("Sem permissão para alterar pagamentos.");
  const enabled = String(formData.get("enabled")) === "true";
  const admin = createAdminClient();
  const { data: integration } = await admin.from("company_mercado_pago_integrations")
    .select("status,access_token_encrypted").eq("company_id", company.id).maybeSingle();
  if (!integration?.access_token_encrypted || integration.status !== "connected") {
    throw new Error("Conecte o Mercado Pago antes de ativar o cartão online.");
  }
  if (enabled && !process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY) {
    throw new Error("A chave pública do Mercado Pago ainda não foi configurada.");
  }
  const { error } = await admin.from("company_mercado_pago_integrations").update({
    card_enabled: enabled, updated_at: new Date().toISOString(),
  }).eq("company_id", company.id);
  if (error) throw new Error("Não foi possível atualizar o cartão online.");
  revalidatePath("/configuracoes/pagamentos");
  revalidatePath(`/cardapio/${company.slug}`);
}
