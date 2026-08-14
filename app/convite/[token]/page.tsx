import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { roleLabels, type CompanyRole } from "@/lib/auth/permissions";
import { acceptInvite } from "./actions";
import { PasswordInput } from "@/components/auth/password-input";

export default async function InvitePage({ params, searchParams }: { params: Promise<{token:string}>, searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const { token } = await params;
  const query = await searchParams;
  const error = typeof query.erro === "string" ? query.erro : "";
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_company_invite", { invite_token: token });
  const invite = data?.[0];
  const { data: auth } = await supabase.auth.getUser();

  if (!invite) return <main className="min-h-screen grid place-items-center bg-[#f7faf8] p-6"><div className="max-w-md rounded-3xl border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Convite não encontrado</h1><Link href="/login" className="mt-5 inline-block text-emerald-700">Ir para o login</Link></div></main>;

  return <main className="min-h-screen grid place-items-center bg-[#f7faf8] p-6"><section className="w-full max-w-lg rounded-3xl border bg-white p-7 shadow-sm">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 font-bold text-white">MF</div>
    <h1 className="mt-4 text-center text-2xl font-bold">Convite para {invite.company_name}</h1>
    <p className="mt-2 text-center text-gray-600">Acesso como <strong>{roleLabels[invite.role as CompanyRole] || invite.role}</strong>.</p>
    {!invite.valid && <div className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">Este convite expirou ou já foi utilizado.</div>}
    {error && <div className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
    {invite.valid && <form action={acceptInvite} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token}/>
      <label className="block text-sm font-semibold">Nome<input required name="name" className="mt-1 w-full rounded-xl border px-4 py-3 font-normal"/></label>
      <label className="block text-sm font-semibold">Telefone<input name="phone" className="mt-1 w-full rounded-xl border px-4 py-3 font-normal"/></label>
      <label className="block text-sm font-semibold">E-mail<input required readOnly={Boolean(auth.user)} name="email" type="email" defaultValue={auth.user?.email || invite.email} className="mt-1 w-full rounded-xl border px-4 py-3 font-normal disabled:bg-gray-50"/></label>
      {!auth.user && <label className="block text-sm font-semibold">Crie uma senha<PasswordInput required name="password" minLength={6} autoComplete="new-password" className="w-full rounded-xl border px-4 py-3 font-normal"/></label>}
      <button className="w-full rounded-xl bg-emerald-700 py-3 font-bold text-white">Aceitar convite</button>
    </form>}
  </section></main>;
}
