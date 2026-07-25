import { Card } from "@/components/ui/card";

const orders = [
  { id: "#1042", customer: "Mariana", status: "Em preparo", total: "R$ 42,90" },
  { id: "#1041", customer: "Carlos", status: "Novo", total: "R$ 28,00" },
  { id: "#1040", customer: "Aline", status: "Pronto", total: "R$ 63,50" }
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-gray-500">Empório Chagas</p>
          <h1 className="text-3xl font-bold">Boa tarde, Joaz 👋</h1>
        </div>
        <span className="inline-flex w-fit rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
          Loja aberta
        </span>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Pedidos hoje" value="42" detail="+18% em relação a ontem" />
        <Card title="Faturamento" value="R$ 2.350" detail="72% da meta diária" />
        <Card title="Ticket médio" value="R$ 46,80" detail="Acima da média semanal" />
        <Card title="Em produção" value="5" detail="1 pedido próximo do atraso" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Vendas dos últimos 7 dias</h2>
            <span className="text-sm text-gray-500">Demonstração</span>
          </div>
          <div className="mt-6 h-56 rounded-xl bg-gradient-to-b from-green-50 to-white border border-dashed border-green-200 flex items-center justify-center text-gray-500">
            Gráfico será conectado aos dados reais
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Mercadinho</h2>
          <div className="mt-4 rounded-xl bg-mercado-soft p-4">
            <p className="font-semibold text-mercado-green">Sugestão do dia</p>
            <p className="mt-2 text-sm text-gray-700">
              Seu movimento costuma aumentar às 19h. Considere destacar um combo antes desse horário.
            </p>
            <button className="mt-4 rounded-lg bg-mercado-orange px-4 py-2 text-sm font-semibold text-white">
              Criar promoção
            </button>
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-lg font-bold">Pedidos recentes</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead className="text-sm text-gray-500">
              <tr>
                <th className="pb-3">Pedido</th>
                <th className="pb-3">Cliente</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-gray-100">
                  <td className="py-4 font-semibold">{order.id}</td>
                  <td className="py-4">{order.customer}</td>
                  <td className="py-4">{order.status}</td>
                  <td className="py-4 text-right font-semibold">{order.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
