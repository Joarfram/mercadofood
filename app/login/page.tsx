import Link from "next/link";
import { login } from "./actions";
import { BrandMark } from "@/components/brand/brand-mark";
import { PasswordInput } from "@/components/auth/password-input";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.erro === "string" ? params.erro : "";
  const success = typeof params.sucesso === "string" ? params.sucesso : "";
  const next = typeof params.next === "string" ? params.next : "/dashboard";

  return <main className="min-h-screen bg-[#f7faf8] p-6 flex items-center justify-center">
    <section className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-7 shadow-xl">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-white shadow-lg ring-1 ring-emerald-100"><BrandMark size={68}/></div>
      <h1 className="mt-4 text-center text-2xl font-bold">Entrar no Mercado<span className="text-orange-500">Food</span></h1>
      <p className="mt-1 text-center text-sm text-gray-500">Acesse o painel da sua empresa.</p>
      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
      <form action={login} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next}/>
        <label className="block text-sm font-semibold">E-mail<input required name="email" type="email" className="mt-1 w-full rounded-xl border px-4 py-3 font-normal outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <label className="block text-sm font-semibold">Senha<PasswordInput required name="password" minLength={6} autoComplete="current-password" className="w-full rounded-xl border px-4 py-3 font-normal outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <div className="text-right"><Link href="/recuperar-senha" className="text-sm font-semibold text-emerald-700 hover:text-orange-500">Esqueci minha senha</Link></div>
        <button className="w-full rounded-xl bg-emerald-700 py-3 font-bold text-white transition hover:bg-orange-500">Entrar</button>
      </form>
      <p className="mt-5 text-center text-sm text-gray-600">Ainda não tem conta? <Link href="/cadastro" className="font-bold text-emerald-700">Criar empresa</Link></p>
      <p className="mt-3 text-center text-xs text-gray-500"><Link href="/termos" className="underline">Termos de uso</Link> · <Link href="/privacidade" className="underline">Privacidade</Link></p>
    </section>
  </main>;
}
