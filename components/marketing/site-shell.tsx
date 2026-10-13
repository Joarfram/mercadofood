import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";

export function MarketingHeader() {
  return <header className="border-b border-white/10 bg-[#063a2c] text-white">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
      <Link href="/" className="flex items-center gap-2.5" aria-label="MercadoFood, início"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime-300 shadow-sm"><BrandMark size={38}/></span><strong className="text-xl tracking-tight">Mercado<span className="text-emerald-300">Food</span></strong></Link>
      <nav className="hidden items-center gap-6 text-sm font-bold text-emerald-50 lg:flex"><Link href="/recursos" className="transition hover:text-amber-300">Recursos</Link><Link href="/gestao-delivery-simples" className="transition hover:text-amber-300">Gestão Simples</Link><Link href="/recursos#planos" className="transition hover:text-amber-300">Planos</Link><Link href="/seguranca" className="transition hover:text-amber-300">Segurança</Link></nav>
      <div className="flex items-center gap-2"><Link href="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-white underline-offset-4 hover:underline">Sou cliente</Link><Link href="/login" className="hidden rounded-xl bg-[#f4a928] px-4 py-2.5 text-sm font-black text-[#10261e] shadow-lg shadow-black/10 hover:bg-[#ffba45] sm:block">Entrar</Link></div>
    </div>
  </header>;
}

export function MarketingFooter() {
  return <footer className="border-t border-slate-200 bg-white px-5 py-10 sm:px-8"><div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-[1.4fr_1fr_1fr]"><div><div className="flex items-center gap-2"><BrandMark size={32}/><strong className="text-lg">Mercado<span className="text-emerald-700">Food</span></strong></div><p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">Tecnologia para organizar cardápio, pedidos, pagamentos e entregas de negócios de alimentação.</p></div><div><strong className="text-sm">Plataforma</strong><div className="mt-3 grid gap-2 text-sm text-slate-600"><Link href="/recursos">Recursos</Link><Link href="/gestao-delivery-simples">Gestão Delivery Simples</Link><Link href="/sobre">Como funciona</Link></div></div><div><strong className="text-sm">Acesso e informações</strong><div className="mt-3 grid gap-2 text-sm text-slate-600"><Link href="/login">Sou cliente</Link><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link></div></div></div><p className="mx-auto mt-10 max-w-7xl text-xs text-slate-500">© {new Date().getFullYear()} MercadoFood. Venda mais. Gerencie melhor.</p></footer>;
}

export function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <section className="bg-[#f8faf7] px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-4xl text-center"><p className="text-sm font-black uppercase tracking-[.16em] text-emerald-700">{eyebrow}</p><h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h1><p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{text}</p></div></section>; }

export function CallToAction() { return <section className="px-5 py-16 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-3xl bg-[#093d2d] p-8 text-white sm:flex-row sm:items-center sm:p-10"><div><p className="text-sm font-bold uppercase tracking-wider text-emerald-200">MercadoFood</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Organize a operação da sua loja.</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-50/85">Conheça a plataforma ou, se você já é cliente, acesse seu painel com segurança.</p></div><div className="flex flex-wrap gap-3"><Link href="/login" className="rounded-xl border border-white/30 px-5 py-3 font-bold">Sou cliente</Link><Link href="/cadastro" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950">Conhecer a plataforma <ArrowRight size={17}/></Link></div></div></section>; }

