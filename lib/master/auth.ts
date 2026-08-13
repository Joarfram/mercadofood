import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformLevel = "viewer" | "support" | "master";

const rank: Record<PlatformLevel, number> = { viewer: 1, support: 2, master: 3 };

export async function requirePlatformStaff(minimum: PlatformLevel = "viewer") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/master");

  const { data: staff } = await supabase
    .from("platform_staff")
    .select("display_name,support_level,is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const level = staff?.support_level as PlatformLevel | undefined;
  if (!level || rank[level] < rank[minimum]) redirect("/sem-permissao");
  return { supabase, admin: createAdminClient(), user, staff: { ...staff, support_level: level } };
}
