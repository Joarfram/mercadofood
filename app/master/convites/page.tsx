import { requirePlatformStaff } from "@/lib/master/auth";
import { plans } from "@/lib/billing/plans";
import { cancelPlanInvite, createPlanInvite } from "./actions";
import { ShareButtons } from "./share-buttons";

function maskDocument(type?: string | null, value?: string | null) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "—";
  if (type === "CNPJ" && digits.length === 14) return `**.***.***/****-${digits.slice(-2)}`;
  if (type === "CPF" && digits.length === 11) return `***.***.***-${digits.slice(-2)}`;
  return `••••${digits.slice(-4)}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { admin } = await requirePlatformStaff("master");
  const q = await searchParams;
  const link = typeof q.convite === "string" ? q.convite : "";
  const email = typeof q.email === "string" ? q.email : "";
  const whatsapp = typeof q.whatsapp === "string" ? q.whatsapp : "";
  const delivery = typeof q.envio === "string" ? q.envio : "";
  const error = typeof q.erro === "string" ? q.erro : "";

  const { data: invites } = await admin
    .from("platform_plan_invites")
    .select(
      "id,email,company_name,legal_name,unit_name,responsible_name,whatsapp,document_type,document_number,status,expires_at,accepted_at,token,subscription_plans(name,code)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <header>
        <p className="font-semibold text-emerald-700">Administrador do sistema</p>
        <h1 className="text-3xl font-black">Convites de novos clientes</h1>
        <p className="text-gray-500">Área exclusiva do MercadoFood para liberar o plano contratado.</p>
      </header>

      {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}

      {link && (
        <div className="rounded-xl bg-emerald-50 p-4">
          <b>Convite criado</b>
          <p className="mt-1 break-all text-sm">{link}</p>
          {delivery && <p className="mt-2 text-sm font-semibold text-emerald-800">{delivery}</p>}
          <ShareButtons link={link} email={email} whatsapp={whatsapp} />
        </div>
      )}

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold">Cadastrar e convidar cliente</h2>
        <form action={createPlanInvite} className="mt-4 grid gap-3 md:grid-cols-2">
          <input required name="companyName" placeholder="Nome fantasia da empresa" className="rounded-xl border px-4 py-3" />
          <input name="unitName" placeholder="Unidade (opcional): Centro, Jardins..." className="rounded-xl border px-4 py-3" />
          <input name="legalName" placeholder="Razão social (opcional)" className="rounded-xl border px-4 py-3 md:col-span-2" />
          <select required name="documentType" defaultValue="" className="rounded-xl border px-4 py-3">
            <option value="" disabled>Tipo de documento</option>
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
          <input required name="documentNumber" inputMode="numeric" placeholder="CPF/CNPJ, somente números" className="rounded-xl border px-4 py-3" />
          <input required name="responsibleName" placeholder="Nome do responsável" className="rounded-xl border px-4 py-3" />
          <input required type="email" name="email" placeholder="E-mail do cliente" className="rounded-xl border px-4 py-3" />
          <input required name="whatsapp" placeholder="WhatsApp com DDD e país" className="rounded-xl border px-4 py-3" />
          <select name="plan" className="rounded-xl border px-4 py-3">
            {Object.values(plans).map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {p.description}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white md:col-span-2">
            Gerar e enviar convite
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Histórico</h2>
        {(invites || []).map((i) => {
          const p = Array.isArray(i.subscription_plans) ? i.subscription_plans[0] : i.subscription_plans;
          const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/convite-plano/${i.token}`;
          return (
            <article key={i.id} className="flex flex-wrap justify-between gap-3 rounded-2xl border bg-white p-4">
              <div>
                <b>
                  {i.company_name}
                  {i.unit_name ? ` — ${i.unit_name}` : ""}
                </b>
                {i.legal_name && <p className="text-xs text-slate-500">{i.legal_name}</p>}
                <p className="text-sm text-gray-600">
                  {i.email} • {(p as { name?: string } | null)?.name} • {i.status}
                </p>
                <p className="text-xs text-slate-500">
                  {i.document_type || "Documento"}: {maskDocument(i.document_type, i.document_number)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ShareButtons link={inviteLink} email={i.email} whatsapp={i.whatsapp || ""} />
                {i.status === "pending" && (
                  <form action={cancelPlanInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="mt-3 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">
                      Cancelar
                    </button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
