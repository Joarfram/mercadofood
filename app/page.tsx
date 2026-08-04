import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="max-w-xl w-full bg-white rounded-card shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-white shadow-lg ring-1 ring-emerald-100"><BrandMark size={68}/></div>
        <h1 className="text-3xl font-bold text-mercado-ink">MercadoFood</h1>
        <p className="mt-2 text-gray-600">Venda mais. Gerencie melhor.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/login" className="rounded-xl bg-mercado-green px-5 py-3 text-white font-semibold">
            Entrar
          </Link>
          <Link href="/demonstracao" className="rounded-xl border border-gray-300 px-5 py-3 font-semibold">
            Ver demonstração
          </Link>
        </div>
        <Link href="/entregador/login" className="mt-3 block w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white">
          Sou entregador
        </Link>
      </section>
    </main>
  );
}
