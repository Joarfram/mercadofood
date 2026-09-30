import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import MenuClient from "./menu-client";

export default async function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const [{ data, error }, { data: deliveryZones }, { data: hasCombos }, { data: serviceConfig }] = await Promise.all([
    supabase.rpc("get_public_menu", { p_slug: slug }),
    supabase.rpc("get_public_delivery_zones", { p_slug: slug }),
    supabase.rpc("has_public_combos", { p_slug: slug }),
    supabase.rpc("get_public_service_config", { p_slug: slug }),
  ]);
  if (error) throw new Error(`Não foi possível carregar o cardápio público: ${error.message}`);
  if (!data?.company) notFound();
  const { data: integration } = await createAdminClient().from("company_mercado_pago_integrations")
    .select("pix_enabled,card_enabled,status").eq("company_id", data.company.id).maybeSingle();
  const mercadoPagoPublicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || "";
  return <MenuClient menu={data} deliveryZones={deliveryZones || []} hasCombos={Boolean(hasCombos)} onlinePixAvailable={Boolean(integration?.pix_enabled && integration.status === "connected")} onlineCardAvailable={Boolean(integration?.card_enabled && integration.status === "connected" && mercadoPagoPublicKey)} mercadoPagoPublicKey={mercadoPagoPublicKey} serviceConfig={serviceConfig || { delivery_enabled:true,pickup_enabled:true,average_delivery_minutes:45 }} />;
}
