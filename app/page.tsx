import Link from "next/link";
import { ArrowRight, Bike, ClipboardList, CreditCard, LockKeyhole, MenuSquare, Store } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/site-shell";
import { HeroDevicePreview } from "@/components/marketing/hero-device-preview";

const features = [
  { icon: MenuSquare, title: "Cardápio digital", text: "Crie e atualize seu cardápio com fotos, descrições e complementos." },
  { icon: ClipboardList, title: "Pedidos", text: "Receba, organize e acompanhe os pedidos em tempo real." },
  { icon: Bike, title: "Entrega", text: "Acompanhe suas entregas e mantenha os clientes informados." },
  { icon: CreditCard, title: "Pagamentos", text: "Aceite diversas formas de pagamento e registre tudo com segurança." },
];

export default function HomePage() {
  return <main className="min-h-screen overflow-hidden bg-[#fffdf8] text-[#062b21]">
    <MarketingHeader />
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_55%_5%,#f9eed7_0,transparent_32%),linear-gradient(112deg,#fffdf8_0%,#fff8e9_58%,#edf0df_100%)] px-5 pb-14 pt-12 sm:px-8 lg:pb-20 lg:pt-16">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
        <div className="relative z-10 max-w-xl"><p className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/75 px-3 py-1.5 text-sm font-bold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Tecnologia para negócios de alimentação</p><h1 className="mt-7 text-5xl font-black leading-[.97] tracking-[-.055em] text-[#052e23] sm:text-6xl lg:text-7xl">Venda mais.<br />Gerencie melhor.</h1><div className="mt-4 h-1 w-48 rounded-full bg-amber-400 sm:w-64" /><p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600 sm:text-xl">O sistema completo para o seu delivery. Gerencie cardápio, pedidos, pagamentos e entregas em um só lugar.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/recursos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f4a928] px-6 py-4 font-black text-[#10261e] shadow-lg shadow-amber-500/15 transition hover:bg-[#ffba45]">Conhecer o MercadoFood <ArrowRight size={19} /></Link><Link href="/login" className="inline-flex items-center justify-center rounded-xl border-2 border-[#0a3c2e] bg-white/75 px-6 py-4 font-black text-[#0a3c2e] transition hover:bg-white">Sou cliente</Link></div></div>
        <HeroDevicePreview />
      </div>
    </section>
    <section className="bg-[#fbf7ef] px-5 py-14 sm:px-8 lg:py-16"><div className="mx-auto max-w-7xl"><h2 className="text-center text-3xl font-black tracking-[-.04em] text-[#062b21] sm:text-4xl">Tudo para sua operação</h2><div className="mx-auto mt-3 h-1 w-20 rounded-full bg-amber-400" /><div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{features.map(({ icon: Icon, title, text }) => <Link key={title} href="/recursos" className="group flex items-center gap-4 rounded-2xl border border-emerald-950/5 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#fff5dc] text-emerald-800"><Icon size={28} strokeWidth={2.1} /></span><span><span className="block text-lg font-black text-[#082e23]">{title}</span><span className="mt-1 block text-sm leading-relaxed text-slate-600">{text}</span></span><ArrowRight className="ml-auto shrink-0 text-emerald-800 transition group-hover:translate-x-1" size={18} /></Link>)}</div></div></section>
    <section className="px-5 py-14 sm:px-8 lg:py-18"><div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2"><article className="flex gap-5 border-b border-slate-200 pb-8 md:border-b-0 md:border-r md:pr-8 md:pb-0"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><LockKeyhole size={31} /></span><div><h2 className="text-2xl font-black text-[#062b21]">Dados protegidos</h2><p className="mt-2 leading-relaxed text-slate-600">Seu painel fica protegido por login e senha. Dados da operação e dos clientes continuam administrados pela estrutura central do MercadoFood.</p></div></article><article className="flex gap-5"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-amber-50 text-emerald-800"><Store size={32} /></span><div><h2 className="text-2xl font-black text-[#062b21]">Feito para negócios de alimentação</h2><p className="mt-2 leading-relaxed text-slate-600">Cardápio, pedidos, cozinha, entrega e pagamentos reunidos na rotina da sua loja.</p></div></article></div></section>
    <section className="bg-[#073b2d] px-5 py-14 text-white sm:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-7 lg:flex-row lg:items-center"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-emerald-200">Gestão Delivery Simples</p><h2 className="mt-2 text-3xl font-black tracking-tight">Comece simples. Evolua quando precisar.</h2><p className="mt-3 max-w-2xl text-emerald-50/85">A operação simples faz parte do MercadoFood e pode migrar para a gestão completa sem perder os dados da loja.</p></div><Link href="/gestao-delivery-simples" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f4a928] px-6 py-4 font-black text-[#10261e] transition hover:bg-[#ffba45]">Conhecer a gestão simples <ArrowRight size={18} /></Link></div></section>
    <MarketingFooter />
  </main>;
}


