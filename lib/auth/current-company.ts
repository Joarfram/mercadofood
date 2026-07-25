import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CompanyRole, ModuleKey } from "./permissions";
import { canAccess } from "./permissions";

export async function getCurrentCompany() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) redirect("/login");

  const { data: owned } = await supabase
    .from("companies")
    .select("id, name, slug")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (owned) return { supabase, user, company: owned, role: "owner" as CompanyRole };

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, role, is_active, companies(id, name, slug)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const company = Array.isArray(membership?.companies)
    ? membership?.companies[0]
    : membership?.companies;

  if (!company) redirect("/cadastro");
  return { supabase, user, company, role: membership!.role as CompanyRole };
}

export async function requireModule(module: ModuleKey) {
  const context = await getCurrentCompany();
  if (!canAccess(context.role, module)) redirect("/sem-permissao");
  return context;
}
