import Link from "next/link";
import { Building2, KeyRound, Truck, Store, QrCode } from "lucide-react";
import { getCurrentCompany } from "@/lib/auth/current-company";

export default async function Page() {
  const { company } = await getCurrentCompany();
  const cards = [
    { href: "/configuracoes/cardapio", title: "Cardápio e QR Code", description: "Aparência, banner, horários, bairros, taxas e link público.", icon: QrCode },
    { href: "/configuracoes/pix", title: "PIX", description: "Chave, recebedor e cidade para gerar cobranças.", icon: KeyRound },
    { href: "/configuracoes/cardapio", title: "Dados da empresa", description: "Nome, endereço, WhatsApp e identidade visual.", icon: Building2 },
    { href: "/configuracoes/cardapio", title: "Entrega", description: "Taxas, bairros, pedido mínimo e previsão.", icon: Truck },
    { href: `/cardapio/${company.slug}`, title: "Visualizar cardápio", description: "Abra o cardápio público que seus clientes verão.", icon: Store },
  ];

  return <main className="space-y-6"><header><h1 className="text-3xl font-bold">Configurações</h1><p className="mt-2 text-gray-600">Dados da empresa, cardápio, pagamentos e entrega.</p></header><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map(({ href,title,description,icon:Icon }) => <Link href={href} key={title} className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5"><Icon className="text-emerald-700"/><h2 className="mt-4 text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-gray-500">{description}</p></Link>)}</section></main>;
}
