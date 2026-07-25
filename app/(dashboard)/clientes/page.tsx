import { getCurrentCompany } from "@/lib/auth/current-company";
import { adjustCustomerPoints, createCustomer, saveLoyaltySettings } from "./actions";

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string; busca?: string }> }) {
  const query = await searchParams;
  const { supabase, company } = await getCurrentCompany();
  let customersQuery = supabase.from("customers").select("*").eq("company_id", company.id).eq("is_active", true).order("last_order_at", { ascending: false, nullsFirst: false });
  if (query.busca) customersQuery = customersQuery.or(`name.ilike.%${query.busca}%,phone.ilike.%${query.busca}%`);
  const [{ data: customers }, { data: settings }, { data: movements }, { data: orders }] = await Promise.all([
    customersQuery.limit(100),
    supabase.from("loyalty_settings").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("loyalty_movements").select("id,points,balance_after,description,created_at,movement_type,customer:customers(name)").eq("company_id", company.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("orders").select("id,customer_id,total,status,created_at,order_number").eq("company_id", company.id).not("customer_id", "is", null).order("created_at", { ascending: false }).limit(100),
  ]);

  const list = customers || [];
  const totalSpent = list.reduce((sum, c) => sum + Number(c.total_spent || 0), 0);
  const totalPoints = list.reduce((sum, c) => sum + Number(c.loyalty_points || 0), 0);
  const active30 = list.filter(c => c.last_order_at && Date.now() - new Date(c.last_order_at).getTime() <= 30 * 86400000).length;

  return <main className="space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">Relacionamento</p><h1 className="text-3xl font-bold">Clientes e fidelidade</h1><p className="text-gray-500">Histórico de compras, pontos e relacionamento com seus clientes.</p></header>
    {query.erro && <div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso && <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}

    <section className="grid gap-4 md:grid-cols-4">
      <Card label="Clientes" value={String(list.length)} note="Cadastros ativos" />
      <Card label="Ativos em 30 dias" value={String(active30)} note="Compraram recentemente" />
      <Card label="Faturamento acumulado" value={money(totalSpent)} note="Dos clientes listados" />
      <Card label="Pontos em circulação" value={String(totalPoints)} note="Saldo disponível" />
    </section>

    <section className="grid gap-6 xl:grid-cols-3">
      <form action={createCustomer} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Novo cliente</h2>
        <label className="mt-4 block text-sm font-semibold">Nome</label><input name="name" required className="mt-1 w-full rounded-xl border px-3 py-3" />
        <label className="mt-3 block text-sm font-semibold">Telefone/WhatsApp</label><input name="phone" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="79999999999" />
        <label className="mt-3 block text-sm font-semibold">E-mail</label><input name="email" type="email" className="mt-1 w-full rounded-xl border px-3 py-3" />
        <label className="mt-3 block text-sm font-semibold">Nascimento</label><input name="birthDate" type="date" className="mt-1 w-full rounded-xl border px-3 py-3" />
        <label className="mt-3 block text-sm font-semibold">Observações</label><textarea name="notes" className="mt-1 w-full rounded-xl border px-3 py-3" rows={2} />
        <label className="mt-3 flex items-center gap-2 text-sm"><input name="marketingConsent" type="checkbox" /> Cliente autorizou receber promoções</label>
        <button className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Cadastrar cliente</button>
      </form>

      <form action={saveLoyaltySettings} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Programa de fidelidade</h2>
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input name="isEnabled" type="checkbox" defaultChecked={settings?.is_enabled ?? true} /> Programa ativo</label>
        <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Pontos por R$ 1<input name="pointsPerCurrency" type="number" min="0" step="0.01" defaultValue={settings?.points_per_currency ?? 1} className="mt-1 w-full rounded-xl border px-3 py-3" /></label><label className="text-sm font-semibold">Pedido mínimo<input name="minimumOrderValue" type="number" min="0" step="0.01" defaultValue={settings?.minimum_order_value ?? 0} className="mt-1 w-full rounded-xl border px-3 py-3" /></label></div>
        <label className="mt-3 block text-sm font-semibold">Nome da recompensa</label><input name="rewardName" defaultValue={settings?.reward_name ?? "Desconto fidelidade"} className="mt-1 w-full rounded-xl border px-3 py-3" />
        <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Pontos necessários<input name="rewardPoints" type="number" min="1" defaultValue={settings?.reward_points ?? 100} className="mt-1 w-full rounded-xl border px-3 py-3" /></label><label className="text-sm font-semibold">Valor da recompensa<input name="rewardValue" type="number" min="0" step="0.01" defaultValue={settings?.reward_value ?? 10} className="mt-1 w-full rounded-xl border px-3 py-3" /></label></div>
        <label className="mt-3 block text-sm font-semibold">Validade dos pontos em dias (opcional)</label><input name="pointsExpireDays" type="number" min="1" defaultValue={settings?.points_expire_days ?? ""} className="mt-1 w-full rounded-xl border px-3 py-3" />
        <button className="mt-4 w-full rounded-xl border border-emerald-700 px-4 py-3 font-semibold text-emerald-800">Salvar programa</button>
      </form>

      <form action={adjustCustomerPoints} className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Ajustar pontos</h2><p className="mt-1 text-sm text-gray-500">Use valor positivo para adicionar e negativo para resgatar.</p>
        <label className="mt-4 block text-sm font-semibold">Cliente</label><select name="customerId" required className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Selecione</option>{list.map(c=><option key={c.id} value={c.id}>{c.name} — {c.loyalty_points} pts</option>)}</select>
        <label className="mt-3 block text-sm font-semibold">Pontos</label><input name="points" type="number" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Ex.: 20 ou -100" />
        <label className="mt-3 block text-sm font-semibold">Motivo</label><input name="description" className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Ex.: resgate de desconto" />
        <button className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white">Atualizar pontos</button>
      </form>
    </section>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold">Base de clientes</h2><p className="text-sm text-gray-500">Compras, gasto total e saldo de pontos.</p></div><form className="flex gap-2"><input name="busca" defaultValue={query.busca || ""} className="rounded-xl border px-3 py-2" placeholder="Buscar nome ou telefone" /><button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Buscar</button></form></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Cliente</th><th>Contato</th><th>Pedidos</th><th>Total gasto</th><th>Pontos</th><th>Última compra</th><th>Marketing</th></tr></thead><tbody>{list.map(c=><tr key={c.id} className="border-b last:border-0"><td className="py-3"><strong>{c.name}</strong>{c.notes && <p className="max-w-xs truncate text-xs text-gray-500">{c.notes}</p>}</td><td>{c.phone}<br/><span className="text-xs text-gray-500">{c.email || "—"}</span></td><td>{c.total_orders}</td><td className="font-semibold">{money(c.total_spent)}</td><td><span className="rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-700">{c.loyalty_points} pts</span></td><td>{date(c.last_order_at)}</td><td>{c.marketing_consent ? "Autorizado" : "Não autorizado"}</td></tr>)}</tbody></table>{!list.length && <p className="rounded-xl bg-gray-50 p-6 text-gray-500">Nenhum cliente encontrado.</p>}</div>
    </section>

    <section className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Movimentações de pontos</h2><div className="mt-4 space-y-3">{movements?.map((m:any)=>{const customer=Array.isArray(m.customer)?m.customer[0]:m.customer;return <article key={m.id} className="flex items-center justify-between gap-3 rounded-xl border p-4"><div><strong>{customer?.name}</strong><p className="text-sm text-gray-500">{m.description || m.movement_type} • {new Date(m.created_at).toLocaleString("pt-BR")}</p></div><div className="text-right"><strong className={Number(m.points)>=0?"text-emerald-700":"text-orange-600"}>{Number(m.points)>0?"+":""}{m.points} pts</strong><p className="text-xs text-gray-500">Saldo {m.balance_after}</p></div></article>})}{!movements?.length && <p className="rounded-xl bg-gray-50 p-5 text-gray-500">Sem movimentações de pontos.</p>}</div></div>
      <div className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Últimas compras identificadas</h2><div className="mt-4 space-y-3">{orders?.slice(0,20).map(o=>{const customer=list.find(c=>c.id===o.customer_id);return <article key={o.id} className="flex items-center justify-between rounded-xl border p-4"><div><strong>Pedido #{o.order_number}</strong><p className="text-sm text-gray-500">{customer?.name || "Cliente"} • {date(o.created_at)}</p></div><div className="text-right"><strong>{money(o.total)}</strong><p className="text-xs text-gray-500">{o.status}</p></div></article>})}{!orders?.length && <p className="rounded-xl bg-gray-50 p-5 text-gray-500">Nenhuma compra identificada.</p>}</div></div>
    </section>
  </main>;
}

function Card({label,value,note}:{label:string;value:string;note:string}) { return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{label}</p><strong className="mt-1 block text-2xl text-emerald-700">{value}</strong><p className="mt-1 text-sm text-gray-500">{note}</p></div> }
