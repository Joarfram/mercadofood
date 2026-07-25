"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";

export async function savePixSettings(formData: FormData) {
  const pixKey = String(formData.get("pixKey") || "").trim();
  const merchantName = String(formData.get("merchantName") || "").trim();
  const merchantCity = String(formData.get("merchantCity") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!pixKey || !merchantName || !merchantCity) {
    redirect("/configuracoes/pix?erro=Preencha%20chave,%20nome%20e%20cidade");
  }

  const { supabase, company } = await getCurrentCompany();
  const { error } = await supabase.from("company_pix_settings").upsert({
    company_id: company.id,
    pix_key: pixKey,
    merchant_name: merchantName,
    merchant_city: merchantCity,
    description: description || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" });
  if (error) redirect(`/configuracoes/pix?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/configuracoes/pix");
  revalidatePath("/pagamentos");
  redirect("/configuracoes/pix?sucesso=Configuração%20PIX%20salva");
}
