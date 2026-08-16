import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { confirmPasswordRecovery } from "./actions";

export default async function ConfirmRecoveryPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: tokenHash = "" } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#f7faf8] p-5"><section className="w-full max-w-md rounded-3xl border bg-white p-7 text-center shadow-xl"><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl shadow"><BrandMark size={66}/></div><h1 className="mt-4 text-2xl font-bold">Redefinir senha</h1><p className="mt-2 text-sm text-gray-500">Confirme para abrir a tela segura de criação da nova senha.</p>{tokenHash ? <form action={confirmPasswordRecovery} className="mt-6"><input type="hidden" name="token_hash" value={tokenHash}/><button className="w-full rounded-xl bg-emerald-700 py-3 font-bold text-white">Continuar redefinição</button></form> : <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">Link inválido ou incompleto.</p>}<Link href="/recuperar-senha" className="mt-5 block text-sm font-semibold text-emerald-700">Solicitar outro link</Link></section></main>;
}
