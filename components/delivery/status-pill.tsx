type DriverStatus = "available" | "called" | "to_store" | "waiting" | "delivering" | "offline" | "problem";

const labels: Record<DriverStatus, string> = {
  available: "Disponível",
  called: "Chamado",
  to_store: "A caminho da loja",
  waiting: "Aguardando retirada",
  delivering: "Em entrega",
  offline: "Offline",
  problem: "Com problema"
};

const styles: Record<DriverStatus, string> = {
  available: "bg-emerald-100 text-emerald-800",
  called: "bg-amber-100 text-amber-800",
  to_store: "bg-amber-100 text-amber-800",
  waiting: "bg-orange-100 text-orange-800",
  delivering: "bg-orange-100 text-orange-800",
  offline: "bg-gray-100 text-gray-600",
  problem: "bg-red-100 text-red-700"
};

export function StatusPill({ status }: { status: DriverStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

export type { DriverStatus };
