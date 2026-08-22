import { CustomerTracking } from "@/components/tracking/customer-tracking";

export const dynamic = "force-dynamic";

export default async function TrackingPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-lg">
    <header className="mb-5 text-center"><p className="text-sm font-semibold text-emerald-700">MercadoFood</p><p className="text-xs text-slate-500">Acompanhamento do pedido</p></header>
    <CustomerTracking code={decodeURIComponent(codigo)} />
  </div></main>;
}
