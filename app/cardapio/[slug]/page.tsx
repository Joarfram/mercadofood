import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import MenuClient from "./menu-client";

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
  return <MenuClient menu={data} deliveryZones={deliveryZones || []} hasCombos={Boolean(hasCombos)} serviceConfig={serviceConfig || { delivery_enabled:true,pickup_enabled:true,average_delivery_minutes:45 }} />;
}
