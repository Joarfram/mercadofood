import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import MenuClient from "./menu-client";
import DeliverySimpleMenuClientV2 from "./delivery-simple-menu-client-v2";

function normalizeMeasuredMenuForClient(menu: any) {
  return {
    ...menu,
    categories: (menu.categories || []).map((category: any) => ({
      ...category,
      products: (category.products || []).map((product: any) => {
        if (product.selling_mode !== "weight") return product;
        const referenceUnit = product.reference_unit === "kg" ? "kg" : "g";
        const divisor = referenceUnit === "kg" ? 1000 : 1;
        return {
          ...product,
          // No banco, mínimo e incremento são sempre gramas. O cliente V2 trabalha
          // na mesma unidade visual da referência, então convertemos apenas para a UI.
          minimum_sale_quantity: Number(product.minimum_sale_quantity || 0) / divisor,
          sale_increment: Number(product.sale_increment || 0) / divisor,
        };
      }),
    })),
  };
}

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

  const allProducts = (data.categories || []).flatMap((category: { products?: Array<{ selling_mode?: string }> }) => category.products || []);
  const hasMeasuredProducts = allProducts.some((product: { selling_mode?: string }) => product.selling_mode === "weight" || product.selling_mode === "fixed_weight");
  const config = serviceConfig || { delivery_enabled: true, pickup_enabled: true, average_delivery_minutes: 45 };

  // Quando a loja usa venda por peso, o cardápio Delivery Simples V2 assume o fluxo completo,
  // inclusive produtos com complementos. Lojas sem venda por peso continuam no cardápio atual.
  if (hasMeasuredProducts) {
    return <DeliverySimpleMenuClientV2 menu={normalizeMeasuredMenuForClient(data)} deliveryZones={deliveryZones || []} serviceConfig={config} />;
  }

  return <MenuClient menu={data} deliveryZones={deliveryZones || []} hasCombos={Boolean(hasCombos)} serviceConfig={config} />;
}
