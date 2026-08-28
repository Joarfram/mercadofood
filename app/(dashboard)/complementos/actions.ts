"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlanModule } from "@/lib/auth/current-company";

const linkSchema = z.object({
  groupId: z.string().uuid(),
  productId: z.string().uuid(),
});

function refreshComplementos(slug: string, productId: string) {
  revalidatePath("/complementos");
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${productId}/complementos`);
  revalidatePath(`/cardapio/${slug}`);
}

export async function linkGroupToProduct(formData: FormData) {
  const parsed = linkSchema.safeParse({
    groupId: formData.get("groupId"),
    productId: formData.get("productId"),
  });
  if (!parsed.success) redirect("/complementos?erro=Selecione%20um%20produto%20válido");

  const { supabase, company } = await requirePlanModule("products");
  const [{ data: group }, { data: product }] = await Promise.all([
    supabase.from("product_option_groups").select("id").eq("id", parsed.data.groupId).eq("company_id", company.id).maybeSingle(),
    supabase.from("products").select("id").eq("id", parsed.data.productId).eq("company_id", company.id).maybeSingle(),
  ]);
  if (!group || !product) redirect("/complementos?erro=Grupo%20ou%20produto%20não%20encontrado");

  const { error } = await supabase.from("product_option_group_links").upsert({
    company_id: company.id,
    group_id: parsed.data.groupId,
    product_id: parsed.data.productId,
    is_active: true,
  }, { onConflict: "product_id,group_id" });
  if (error) redirect(`/complementos?erro=${encodeURIComponent(error.message)}`);

  refreshComplementos(company.slug, parsed.data.productId);
  redirect("/complementos?sucesso=Grupo%20vinculado%20ao%20produto");
}

export async function unlinkGroupFromProduct(formData: FormData) {
  const parsed = linkSchema.safeParse({
    groupId: formData.get("groupId"),
    productId: formData.get("productId"),
  });
  if (!parsed.success) redirect("/complementos?erro=Vínculo%20inválido");

  const { supabase, company } = await requirePlanModule("products");
  const { error } = await supabase.from("product_option_group_links")
    .delete()
    .eq("company_id", company.id)
    .eq("group_id", parsed.data.groupId)
    .eq("product_id", parsed.data.productId);
  if (error) redirect(`/complementos?erro=${encodeURIComponent(error.message)}`);

  refreshComplementos(company.slug, parsed.data.productId);
  redirect("/complementos?sucesso=Grupo%20desvinculado%20do%20produto");
}


