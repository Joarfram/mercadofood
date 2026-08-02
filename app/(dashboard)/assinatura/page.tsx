import { Check, LockKeyhole, Puzzle, Users, Building2 } from "lucide-react";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { isPlanCode, moduleLabels, paidAddons, plans, type PlanCode } from "@/lib/billing/plans";
import type { ModuleKey } from "@/lib/auth/permissions";

const statusLabels: Record<string, string> = { trialing: "Período de avaliação", active: "Ativa", past_due: "Pagamento pendente", suspended: "Suspensa", canceled: "Cancelada" };

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ bloqueado?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  const [{ data: subscription }, { data: addons }] = await Promise.all([
    supabase.from("company_subscriptions").select("status, trial_ends_at, current_period_ends_at, subscription_plans(code)").eq("company_id", company.id).maybeSingle(),
    supabase.from("subscription_addons").select("addon_code, status, quantity").eq("company_id", company.id).eq("status", "active"),
  ]);
  const relatedPlan = Array.isArray(subscription?.subscription_plans) ? subscription?.subscription_plans[0] : subscription?.subscription_plans;
  const currentCode: PlanCode = isPlanCode(relatedPlan?.code) ? relatedPlan.code : "premium";
  const current = plans[currentCode];

  return <main className="space-y-7">
    <header><p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Planos e módulos</p><h1 className="text-3xl font-black">Assinatura da {company.name}</h1><p className="mt-1 text-gray-500">Veja o que está liberado hoje e compare os benefícios de cada plano.</p></header>
    {query.bloqueado && <div className="flex gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-900"><LockKeyhole className="shrink-0"/><div><p className="font-bold">Este recurso não faz parte do seu plano atual.</p><p className="text-sm">Compare os planos abaixo ou contrate o módulo adicional quando ele estiver disponível.</p></div></div>}

    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-gray-500">Plano atual</p><p className="mt-1 text-2xl font-black text-emerald-700">{current.name}</p><p className="text-sm">{statusLabels[subscription?.status || "active"] || subscription?.status}</p></div>
      <div className="rounded-2xl border bg-white p-5"><Users className="text-orange-500"/><p className="mt-2 text-sm text-gray-500">Usuários incluídos</p><p className="text-2xl font-black">Até {current.userLimit}</p></div>
      <div className="rounded-2xl border bg-white p-5"><Building2 className="text-orange-500"/><p className="mt-2 text-sm text-gray-500">Unidades incluídas</p><p className="text-2xl font-black">Até {current.branchLimit}</p></div>
    </section>

    <section className="grid gap-5 xl:grid-cols-3">{Object.values(plans).map(plan => <article key={plan.code} className={`relative rounded-3xl border bg-white p-6 shadow-sm ${plan.code === currentCode ? "border-emerald-600 ring-2 ring-emerald-100" : ""}`}>
      {plan.code === currentCode && <span className="absolute right-5 top-5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Seu plano</span>}
      <p className="text-sm font-bold uppercase tracking-wider text-orange-500">{plan.promise}</p><h2 className="mt-1 text-2xl font-black">{plan.name}</h2><p className="mt-2 min-h-12 text-sm text-gray-500">{plan.description}</p>
      <div className="mt-5 space-y-3">{plan.highlights.map(item => <p key={item} className="flex gap-2 text-sm"><Check className="shrink-0 text-emerald-600" size={18}/>{item}</p>)}</div>
      <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm"><p><strong>{plan.userLimit}</strong> usuários</p><p><strong>{plan.branchLimit}</strong> {plan.branchLimit === 1 ? "unidade" : "unidades"}</p></div>
      <button disabled={plan.code === currentCode} className={`mt-5 w-full rounded-xl py-3 font-bold ${plan.code === currentCode ? "bg-gray-100 text-gray-400" : "bg-emerald-700 text-white hover:bg-orange-500"}`}>{plan.code === currentCode ? "Plano atual" : "Solicitar este plano"}</button>
    </article>)}</section>

    <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Matriz completa de recursos</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b"><th className="p-3">Recurso</th>{Object.values(plans).map(plan => <th key={plan.code} className="p-3 text-center">{plan.name}</th>)}</tr></thead><tbody>{Object.entries(moduleLabels).map(([key,label]) => <tr key={key} className="border-b last:border-0"><td className="p-3 font-semibold">{label}</td>{Object.values(plans).map(plan => <td key={plan.code} className="p-3 text-center">{plan.modules.includes(key as ModuleKey) ? <Check className="mx-auto text-emerald-600" size={19}/> : <span className="text-gray-300">—</span>}</td>)}</tr>)}</tbody></table></div></section>

    <section><div className="flex items-center gap-2"><Puzzle className="text-orange-500"/><h2 className="text-xl font-black">Módulos adicionais</h2></div><p className="mt-1 text-sm text-gray-500">Recursos contratados separadamente, sem obrigar a mudança de plano.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{paidAddons.map(addon => { const active = addons?.some(item => item.addon_code === addon.code); return <article key={addon.code} className="rounded-2xl border bg-white p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-bold">{addon.name}</h3><span className={`rounded-full px-2 py-1 text-xs font-bold ${active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{active ? "Contratado" : "Opcional"}</span></div><p className="mt-2 text-sm text-gray-500">{addon.description}</p></article>; })}</div></section>
  </main>;
}
