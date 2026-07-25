import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { driverSignUp } from "../actions";

export default async function DriverSignup({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const q = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
    <div className="w-full max-w-md rounded-3xl bg-slate-900 p-7">
      <ShieldCheck className="text-emerald-400" size={38}/><h1 className="mt-3 text-2xl font-bold">Ativar conta do motoboy</h1>
      <p className="mt-2 text-sm text-slate-400">Use exatamente o mesmo e-mail informado pela loja no seu cadastro.</p>
      {q.erro && <p className="mt-5 rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{q.erro}</p>}
      <form action={driverSignUp} className="mt-6 space-y-4">
        <div><label className="text-sm font-semibold">E-mail</label><input name="email" type="email" required className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3" /></div>
        <div><label className="text-sm font-semibold">Crie uma senha</label><input name="password" type="password" minLength={6} required className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3" /></div>
        <button className="w-full rounded-xl bg-emerald-600 py-3 font-bold">Ativar conta</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400"><Link href="/entregador/login" className="text-emerald-400">Voltar ao login</Link></p>
    </div>
  </main>;
}
