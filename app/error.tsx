"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

const chunkErrorPattern = /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i;

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError = chunkErrorPattern.test(`${error.name} ${error.message}`);

  useEffect(() => {
    if (!isChunkError) return;

    const reloadKey = `mercadofood:chunk-reload:${window.location.pathname}`;
    const lastReload = Number(window.sessionStorage.getItem(reloadKey) || 0);

    // Uma publicação pode invalidar os arquivos carregados por uma aba antiga.
    // Recarregamos uma única vez por janela curta para buscar o build atual sem loop.
    if (Date.now() - lastReload > 30_000) {
      window.sessionStorage.setItem(reloadKey, String(Date.now()));
      window.location.reload();
    }
  }, [isChunkError]);

  function retry() {
    if (isChunkError) {
      window.location.reload();
      return;
    }
    reset();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7faf8] p-5">
      <section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-xl">
        <AlertTriangle className="mx-auto text-orange-500" size={46} />
        <h1 className="mt-4 text-2xl font-bold">Não foi possível carregar esta tela</h1>
        <p className="mt-2 text-gray-600">
          {isChunkError
            ? "O MercadoFood foi atualizado. Recarregue para abrir a versão mais recente."
            : "Se a conexão estiver normal, tente novamente. Seus dados não foram apagados."}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button onClick={retry} className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white">
            Recarregar tela
          </button>
          <Link href="/" className="rounded-xl border px-4 py-3 font-bold">
            Ir para o início
          </Link>
        </div>
      </section>
    </main>
  );
}
