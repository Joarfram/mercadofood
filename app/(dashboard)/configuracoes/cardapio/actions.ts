"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/auth/current-company";

const money = (value: FormDataEntryValue | null) => Number(String(value || "0").replace(",", ".")) || 0;
const checked = (formData: FormData, name: string) => formData.get(name) === "on";

export async function saveMenuSettings(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const payload = {
    menu_is_active: checked(formData, "menuIsActive"),
    pickup_enabled: checked(formData, "pickupEnabled"),
    delivery_enabled: checked(formData, "deliveryEnabled"),
    name: String(formData.get("name") || "").trim(),
    slug: String(formData.get("slug") || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    logo_url: String(formData.get("logoUrl") || "").trim() || null,
    banner_url: String(formData.get("bannerUrl") || "").trim() || null,
    primary_color: "#2E7D32",
    accent_color: "#F59E0B",
    secondary_color: "#3B82F6",
    menu_layout: String(formData.get("menuLayout") || "cards"),
    menu_theme: "fresh_natural",
    menu_message: String(formData.get("menuMessage") || "").trim() || null,
    whatsapp: String(formData.get("whatsapp") || "").replace(/\D/g, "") || null,
    address_line: String(formData.get("addressLine") || "").trim() || null,
    city: String(formData.get("city") || "").trim() || null,
    state: String(formData.get("state") || "").trim().toUpperCase().slice(0, 2) || null,
    postal_code: String(formData.get("postalCode") || "").replace(/\D/g, "") || null,
    delivery_minimum: money(formData.get("deliveryMinimum")),
    default_delivery_fee: money(formData.get("defaultDeliveryFee")),
    average_delivery_minutes: Math.max(5, Number(formData.get("averageDeliveryMinutes") || 45)),
  };
  if (!payload.name || !payload.slug) redirect("/configuracoes/cardapio?erro=Informe%20nome%20e%20endereço%20do%20cardápio");
  const { error } = await supabase.from("companies").update(payload).eq("id", company.id);
  if (error) redirect(`/configuracoes/cardapio?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/configuracoes/cardapio");
  revalidatePath("/dashboard");
  revalidatePath(`/cardapio/${payload.slug}`);
  redirect("/configuracoes/cardapio?sucesso=Configurações%20salvas");
}

export async function saveBusinessHours(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const rows = Array.from({ length: 7 }, (_, weekday) => ({
    company_id: company.id,
    weekday,
    is_open: checked(formData, `open_${weekday}`),
    opens_at: String(formData.get(`opens_${weekday}`) || "09:00"),
    closes_at: String(formData.get(`closes_${weekday}`) || "18:00"),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("business_hours").upsert(rows, { onConflict: "company_id,weekday" });
  if (error) redirect(`/configuracoes/cardapio?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/configuracoes/cardapio");
  redirect("/configuracoes/cardapio?sucesso=Horários%20salvos");
}

export async function addDeliveryZone(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/configuracoes/cardapio?erro=Informe%20o%20bairro%20ou%20região");
  const { error } = await supabase.from("delivery_zones").insert({
    company_id: company.id,
    name,
    delivery_fee: money(formData.get("deliveryFee")),
    minimum_order: money(formData.get("minimumOrder")),
    estimated_minutes: Math.max(5, Number(formData.get("estimatedMinutes") || 45)),
  });
  if (error) redirect(`/configuracoes/cardapio?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/configuracoes/cardapio");
  redirect("/configuracoes/cardapio?sucesso=Região%20adicionada");
}

export async function toggleDeliveryZone(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const id = String(formData.get("id") || "");
  const active = formData.get("active") === "true";
  await supabase.from("delivery_zones").update({ is_active: !active }).eq("id", id).eq("company_id", company.id);
  revalidatePath("/configuracoes/cardapio");
}

export async function deleteDeliveryZone(formData: FormData) {
  const { supabase, company } = await getCurrentCompany();
  const id = String(formData.get("id") || "");
  await supabase.from("delivery_zones").delete().eq("id", id).eq("company_id", company.id);
  revalidatePath("/configuracoes/cardapio");
}
