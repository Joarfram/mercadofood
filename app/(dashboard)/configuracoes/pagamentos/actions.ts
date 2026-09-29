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
