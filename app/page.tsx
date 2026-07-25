import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="max-w-xl w-full bg-white rounded-card shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-mercado-green text-white flex items-center justify-center text-2xl font-bold">
          MF
        </div>
        <h1 className="text-3xl font-bold text-mercado-ink">MercadoFood</h1>
        <p className="mt-2 text-gray-600">Venda mais. Gerencie melhor.</p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link href="/login" className="rounded-xl bg-mercado-green px-5 py-3 text-white font-semibold">
            Entrar
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-gray-300 px-5 py-3 font-semibold">
            Ver demonstração
          </Link>
        </div>
      </section>
    </main>
  );
}
