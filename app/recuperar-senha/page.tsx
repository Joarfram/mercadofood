import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { requestPasswordReset } from "./actions";

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#f7faf8] p-5"><section className="w-full max-w-md rounded-3xl border bg-white p-7 shadow-xl"><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl shadow"><BrandMark size={66}/></div><h1 className="mt-4 text-center text-2xl font-bold">Recuperar senha</h1><p className="mt-2 text-center text-sm text-gray-500">Enviaremos um link seguro para o e-mail cadastrado.</p>{query.erro && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{query.erro}</p>}{query.sucesso ? <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{query.sucesso}</div> : <form action={requestPasswordReset} className="mt-6 space-y-4"><label className="block text-sm font-semibold">E-mail<input name="email" type="email" required className="mt-1 w-full rounded-xl border px-4 py-3 font-normal"/></label><button className="w-full rounded-xl bg-emerald-700 py-3 font-bold text-white hover:bg-orange-500">Enviar link</button></form>}<Link href="/login" className="mt-5 block text-center text-sm font-semibold text-emerald-700">Voltar ao login</Link></section></main>;
}
