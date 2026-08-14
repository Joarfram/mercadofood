import Link from "next/link";
import { driverSignIn } from "../actions";
import { InstallDriverApp } from "@/components/delivery/install-driver-app";
import { PasswordInput } from "@/components/auth/password-input";

export default async function DriverLogin({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const q = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
    <div className="w-full max-w-md rounded-3xl bg-slate-900 p-7 shadow-2xl">
      <div className="flex items-center gap-3"><img src="/mercadofood-entrega-icon.svg" alt="MercadoFood Entrega" className="h-16 w-16 rounded-2xl"/><div><p className="text-sm font-semibold text-emerald-400">MercadoFood Entrega</p><h1 className="text-2xl font-bold">Acesso do motoboy</h1></div></div>
      {q.erro && <p className="mt-5 rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{q.erro}</p>}
      {q.sucesso && <p className="mt-5 rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-200">{q.sucesso}</p>}
      <form action={driverSignIn} className="mt-6 space-y-4">
        <div><label className="text-sm font-semibold">E-mail cadastrado pela loja</label><input name="email" type="email" required className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3" /></div>
        <div><label className="text-sm font-semibold">Senha</label><PasswordInput name="password" required autoComplete="current-password" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3" /></div>
        <button className="w-full rounded-xl bg-emerald-600 py-3 font-bold">Entrar no aplicativo</button>
      </form>
      <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
        <p className="text-sm text-slate-300">Primeiro acesso neste celular?</p>
        <Link href="/entregador/cadastro" className="mt-3 block w-full rounded-xl border border-emerald-500 py-3 font-bold text-emerald-300">Criar meu acesso</Link>
        <p className="mt-2 text-xs text-slate-500">Use o mesmo e-mail cadastrado pela loja.</p>
      </div>
      <div className="mt-5"><InstallDriverApp/></div>
    </div>
  </main>;
}
