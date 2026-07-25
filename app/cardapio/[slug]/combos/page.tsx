import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ComboMenuClient from "./combo-menu-client";

export default async function PublicCombosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: menu, error: menuError } = await supabase.rpc("get_public_menu", { p_slug: slug });
  if (menuError || !menu?.company?.id) notFound();

  const { data: combos, error: combosError } = await supabase.rpc("get_public_combos", { p_company_id: menu.company.id });
  if (combosError) throw new Error(combosError.message);

  return <ComboMenuClient company={menu.company} combos={combos || []} />;
}
