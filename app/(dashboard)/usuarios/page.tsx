import { getCurrentCompany } from "@/lib/auth/current-company";
import { roleLabels, type CompanyRole } from "@/lib/auth/permissions";
import { cancelInvite, createInvite, updateMember } from "./actions";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, company, role } = await getCurrentCompany();
  if (!(["owner", "manager"] as string[]).includes(role)) return <div className="rounded-2xl border bg-white p-6">Você não tem permissão para gerenciar usuários.</div>;
  const params = await searchParams;
  const error = typeof params.erro === "string" ? params.erro : "";
  const invite = typeof params.convite === "string" ? params.convite : "";

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("company_members").select("id, display_name, phone, role, is_active, created_at").eq("company_id", company.id).order("created_at"),
    supabase.from("company_invites").select("id, email, role, token, expires_at, accepted_at").eq("company_id", company.id).is("accepted_at", null).order("created_at", { ascending: false })
  ]);

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Usuários e permissões</h1><p className="text-gray-500">Convide sua equipe e controle o que cada pessoa pode acessar.</p></div>
    {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
    {invite && <div className="rounded-xl bg-emerald-50 p-4"><p className="font-semibold text-emerald-800">Convite criado</p><p className="mt-1 break-all text-sm">{invite}</p><p className="mt-2 text-xs text-gray-600">Copie e envie este link pelo WhatsApp ou e-mail.</p></div>}

    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-bold">Convidar colaborador</h2>
      <form action={createInvite} className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
        <input required type="email" name="email" placeholder="E-mail do colaborador" className="rounded-xl border px-4 py-3"/>
        <select name="role" className="rounded-xl border px-4 py-3">
          {Object.entries(roleLabels).filter(([key]) => key !== "owner" && (role === "owner" || key !== "manager")).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <button className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Gerar convite</button>
      </form>
    </section>

    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-bold">Equipe ativa</h2>
      <div className="mt-4 space-y-3">
        {(members || []).length === 0 && <p className="text-sm text-gray-500">Nenhum colaborador aceitou convite ainda.</p>}
        {(members || []).map((member) => <form key={member.id} action={updateMember} className="grid items-center gap-3 rounded-xl border p-4 md:grid-cols-[1fr_220px_140px_auto]">
          <input type="hidden" name="memberId" value={member.id}/>
          <div><p className="font-semibold">{member.display_name || "Colaborador"}</p><p className="text-xs text-gray-500">{member.phone || "Telefone não informado"}</p></div>
          <select name="role" defaultValue={member.role} className="rounded-xl border px-3 py-2">
            {Object.entries(roleLabels).filter(([key]) => key !== "owner" && (role === "owner" || key !== "manager")).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select name="isActive" defaultValue={String(member.is_active)} className="rounded-xl border px-3 py-2"><option value="true">Ativo</option><option value="false">Bloqueado</option></select>
          <button className="rounded-xl border px-4 py-2 font-semibold">Salvar</button>
        </form>)}
      </div>
    </section>

    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-bold">Convites pendentes</h2>
      <div className="mt-4 space-y-3">
        {(invites || []).length === 0 && <p className="text-sm text-gray-500">Nenhum convite pendente.</p>}
        {(invites || []).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div><p className="font-semibold">{item.email}</p><p className="text-xs text-gray-500">{roleLabels[item.role as CompanyRole]} • válido até {new Date(item.expires_at).toLocaleDateString("pt-BR")}</p></div>
          <form action={cancelInvite}><input type="hidden" name="inviteId" value={item.id}/><button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Cancelar</button></form>
        </div>)}
      </div>
    </section>
  </div>;
}
