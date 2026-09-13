import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";
import { updateCustomer } from "../../actions";

export default async function EditarClientePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{erro?:string;sucesso?:string}>}){
  const [{id},query]=await Promise.all([params,searchParams]);
  const {supabase,company}=await requirePlanModule("customers");
  const [{data:customer},{data:address}]=await Promise.all([
    supabase.from("customers").select("id,name,phone,email,birth_date,notes,marketing_consent").eq("id",id).eq("company_id",company.id).maybeSingle(),
    supabase.from("customer_addresses").select("cep,street,number,complement,neighborhood,city,reference").eq("customer_id",id).eq("company_id",company.id).eq("is_default",true).maybeSingle(),
  ]);
  if(!customer)notFound();
  return <main className="mx-auto max-w-3xl space-y-6">
    <header><p className="text-sm font-semibold text-emerald-700">Clientes</p><h1 className="text-3xl font-bold">Editar cadastro</h1><p className="text-gray-500">Estas alterações mudam o cadastro permanente do cliente. Alterações feitas dentro de um pedido valem somente para aquela entrega.</p></header>
    {query.erro&&<div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div>}
    {query.sucesso&&<div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{query.sucesso}</div>}
    <form action={updateCustomer} className="rounded-2xl border bg-white p-6 shadow-sm">
      <input type="hidden" name="customerId" value={customer.id}/>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">Nome<input name="name" required defaultValue={customer.name} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold">Telefone/WhatsApp<input name="phone" required defaultValue={customer.phone} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold">E-mail<input name="email" type="email" defaultValue={customer.email||""} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold">Nascimento<input name="birthDate" type="date" defaultValue={customer.birth_date||""} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold">CEP<input name="cep" defaultValue={address?.cep||""} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold sm:col-span-2">Rua/avenida<input name="street" defaultValue={address?.street||""} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold">Número<input name="number" defaultValue={address?.number||""} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold">Complemento<input name="complement" defaultValue={address?.complement||""} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold">Bairro<input name="neighborhood" defaultValue={address?.neighborhood||""} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold">Cidade<input name="city" defaultValue={address?.city||""} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold sm:col-span-2">Referência<input name="reference" defaultValue={address?.reference||""} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
        <label className="text-sm font-semibold sm:col-span-2">Observações<textarea name="notes" rows={3} defaultValue={customer.notes||""} className="mt-1 w-full rounded-xl border px-3 py-3"/></label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm"><input name="marketingConsent" type="checkbox" defaultChecked={Boolean(customer.marketing_consent)}/> Cliente autorizou receber promoções</label>
      <div className="mt-6 flex flex-wrap gap-3"><button className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white">Salvar cadastro</button><Link href="/clientes" className="rounded-xl border px-5 py-3 font-semibold">Voltar para clientes</Link></div>
    </form>
  </main>;
}
