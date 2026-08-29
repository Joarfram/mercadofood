import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import MenuClient from "./menu-client";
import DeliverySimpleMenuClientV2 from "./delivery-simple-menu-client-v2";

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

  // Lojas com venda por peso usam o fluxo Delivery Simples V2. O atalho de combos
  // permanece visível fora do cliente V2 para não perder uma funcionalidade já existente.
  if (hasMeasuredProducts) {
    return <>
      {Boolean(hasCombos) && <div className="border-b border-orange-200 bg-orange-50 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-orange-700">Combos disponíveis</p><strong className="text-sm text-orange-950">Monte seu combo e economize</strong></div>
          <Link href={`/cardapio/${slug}/combos`} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-white">Ver combos</Link>
        </div>
      </div>}
      <DeliverySimpleMenuClientV2 menu={data} deliveryZones={deliveryZones || []} serviceConfig={config} />
    </>;
  }

  return <MenuClient menu={data} deliveryZones={deliveryZones || []} hasCombos={Boolean(hasCombos)} serviceConfig={config} />;
}
