import { Phone, Plus, ShieldCheck } from "lucide-react";
import { requirePlatformStaff } from "@/lib/master/auth";
import { createPlanInvite } from "../convites/actions";
import {
  addTrialDays,
  archiveCompany,
  deleteCompanyPermanently,
  restoreCompany,
  recordSubscriptionPayment,
  setModuleOverride,
  updateSubscription,
} from "./actions";

const statusLabel: Record<string, string> = {
  trialing: "Em teste",
  active: "Pago/ativo",
  past_due: "Pagamento pendente",
  suspended: "Suspenso",
  canceled: "Cancelado",
};

const modules = [
  "dashboard",
  "orders",
  "products",
  "kitchen",
  "delivery",
  "payments",
  "finance",
  "reports",
  "stock",
  "customers",
  "promotions",
  "marketing",
  "messages",
  "tables",
  "settings",
  "team",
];

const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

const money = (value: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));

function maskDocument(type?: string | null, value?: string | null) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "—";
  if (type === "CNPJ" && digits.length === 14) return `**.***.***/****-${digits.slice(-2)}`;
  if (type === "CPF" && digits.length === 11) return `***.***.***-${digits.slice(-2)}`;
  return `••••${digits.slice(-4)}`;
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { admin, staff } = await requirePlatformStaff();
  const q = await searchParams;
  const view = typeof q.view === "string" ? q.view : "active";

  const [
    { data: companies },
    { data: plans },
    { data: subscriptions },
    { data: overrides },
    { data: subscriptionPayments },
    { data: auditLogs },
    { data: authUsers },
  ] = await Promise.all([
    admin
      .from("companies")
      .select(
        "id,owner_id,name,legal_name,unit_name,responsible_name,phone,whatsapp,status,created_at,last_activity_at,archived_at,archive_reason,document_type,document_number",
      )
      .order("created_at", { ascending: false }),
    admin.from("subscription_plans").select("id,code,name").eq("is_active", true).order("name"),
    admin
      .from("company_subscriptions")
      .select("company_id,plan_id,status,trial_ends_at,current_period_starts_at,current_period_ends_at"),
    admin.from("company_entitlement_overrides").select("company_id,module_key,enabled"),
    admin.from("subscription_payments").select("id,company_id,amount,status,payment_method,due_at,paid_at,created_at").order("created_at", { ascending: false }).limit(500),
    admin.from("support_audit_logs").select("id,company_id,action,occurred_at").like("action", "master.%").order("occurred_at", { ascending: false }).limit(500),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const subMap = new Map((subscriptions || []).map((s) => [s.company_id, s]));
  const userMap = new Map((authUsers?.users || []).map((u) => [u.id, u]));
  const activeCompanies = (companies || []).filter((company) => !company.archived_at);
  const archivedCompanies = (companies || []).filter((company) => company.archived_at);
  const visibleCompanies = view === "archived" ? archivedCompanies : activeCompanies;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold text-emerald-700">Clientes da plataforma</p>
          <h1 className="text-3xl font-black">Empresas</h1>
          <p className="text-gray-500">Cadastre, acompanhe, arquive e restaure clientes do MercadoFood.</p>
        </div>

        {staff.support_level === "master" && (
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl bg-[#063D2F] px-4 py-3 font-bold text-white shadow-sm hover:bg-[#0a4d3c]">
              <Plus size={18} /> Nova empresa
            </summary>
            <div className="mt-3 w-full rounded-2xl border bg-white p-5 shadow-lg sm:absolute sm:right-0 sm:z-20 sm:w-[620px]">
              <h2 className="text-lg font-black text-slate-900">Cadastrar nova empresa</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cadastro profissional com CPF/CNPJ, razão social e proteção contra duplicidades.
              </p>

              <form action={createPlanInvite} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-sm font-semibold">Nome fantasia</span>
                  <input name="companyName" required placeholder="Ex.: Acarajé da Kelly" className="w-full rounded-lg border px-3 py-2" />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-semibold">Unidade</span>
                  <input name="unitName" placeholder="Ex.: Centro (opcional)" className="w-full rounded-lg border px-3 py-2" />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-semibold">Razão social</span>
                  <input name="legalName" placeholder="Opcional para CPF; recomendado para CNPJ" className="w-full rounded-lg border px-3 py-2" />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-semibold">Tipo de documento</span>
                  <select name="documentType" required defaultValue="" className="w-full rounded-lg border px-3 py-2">
                    <option value="" disabled>Selecione</option>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-sm font-semibold">CPF/CNPJ</span>
                  <input name="documentNumber" required inputMode="numeric" placeholder="Somente números" className="w-full rounded-lg border px-3 py-2" />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-semibold">Responsável</span>
                  <input name="responsibleName" placeholder="Nome do proprietário" className="w-full rounded-lg border px-3 py-2" />
                </label>
                <label>
                  <span className="mb-1 block text-sm font-semibold">WhatsApp</span>
                  <input name="whatsapp" required inputMode="numeric" placeholder="79999999999" className="w-full rounded-lg border px-3 py-2" />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-semibold">E-mail do responsável</span>
                  <input name="email" required type="email" placeholder="cliente@email.com" className="w-full rounded-lg border px-3 py-2" />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-semibold">Plano</span>
                  <select name="plan" required className="w-full rounded-lg border px-3 py-2">
                    <option value="">Selecione o plano</option>
                    {(plans || []).map((plan) => (
                      <option key={plan.id} value={plan.code}>{plan.name}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-slate-500 sm:col-span-2">
                  O documento é armazenado somente para identificação administrativa. Na lista geral ele aparece mascarado.
                </p>
                <button className="rounded-lg bg-orange-500 px-4 py-3 font-bold text-white hover:bg-orange-600 sm:col-span-2">
                  Cadastrar e enviar convite
                </button>
              </form>
            </div>
          </details>
        )}
      </header>

      <nav className="flex flex-wrap gap-2">
        <a href="/master/empresas?view=active" className={`rounded-full px-4 py-2 text-sm font-bold ${view !== "archived" ? "bg-emerald-700 text-white" : "border bg-white text-slate-700"}`}>
          Ativas ({activeCompanies.length})
        </a>
        <a href="/master/empresas?view=archived" className={`rounded-full px-4 py-2 text-sm font-bold ${view === "archived" ? "bg-slate-800 text-white" : "border bg-white text-slate-700"}`}>
          Arquivadas ({archivedCompanies.length})
        </a>
      </nav>

      {visibleCompanies.length === 0 && (
        <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">
          Nenhuma empresa nesta categoria.
        </div>
      )}

      <div className="grid gap-4 md:hidden">
        {visibleCompanies.map((company) => {
          const sub = subMap.get(company.id);
          const plan = plans?.find((p) => p.id === sub?.plan_id);
          const owner = userMap.get(company.owner_id);
          return (
            <article key={company.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="font-bold">{company.name}{company.unit_name ? ` — ${company.unit_name}` : ""}</h2>
                  {company.legal_name && <p className="text-xs text-slate-500">{company.legal_name}</p>}
                  <p className="text-sm text-gray-500">
                    {company.responsible_name || owner?.user_metadata?.full_name || owner?.email || "Responsável não informado"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    {company.document_type || "Documento"}: {maskDocument(company.document_type, company.document_number)}
                  </p>
                </div>
                <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                  {company.archived_at ? "Arquivada" : statusLabel[sub?.status || ""] || "Sem assinatura"}
                </span>
              </div>
              <p className="mt-4 flex gap-2 text-sm"><Phone size={16} />{company.whatsapp || company.phone || "Sem contato"}</p>
              <p className="mt-2 text-sm">Plano: <b>{plan?.name || "—"}</b></p>
              <p className="mt-1 text-xs text-gray-500">
                {company.archived_at ? `Arquivada em ${date(company.archived_at)} • ${company.archive_reason || "Sem motivo informado"}` : `Vencimento/renovação: ${date(sub?.current_period_ends_at || sub?.trial_ends_at)} • Atividade: ${date(company.last_activity_at)}`}
              </p>
              {staff.support_level === "master" && (
                <CompanyControls
                  companyId={company.id}
                  companyName={company.name}
                  archived={Boolean(company.archived_at)}
                  subscription={sub}
                  plans={plans || []}
                  overrides={(overrides || []).filter((o) => o.company_id === company.id)}
                  payments={(subscriptionPayments || []).filter((p) => p.company_id === company.id)}
                  auditLogs={(auditLogs || []).filter((log) => log.company_id === company.id)}
                />
              )}
            </article>
          );
        })}
      </div>

      {visibleCompanies.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border bg-white md:block">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-gray-500">
                <th className="p-4">Empresa / responsável</th>
                <th>Documento</th>
                <th>Contato</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Início</th>
                <th>{view === "archived" ? "Arquivada em" : "Vencimento/renovação"}</th>
                <th>{view === "archived" ? "Motivo" : "Última atividade"}</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleCompanies.map((company) => {
                const sub = subMap.get(company.id);
                const plan = plans?.find((p) => p.id === sub?.plan_id);
                const owner = userMap.get(company.owner_id);
                return (
                  <tr key={company.id} className="border-b align-top">
                    <td className="p-4">
                      <b>{company.name}{company.unit_name ? ` — ${company.unit_name}` : ""}</b>
                      {company.legal_name && <p className="max-w-[240px] truncate text-xs text-slate-500">{company.legal_name}</p>}
                      <p className="max-w-[220px] truncate text-xs text-gray-500">
                        {company.responsible_name || owner?.user_metadata?.full_name || owner?.email || "Não informado"}
                      </p>
                    </td>
                    <td>
                      <span className="text-xs font-semibold">{company.document_type || "—"}</span>
                      <p className="text-xs text-slate-500">{maskDocument(company.document_type, company.document_number)}</p>
                    </td>
                    <td>{company.whatsapp || company.phone || "—"}</td>
                    <td>{plan?.name || "—"}</td>
                    <td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{company.archived_at ? "Arquivada" : statusLabel[sub?.status || ""] || "Sem assinatura"}</span></td>
                    <td>{date(sub?.current_period_starts_at || company.created_at)}</td>
                    <td>{company.archived_at ? date(company.archived_at) : date(sub?.current_period_ends_at || sub?.trial_ends_at)}</td>
                    <td>{company.archived_at ? company.archive_reason || "—" : date(company.last_activity_at)}</td>
                    <td className="py-3">
                      {staff.support_level === "master" ? (
                        <CompanyControls
                          companyId={company.id}
                          companyName={company.name}
                          archived={Boolean(company.archived_at)}
                          subscription={sub}
                          plans={plans || []}
                          overrides={(overrides || []).filter((o) => o.company_id === company.id)}
                          payments={(subscriptionPayments || []).filter((p) => p.company_id === company.id)}
                          auditLogs={(auditLogs || []).filter((log) => log.company_id === company.id)}
                        />
                      ) : <span className="text-xs text-gray-500">Somente leitura</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompanyControls({
  companyId,
  companyName,
  archived,
  subscription,
  plans,
  overrides,
  payments,
  auditLogs,
}: {
  companyId: string;
  companyName: string;
  archived: boolean;
  subscription: any;
  plans: Array<{ id: string; name: string }>;
  overrides: Array<{ module_key: string; enabled: boolean }>;
  payments: Array<{ id: string; amount: number; status: string; payment_method: string | null; due_at: string | null; paid_at: string | null; created_at: string }>;
  auditLogs: Array<{ id: number; action: string; occurred_at: string }>;
}) {
  if (archived) {
    return (
      <details className="mt-3">
        <summary className="cursor-pointer font-bold text-slate-700">Administrar</summary>
        <div className="mt-3 w-[min(88vw,420px)] space-y-4 rounded-xl border bg-white p-4 shadow-lg">
          <form action={restoreCompany}>
            <input type="hidden" name="companyId" value={companyId} />
            <button className="w-full rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white">Restaurar empresa</button>
          </form>
          <details className="rounded-xl border border-red-200 bg-red-50 p-3">
            <summary className="cursor-pointer text-sm font-bold text-red-700">Excluir definitivamente</summary>
            <p className="mt-2 text-xs text-red-700">Esta ação é irreversível. Digite exatamente o nome da empresa para confirmar.</p>
            <form action={deleteCompanyPermanently} className="mt-3 space-y-2">
              <input type="hidden" name="companyId" value={companyId} />
              <input name="confirmation" required placeholder={companyName} className="w-full rounded-lg border border-red-200 px-3 py-2" />
              <button className="w-full rounded-lg bg-red-700 px-3 py-2 font-bold text-white">Excluir definitivamente</button>
            </form>
          </details>
        </div>
      </details>
    );
  }

  return (
    <details className="mt-3">
      <summary className="cursor-pointer font-bold text-emerald-700">Administrar</summary>
      <div className="mt-3 w-[min(88vw,440px)] space-y-4 rounded-xl border bg-white p-4 shadow-lg">
        <form action={updateSubscription} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="companyId" value={companyId} />
          <select name="planId" defaultValue={subscription?.plan_id} className="rounded-lg border px-3 py-2">
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select name="status" defaultValue={subscription?.status || "trialing"} className="rounded-lg border px-3 py-2">
            <option value="trialing">Em teste</option>
            <option value="active">Pago/ativo</option>
            <option value="past_due">Pagamento pendente</option>
            <option value="suspended">Suspenso</option>
            <option value="canceled">Cancelado</option>
          </select>
          <label className="text-xs font-semibold sm:col-span-2">Vencimento/próxima renovação<input name="currentPeriodEndsAt" type="date" defaultValue={subscription?.current_period_ends_at?.slice(0, 10) || ""} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <button className="rounded-lg bg-[#063D2F] px-3 py-2 font-bold text-white sm:col-span-2">Salvar plano, status e vencimento</button>
        </form>

        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-bold">Pagamentos da assinatura</summary>
          <form action={recordSubscriptionPayment} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="companyId" value={companyId} />
            <input name="amount" type="number" min="0" step="0.01" required placeholder="Valor" className="rounded-lg border px-3 py-2" />
            <select name="paymentStatus" defaultValue="paid" className="rounded-lg border px-3 py-2"><option value="paid">Pago</option><option value="pending">Pendente</option><option value="failed">Falhou</option><option value="refunded">Estornado</option><option value="canceled">Cancelado</option></select>
            <input name="paymentMethod" placeholder="Forma de pagamento" className="rounded-lg border px-3 py-2" />
            <input name="providerReference" placeholder="Referência externa" className="rounded-lg border px-3 py-2" />
            <label className="text-xs">Vencimento<input name="dueAt" type="date" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
            <label className="text-xs">Pagamento<input name="paidAt" type="date" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
            <input name="notes" maxLength={500} placeholder="Observação" className="rounded-lg border px-3 py-2 sm:col-span-2" />
            <button className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white sm:col-span-2">Registrar pagamento da licença</button>
          </form>
          <div className="mt-3 space-y-2">{payments.length ? payments.slice(0, 8).map((payment) => <p key={payment.id} className="rounded-lg bg-slate-50 p-2 text-xs"><b>{money(payment.amount)}</b> • {payment.status} • {payment.payment_method || "não informado"}<br />Vence: {date(payment.due_at)} • Pago: {date(payment.paid_at)}</p>) : <p className="mt-2 text-xs text-slate-500">Nenhum pagamento de assinatura registrado.</p>}</div>
        </details>

        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-bold">Histórico administrativo</summary>
          <div className="mt-2 space-y-2">{auditLogs.length ? auditLogs.slice(0, 10).map((log) => <p key={log.id} className="text-xs"><b>{date(log.occurred_at)}</b> • {log.action}</p>) : <p className="text-xs text-slate-500">Nenhuma alteração registrada.</p>}</div>
        </details>

        <form action={addTrialDays} className="flex gap-2">
          <input type="hidden" name="companyId" value={companyId} />
          <input name="days" type="number" min="1" max="90" defaultValue="3" className="min-w-0 flex-1 rounded-lg border px-3 py-2" />
          <button className="rounded-lg bg-orange-500 px-3 py-2 font-bold text-white">Adicionar dias</button>
        </form>

        <details>
          <summary className="cursor-pointer text-sm font-bold">Liberar ou bloquear módulos</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {modules.map((moduleKey) => {
              const override = overrides.find((o) => o.module_key === moduleKey);
              return (
                <form action={setModuleOverride} key={moduleKey} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                  <input type="hidden" name="companyId" value={companyId} />
                  <input type="hidden" name="moduleKey" value={moduleKey} />
                  <span>{moduleKey}{override ? ` (${override.enabled ? "livre" : "bloqueado"})` : ""}</span>
                  <div className="flex gap-1">
                    <button name="enabled" value="true" title="Liberar" className="rounded bg-emerald-100 p-1 text-emerald-800"><ShieldCheck size={15} /></button>
                    <button name="enabled" value="false" title="Bloquear" className="rounded bg-red-100 p-1 text-red-800">×</button>
                  </div>
                </form>
              );
            })}
          </div>
        </details>

        <details className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <summary className="cursor-pointer text-sm font-bold text-amber-800">Arquivar empresa</summary>
          <p className="mt-2 text-xs text-amber-800">A empresa sai da lista ativa e a assinatura é cancelada, mas o histórico permanece preservado.</p>
          <form action={archiveCompany} className="mt-3 space-y-2">
            <input type="hidden" name="companyId" value={companyId} />
            <input name="reason" required placeholder="Motivo do arquivamento" className="w-full rounded-lg border px-3 py-2" />
            <button className="w-full rounded-lg bg-amber-600 px-3 py-2 font-bold text-white">Arquivar empresa</button>
          </form>
        </details>
      </div>
    </details>
  );
}
