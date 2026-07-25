import Link from "next/link";

export default function DemonstracaoPage() {
  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <section className="hidden md:flex bg-mercado-green text-white p-12 flex-col justify-between">
        <div className="text-2xl font-bold">MercadoFood</div>
        <div>
          <h1 className="text-4xl font-bold max-w-md">Venda mais. Gerencie melhor.</h1>
          <p className="mt-4 max-w-md text-green-50">
            Um painel simples e completo para organizar pedidos, cardápio e operação.
          </p>
        </div>
        <p className="text-sm text-green-100">MercadoFood v0.1</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <form className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold">Entrar</h2>
          <p className="mt-2 text-sm text-gray-500">Use seus dados para acessar o painel.</p>

          <label className="mt-6 block text-sm font-medium">E-mail</label>
          <input type="email" placeholder="voce@empresa.com" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-mercado-green" />

          <label className="mt-4 block text-sm font-medium">Senha</label>
          <input type="password" placeholder="••••••••" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-mercado-green" />

          <Link href="/dashboard" className="mt-6 block rounded-xl bg-mercado-green px-4 py-3 text-center font-semibold text-white">
            Entrar na demonstração
          </Link>
        </form>
      </section>
    </main>
  );
}
