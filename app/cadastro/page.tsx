import Link from "next/link";
import { signup } from "./actions";
import { BrandMark } from "@/components/brand/brand-mark";

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.erro === "string" ? params.erro : "";
  return <main className="min-h-screen bg-[#f7faf8] p-6 flex items-center justify-center">
    <section className="w-full max-w-lg rounded-3xl border border-emerald-100 bg-white p-7 shadow-xl">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-white shadow-lg ring-1 ring-emerald-100"><BrandMark size={68}/></div>
      <h1 className="mt-4 text-center text-2xl font-bold">Cadastrar sua empresa</h1>
      <p className="mt-1 text-center text-sm text-gray-500">Primeira etapa do ambiente real do MercadoFood.</p>
      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <form action={signup} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold">Nome da empresa<input required name="companyName" className="mt-1 w-full rounded-xl border px-4 py-3 font-normal outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <label className="block text-sm font-semibold">E-mail do proprietário<input required name="email" type="email" className="mt-1 w-full rounded-xl border px-4 py-3 font-normal outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <label className="block text-sm font-semibold">Senha<input required name="password" type="password" minLength={6} className="mt-1 w-full rounded-xl border px-4 py-3 font-normal outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label>
        <button className="w-full rounded-xl bg-emerald-700 py-3 font-bold text-white transition hover:bg-orange-500">Criar empresa</button>
      </form>
      <p className="mt-5 text-center text-sm text-gray-600">Já possui conta? <Link href="/login" className="font-bold text-emerald-700">Entrar</Link></p>
    </section>
  </main>;
}
