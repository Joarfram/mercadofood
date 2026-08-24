import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CompanyRole, ModuleKey } from "./permissions";
import { canAccess } from "./permissions";
import { isPlanCode, planAllows } from "@/lib/billing/plans";
import { cookies } from "next/headers";

type SupportContext = {
  id: string;
  accessLevel: "viewer" | "support";
  expiresAt: string;
};

export async function getCurrentCompany() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) redirect("/login");

  const supportSessionId = (await cookies()).get("mf_support_session")?.value;
  if (supportSessionId) {
    const { data: supportRows } = await supabase.rpc("get_support_context", {
      target_session: supportSessionId
    });
    const support = supportRows?.[0];
    if (support) {
      const mappedRole: CompanyRole = support.access_level === "viewer" ? "viewer" : "manager";
      return {
        supabase,
        user,
        company: { id: support.company_id, name: support.company_name, slug: support.company_slug, menu_theme: "burger_night" },
        role: mappedRole,
        supportSession: {
          id: support.session_id,
          accessLevel: support.access_level,
          expiresAt: support.expires_at
        } as SupportContext
      };
    }
  }

  const { data: owned } = await supabase
    .from("companies")
    .select("id, name, slug, menu_theme")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (owned) return { supabase, user, company: owned, role: "owner" as CompanyRole, supportSession: null };

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, role, is_active, companies(id, name, slug, menu_theme)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const company = Array.isArray(membership?.companies)
    ? membership?.companies[0]
    : membership?.companies;

  if (!company) redirect("/cadastro");
  return { supabase, user, company, role: membership!.role as CompanyRole, supportSession: null };
}

export async function requireModule(module: ModuleKey) {
  const context = await getCurrentCompany();
  if (!canAccess(context.role, module)) redirect("/sem-permissao");
  return context;
}

export async function requirePlanModule(module: ModuleKey) {
  const context = await requireModule(module);
  const { data, error } = await context.supabase
    .from("company_subscriptions")
    .select("status, subscription_plans(code)")
    .eq("company_id", context.company.id)
    .maybeSingle();

  // Falha de assinatura nunca pode liberar silenciosamente o plano Premium.
  if (error || !data) {
    if (!planAllows("basic", module)) redirect(`/assinatura?bloqueado=${module}&erro=assinatura`);
    return { ...context, planCode: "basic" as const };
  }
  const relatedPlan = Array.isArray(data.subscription_plans) ? data.subscription_plans[0] : data.subscription_plans;
  const planCode = relatedPlan?.code;
  const { data: databaseAllows, error: entitlementError } = await context.supabase.rpc("company_plan_allows", {
    target_company: context.company.id,
    requested_module: module
  });
  const active = data.status === "active" || data.status === "trialing";
  const allowed = entitlementError ? (isPlanCode(planCode) && planAllows(planCode,module)) : Boolean(databaseAllows);
  if (!active || !allowed) redirect(`/sem-permissao?recurso=${module}`);
  return { ...context, planCode: isPlanCode(planCode) ? planCode : "basic" as const };
}
