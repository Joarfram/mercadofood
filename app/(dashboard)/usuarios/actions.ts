"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";
import { companyRoles } from "@/lib/auth/permissions";
import { isPlanCode, plans } from "@/lib/billing/plans";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function createInvite(formData: FormData) {
  const { supabase, user, company, role } = await requirePlanModule("team");
  if (!(["owner", "manager"] as string[]).includes(role)) redirect("/sem-permissao");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const invitedRole = String(formData.get("role") || "attendant");
  if (!email || !companyRoles.includes(invitedRole as never) || invitedRole === "owner") {
    redirect("/usuarios?erro=Dados%20do%20convite%20inválidos");
  }
  if (role === "manager" && invitedRole === "manager") {
    redirect("/usuarios?erro=Somente%20o%20proprietário%20pode%20convidar%20gerentes");
  }

  const [{ data: subscription }, { count: activeMembers }, { count: pendingInvites }] = await Promise.all([
    supabase.from("company_subscriptions").select("subscription_plans(code)").eq("company_id", company.id).maybeSingle(),
    supabase.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("is_active", true),
    supabase.from("company_invites").select("id", { count: "exact", head: true }).eq("company_id", company.id).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  const relatedPlan = Array.isArray(subscription?.subscription_plans) ? subscription?.subscription_plans[0] : subscription?.subscription_plans;
  const planCode = isPlanCode(relatedPlan?.code) ? relatedPlan.code : "premium";
  const occupiedSeats = 1 + (activeMembers || 0) + (pendingInvites || 0);
  if (occupiedSeats >= plans[planCode].userLimit) redirect(`/usuarios?erro=${encodeURIComponent(`Seu plano permite até ${plans[planCode].userLimit} usuários. Cancele um convite ou faça upgrade.`)}`);

  const { data, error } = await supabase.from("company_invites").insert({
    company_id: company.id,
    email,
    role: invitedRole,
    invited_by: user.id
  }).select("token").single();

  if (error) redirect(`/usuarios?erro=${encodeURIComponent(error.message)}`);
  const inviteLink = `${appUrl()}/convite/${data.token}`;
  redirect(`/usuarios?convite=${encodeURIComponent(inviteLink)}`);
}

export async function updateMember(formData: FormData) {
  const { supabase, company, role } = await requirePlanModule("team");
  if (!(["owner", "manager"] as string[]).includes(role)) redirect("/sem-permissao");

  const memberId = String(formData.get("memberId") || "");
  const nextRole = String(formData.get("role") || "attendant");
  const isActive = String(formData.get("isActive") || "true") === "true";
  if (!memberId || !companyRoles.includes(nextRole as never) || nextRole === "owner") return;
  if (role === "manager" && nextRole === "manager") return;

  await supabase.from("company_members")
    .update({ role: nextRole, is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("company_id", company.id);
  revalidatePath("/usuarios");
}

export async function cancelInvite(formData: FormData) {
  const { supabase, company, role } = await requirePlanModule("team");
  if (!(["owner", "manager"] as string[]).includes(role)) redirect("/sem-permissao");
  const inviteId = String(formData.get("inviteId") || "");
  await supabase.from("company_invites").delete().eq("id", inviteId).eq("company_id", company.id);
  revalidatePath("/usuarios");
}
