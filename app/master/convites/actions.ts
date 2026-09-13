"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformStaff } from "@/lib/master/auth";
import { isPlanCode } from "@/lib/billing/plans";

const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calculate = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calculate(9) === Number(cpf[9]) && calculate(10) === Number(cpf[10]);
}

function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (baseLength: number) => {
    const weights = baseLength === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character] || character,
  );
}

async function sendInviteEmail(input: {
  email: string;
  name: string;
  company: string;
  plan: string;
  link: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_EMAIL_FROM;
  if (!key || !from) return { sent: false, reason: "E-mail automático ainda não configurado" };

  const safeName = escapeHtml(input.name || "cliente");
  const safeCompany = escapeHtml(input.company);
  const safePlan = escapeHtml(input.plan);
  const safeLink = escapeHtml(input.link);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `Seu acesso ao MercadoFood — Plano ${input.plan}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1 style="color:#047857">Bem-vindo ao MercadoFood</h1><p>Olá, ${safeName}.</p><p>Seu acesso para <strong>${safeCompany}</strong> no plano <strong>${safePlan}</strong> está pronto.</p><p><a href="${safeLink}" style="display:inline-block;background:#047857;color:white;padding:14px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Criar minha conta</a></p><p style="color:#64748b;font-size:13px">Abrir o link não consome o convite. Ele só será utilizado após a confirmação do cadastro.</p></div>`,
    }),
  });

  if (!response.ok) return { sent: false, reason: "Não foi possível enviar o e-mail" };
  return { sent: true, reason: "E-mail enviado automaticamente" };
}

export async function createPlanInvite(formData: FormData) {
  const { admin, user } = await requirePlatformStaff("master");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const companyName = String(formData.get("companyName") || "").trim();
  const legalName = String(formData.get("legalName") || "").trim();
  const unitName = String(formData.get("unitName") || "").trim();
  const responsibleName = String(formData.get("responsibleName") || "").trim();
  const whatsapp = onlyDigits(String(formData.get("whatsapp") || ""));
  const documentType = String(formData.get("documentType") || "").toUpperCase();
  const documentNumber = onlyDigits(String(formData.get("documentNumber") || ""));
  const planCode = String(formData.get("plan") || "");

  const documentValid =
    (documentType === "CPF" && isValidCpf(documentNumber)) ||
    (documentType === "CNPJ" && isValidCnpj(documentNumber));

  if (
    !/^\S+@\S+\.\S+$/.test(email) ||
    !companyName ||
    !["CPF", "CNPJ"].includes(documentType) ||
    !documentValid ||
    whatsapp.length < 10 ||
    whatsapp.length > 15 ||
    !isPlanCode(planCode)
  ) {
    redirect("/master/convites?erro=Informe e-mail, WhatsApp e CPF/CNPJ válidos");
  }

  const normalizedCompany = normalizeName(companyName);
  const normalizedUnit = normalizeName(unitName);

  const [{ data: existingCompanies }, { data: pendingInvites }] = await Promise.all([
    admin
      .from("companies")
      .select("id,name,unit_name,archived_at,document_type,document_number")
      .is("archived_at", null),
    admin
      .from("platform_plan_invites")
      .select("id,company_name,unit_name,status,expires_at,document_type,document_number")
      .eq("status", "pending"),
  ]);

  const duplicateCompany = (existingCompanies || []).find(
    (company) =>
      normalizeName(company.name || "") === normalizedCompany &&
      normalizeName(company.unit_name || "") === normalizedUnit,
  );

  if (duplicateCompany) {
    redirect(
      `/master/convites?erro=${encodeURIComponent("Já existe uma empresa ativa com esse nome e unidade. Abra a empresa existente em vez de criar outra.")}`,
    );
  }

  const sameDocumentCompany = (existingCompanies || []).find(
    (company) =>
      company.document_number === documentNumber &&
      company.document_type === documentType &&
      documentType === "CNPJ",
  );

  if (sameDocumentCompany) {
    redirect(
      `/master/convites?erro=${encodeURIComponent("Já existe uma empresa ativa cadastrada com este CNPJ.")}`,
    );
  }

  const now = Date.now();
  const duplicateInvite = (pendingInvites || []).find(
    (invite) =>
      new Date(invite.expires_at).getTime() > now &&
      normalizeName(invite.company_name || "") === normalizedCompany &&
      normalizeName(invite.unit_name || "") === normalizedUnit,
  );

  if (duplicateInvite) {
    redirect(
      `/master/convites?erro=${encodeURIComponent("Já existe um convite pendente para essa empresa e unidade.")}`,
    );
  }

  const duplicateDocumentInvite = (pendingInvites || []).find(
    (invite) =>
      new Date(invite.expires_at).getTime() > now &&
      invite.document_type === documentType &&
      invite.document_number === documentNumber &&
      documentType === "CNPJ",
  );

  if (duplicateDocumentInvite) {
    redirect(
      `/master/convites?erro=${encodeURIComponent("Já existe um convite pendente para este CNPJ.")}`,
    );
  }

  const { data: plan } = await admin
    .from("subscription_plans")
    .select("id,name")
    .eq("code", planCode)
    .eq("is_active", true)
    .single();

  const { data, error } = await admin
    .from("platform_plan_invites")
    .insert({
      email,
      company_name: companyName,
      legal_name: legalName || null,
      unit_name: unitName || null,
      responsible_name: responsibleName || null,
      whatsapp: whatsapp || null,
      document_type: documentType,
      document_number: documentNumber,
      plan_id: plan?.id,
      created_by: user.id,
    })
    .select("token")
    .single();

  if (error) redirect(`/master/convites?erro=${encodeURIComponent(error.message)}`);

  const link = `${appUrl()}/convite-plano/${data.token}`;
  const displayCompany = unitName ? `${companyName} — ${unitName}` : companyName;
  const delivery = await sendInviteEmail({
    email,
    name: responsibleName,
    company: displayCompany,
    plan: plan?.name || planCode,
    link,
  });

  redirect(
    `/master/convites?convite=${encodeURIComponent(link)}&email=${encodeURIComponent(email)}&whatsapp=${encodeURIComponent(whatsapp)}&envio=${encodeURIComponent(delivery.reason)}`,
  );
}

export async function cancelPlanInvite(formData: FormData) {
  const { admin } = await requirePlatformStaff("master");
  const id = String(formData.get("id") || "");
  await admin
    .from("platform_plan_invites")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  revalidatePath("/master/convites");
}
