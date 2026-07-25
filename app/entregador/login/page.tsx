import Link from "next/link";
import { Bike } from "lucide-react";
import { driverSignIn } from "../actions";

export default async function DriverLogin({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const q = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
    <div className="w-full max-w-md rounded-3xl bg-slate-900 p-7 shadow-2xl">
      <div className="flex items-center gap-3"><span className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-400"><Bike/></span><div><p className="text-sm text-emerald-400">MercadoFood</p><h1 className="text-2xl font-bold">Acesso do entregador</h1></div></div>
      {q.erro && <p className="mt-5 rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{q.erro}</p>}
      {q.sucesso && <p className="mt-5 rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-200">{q.sucesso}</p>}
      <form action={driverSignIn} className="mt-6 space-y-4">
        <div><label className="text-sm font-semibold">E-mail cadastrado pela loja</label><input name="email" type="email" required className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3" /></div>
        <div><label className="text-sm font-semibold">Senha</label><input name="password" type="password" required className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3" /></div>
        <button className="w-full rounded-xl bg-emerald-600 py-3 font-bold">Entrar no aplicativo</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400">Primeiro acesso? <Link href="/entregador/cadastro" className="font-semibold text-emerald-400">Ativar minha conta</Link></p>
    </div>
  </main>;
}
