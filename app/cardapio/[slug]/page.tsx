import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import MenuClient from "./menu-client";
import DeliverySimpleMenuClient from "./delivery-simple-menu-client";

export default async function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} }
  });
  const [{ data, error }, { data: deliveryZones }, { data: hasCombos }, { data: serviceConfig }] = await Promise.all([
    supabase.rpc("get_public_menu_delivery_simple", { p_slug: slug }),
    supabase.rpc("get_public_delivery_zones", { p_slug: slug }),
    supabase.rpc("has_public_combos", { p_slug: slug }),
    supabase.rpc("get_public_service_config", { p_slug: slug }),
  ]);
  if (error || !data?.company) notFound();

  const allProducts = (data.categories || []).flatMap((category: { products?: Array<{ selling_mode?: string; option_groups?: unknown[] }> }) => category.products || []);
  const hasMeasuredProducts = allProducts.some((product: { selling_mode?: string }) => product.selling_mode === "weight" || product.selling_mode === "fixed_weight");
  const hasProductOptions = allProducts.some((product: { option_groups?: unknown[] }) => Array.isArray(product.option_groups) && product.option_groups.length > 0);
  const config = serviceConfig || { delivery_enabled: true, pickup_enabled: true, average_delivery_minutes: 45 };

  // Nesta etapa, a experiência específica por peso entra somente quando não há complementos.
  // Assim preservamos o cardápio legado para lojas que já usam grupos de adicionais enquanto
  // a integração completa entre peso + complementos é construída.
  if (hasMeasuredProducts && !hasProductOptions) {
    return <DeliverySimpleMenuClient menu={data} deliveryZones={deliveryZones || []} serviceConfig={config} />;
  }

  return <MenuClient menu={data} deliveryZones={deliveryZones || []} hasCombos={Boolean(hasCombos)} serviceConfig={config} />;
}
