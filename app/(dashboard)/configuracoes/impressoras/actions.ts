"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireModule } from "@/lib/auth/current-company";

const printerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  brand: z.string().trim().max(80),
  model: z.string().trim().max(80),
  connectionType: z.enum(["usb", "network", "bluetooth"]),
  paperWidth: z.coerce.number().refine((value) => value === 58 || value === 80),
  windowsPrinterName: z.string().trim().min(1).max(160),
  sector: z.enum(["kitchen", "counter", "bar", "delivery"]),
  copies: z.coerce.number().int().min(1).max(5),
});

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export async function savePrinter(formData: FormData) {
  const parsed = printerSchema.safeParse({
    id: String(formData.get("id") || "") || undefined,
    name: String(formData.get("name") || ""),
    brand: String(formData.get("brand") || ""),
    model: String(formData.get("model") || ""),
    connectionType: String(formData.get("connectionType") || "usb"),
    paperWidth: formData.get("paperWidth"),
    windowsPrinterName: String(formData.get("windowsPrinterName") || ""),
    sector: String(formData.get("sector") || "kitchen"),
    copies: formData.get("copies"),
  });
  if (!parsed.success) redirect("/configuracoes/impressoras?erro=Revise%20os%20dados%20da%20impressora");

  const { supabase, company } = await requireModule("settings");
  const payload = {
    company_id: company.id,
    name: parsed.data.name,
    brand: parsed.data.brand || null,
    model: parsed.data.model || null,
    connection_type: parsed.data.connectionType,
    paper_width: parsed.data.paperWidth,
    windows_printer_name: parsed.data.windowsPrinterName,
    sector: parsed.data.sector,
    copies: parsed.data.copies,
    auto_print: checked(formData, "autoPrint"),
    print_customer: checked(formData, "printCustomer"),
    print_address: checked(formData, "printAddress"),
    print_payment: checked(formData, "printPayment"),
    updated_at: new Date().toISOString(),
  };
  const query = parsed.data.id
    ? supabase.from("thermal_printers").update(payload).eq("id", parsed.data.id).eq("company_id", company.id)
    : supabase.from("thermal_printers").insert(payload);
  const { error } = await query;
  if (error) redirect(`/configuracoes/impressoras?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/configuracoes/impressoras");
  const editQuery = parsed.data.id ? `editar=${parsed.data.id}&` : "";
  redirect(`/configuracoes/impressoras?${editQuery}sucesso=Impressora%20salva`);
}

export async function togglePrinter(formData: FormData) {
  const id = String(formData.get("id") || "");
  const status = formData.get("status") === "active" ? "active" : "paused";
  const { supabase, company } = await requireModule("settings");
  const { error } = await supabase.from("thermal_printers").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", company.id);
  if (error) redirect(`/configuracoes/impressoras?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/configuracoes/impressoras");
}

export async function deletePrinter(formData: FormData) {
  const id = String(formData.get("id") || "");
  const { supabase, company } = await requireModule("settings");
  const { error } = await supabase.from("thermal_printers").delete().eq("id", id).eq("company_id", company.id);
  if (error) redirect(`/configuracoes/impressoras?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/configuracoes/impressoras");
  redirect("/configuracoes/impressoras?sucesso=Impressora%20excluída");
}
