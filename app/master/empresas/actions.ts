"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformStaff } from "@/lib/master/auth";
import { z } from "zod";

async function audit(
  admin: Awaited<ReturnType<typeof requirePlatformStaff>>["admin"],
  userId: string,
  companyId: string,
  action: string,
  oldValues: unknown,
  newValues: unknown,
) {
  await admin.from("support_audit_logs").insert({
    staff_user_id: userId,
    company_id: companyId,
    action,
    old_values: oldValues,
    new_values: newValues,
    metadata: { source: "master_panel" },
  });
}

export async function updateSubscription(formData: FormData) {
  const { admin, user } = await requirePlatformStaff("master");
  const companyId = String(formData.get("companyId") || "");
  const planId = String(formData.get("planId") || "");
  const status = String(formData.get("status") || "");
  if (!companyId || !planId || !["trialing", "active", "past_due", "suspended", "canceled"].includes(status)) return;

  const { data: before } = await admin
    .from("company_subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .single();

  const periodEndValue = String(formData.get("currentPeriodEndsAt") || "");
  const periodEnd = periodEndValue ? new Date(`${periodEndValue}T23:59:59.999Z`) : null;
  const payload = {
    plan_id: planId,
    status,
    current_period_ends_at: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd.toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { data: after } = await admin
    .from("company_subscriptions")
    .update(payload)
    .eq("company_id", companyId)
    .select()
    .single();

  await audit(admin, user.id, companyId, "master.subscription_updated", before, after);
  revalidatePath("/master");
  revalidatePath("/master/empresas");
}

const paymentSchema = z.object({
  companyId: z.string().uuid(),
  amount: z.coerce.number().nonnegative(),
  status: z.enum(["pending", "paid", "failed", "refunded", "canceled"]),
  paymentMethod: z.string().trim().max(80),
  providerReference: z.string().trim().max(160),
  dueAt: z.string(),
  paidAt: z.string(),
  notes: z.string().trim().max(500),
});

export async function recordSubscriptionPayment(formData: FormData) {
  const { admin, user } = await requirePlatformStaff("master");
  const parsed = paymentSchema.safeParse({
    companyId: formData.get("companyId"),
    amount: formData.get("amount"),
    status: formData.get("paymentStatus"),
    paymentMethod: formData.get("paymentMethod") || "",
    providerReference: formData.get("providerReference") || "",
    dueAt: formData.get("dueAt") || "",
    paidAt: formData.get("paidAt") || "",
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) redirect("/master/empresas?erro=Pagamento inválido");

  const value = parsed.data;
  const { data: subscription } = await admin
    .from("company_subscriptions")
    .select("id,plan_id")
    .eq("company_id", value.companyId)
    .single();
  if (!subscription) redirect("/master/empresas?erro=Assinatura não encontrada");

  const { data: payment, error } = await admin.from("subscription_payments").insert({
    company_id: value.companyId,
    subscription_id: subscription.id,
    plan_id: subscription.plan_id,
    amount: value.amount,
    status: value.status,
    payment_method: value.paymentMethod || null,
    provider: "manual",
    provider_reference: value.providerReference || null,
    due_at: value.dueAt ? new Date(`${value.dueAt}T12:00:00Z`).toISOString() : null,
    paid_at: value.paidAt ? new Date(`${value.paidAt}T12:00:00Z`).toISOString() : value.status === "paid" ? new Date().toISOString() : null,
    notes: value.notes || null,
    recorded_by: user.id,
  }).select().single();

  if (error || !payment) redirect(`/master/empresas?erro=${encodeURIComponent(error?.message || "Falha ao registrar pagamento")}`);
  await audit(admin, user.id, value.companyId, "master.subscription_payment_recorded", null, payment);
  revalidatePath("/master");
  revalidatePath("/master/empresas");
}

export async function addTrialDays(formData: FormData) {
  const { admin, user } = await requirePlatformStaff("master");
  const companyId = String(formData.get("companyId") || "");
  const days = Math.max(1, Math.min(90, Number(formData.get("days") || 3)));

  const { data: before } = await admin
    .from("company_subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .single();
  if (!before) return;

  const current = before.trial_ends_at ? new Date(before.trial_ends_at).getTime() : 0;
  const base = Math.max(Date.now(), current);
  const trialEnds = new Date(base + days * 86400000).toISOString();

  const { data: after } = await admin
    .from("company_subscriptions")
    .update({ status: "trialing", trial_ends_at: trialEnds, updated_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .select()
    .single();

  await audit(admin, user.id, companyId, "master.trial_extended", before, after);
  revalidatePath("/master");
  revalidatePath("/master/empresas");
}

export async function setModuleOverride(formData: FormData) {
  const { admin, user } = await requirePlatformStaff("master");
  const companyId = String(formData.get("companyId") || "");
  const moduleKey = String(formData.get("moduleKey") || "");
  const enabled = String(formData.get("enabled")) === "true";
  if (!companyId || !moduleKey) return;

  const { data: before } = await admin
    .from("company_entitlement_overrides")
    .select("*")
    .eq("company_id", companyId)
    .eq("module_key", moduleKey)
    .maybeSingle();

  const { data: after } = await admin
    .from("company_entitlement_overrides")
    .upsert(
      {
        company_id: companyId,
        module_key: moduleKey,
        enabled,
        granted_by: user.id,
        reason: "Painel Master",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,module_key" },
    )
    .select()
    .single();

  await audit(admin, user.id, companyId, "master.module_override", before, after);
  revalidatePath("/master/empresas");
}

export async function archiveCompany(formData: FormData) {
  const { admin, user } = await requirePlatformStaff("master");
  const companyId = String(formData.get("companyId") || "");
  const reason = String(formData.get("reason") || "").trim() || "Encerramento solicitado pelo administrador";
  if (!companyId) return;

  const { data: before } = await admin
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();
  if (!before || before.archived_at) return;

  const archivedAt = new Date().toISOString();
  const { data: after, error } = await admin
    .from("companies")
    .update({
      archived_at: archivedAt,
      archive_reason: reason,
      archived_by: user.id,
      status: "archived",
      menu_is_active: false,
    })
    .eq("id", companyId)
    .select()
    .single();

  if (error || !after) {
    redirect(`/master/empresas?erro=${encodeURIComponent("Não foi possível arquivar a empresa.")}`);
  }

  await admin
    .from("company_subscriptions")
    .update({ status: "canceled", updated_at: archivedAt })
    .eq("company_id", companyId);

  await audit(admin, user.id, companyId, "master.company_archived", before, after);
  revalidatePath("/master");
  revalidatePath("/master/empresas");
}

export async function restoreCompany(formData: FormData) {
  const { admin, user } = await requirePlatformStaff("master");
  const companyId = String(formData.get("companyId") || "");
  if (!companyId) return;

  const { data: before } = await admin
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();
  if (!before || !before.archived_at) return;

  const { data: after, error } = await admin
    .from("companies")
    .update({
      archived_at: null,
      archive_reason: null,
      archived_by: null,
      status: "active",
      menu_is_active: false,
    })
    .eq("id", companyId)
    .select()
    .single();

  if (error || !after) {
    redirect(
      `/master/empresas?view=archived&erro=${encodeURIComponent(
        error?.message?.includes("duplicate")
          ? "Já existe uma empresa ativa com o mesmo nome, unidade ou documento."
          : "Não foi possível restaurar a empresa.",
      )}`,
    );
  }

  await audit(admin, user.id, companyId, "master.company_restored", before, after);
  revalidatePath("/master");
  revalidatePath("/master/empresas");
}

export async function deleteCompanyPermanently(formData: FormData) {
  const { admin, user } = await requirePlatformStaff("master");
  const companyId = String(formData.get("companyId") || "");
  const confirmation = String(formData.get("confirmation") || "").trim();
  if (!companyId || !confirmation) return;

  const { data: company } = await admin
    .from("companies")
    .select("id,name,unit_name,legal_name,document_type,document_number,owner_id,archived_at")
    .eq("id", companyId)
    .single();

  if (!company || !company.archived_at || confirmation !== company.name) {
    redirect(
      `/master/empresas?view=archived&erro=${encodeURIComponent(
        "A exclusão definitiva exige uma empresa arquivada e a confirmação exata do nome.",
      )}`,
    );
  }

  await audit(admin, user.id, companyId, "master.company_deleted_permanently", company, {
    deleted_at: new Date().toISOString(),
    company_snapshot: company,
  });

  const { error } = await admin.from("companies").delete().eq("id", companyId);
  if (error) {
    redirect(
      `/master/empresas?view=archived&erro=${encodeURIComponent(
        `Não foi possível excluir definitivamente: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/master");
  revalidatePath("/master/empresas");
}
