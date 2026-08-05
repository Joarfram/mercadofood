import { redirect } from "next/navigation";

export default async function PagamentosPage({ searchParams }: { searchParams: Promise<{ erro?: string; sucesso?: string }> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  if (query.erro) params.set("erro", query.erro);
  if (query.sucesso) params.set("sucesso", query.sucesso);
  redirect(`/financeiro${params.size ? `?${params.toString()}` : ""}#pagamentos`);
}
