"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { logout } from "@/app/logout-action";

export type MobileNavItem = { href: string; label: string; locked?: boolean; badge?: number };

export function MobileNavigation({ companyName, items }: { companyName: string; items: MobileNavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <>
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[var(--mf-sidebar)] px-4 py-3 text-white shadow-md md:hidden">
      <Link href="/dashboard" className="flex min-w-0 items-center gap-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white"><BrandMark size={34}/></span><span className="min-w-0"><b>Mercado<span className="text-orange-400">Food</span></b><span className="block truncate text-xs text-emerald-100">{companyName}</span></span></Link>
      <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="rounded-xl border border-white/20 p-2"><Menu/></button>
    </header>
    {open && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)}/><aside className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-[var(--mf-sidebar)] p-5 text-white shadow-2xl"><div className="flex items-center justify-between"><b className="text-lg">Menu Mercado<span className="text-[var(--mf-accent)]">Food</span></b><button onClick={() => setOpen(false)} className="rounded-xl border border-white/20 p-2"><X/></button></div><nav className="mt-6 grid gap-2 overflow-y-auto">{items.map(item => {const active=pathname===item.href||pathname.startsWith(`${item.href}/`);return <Link onClick={() => setOpen(false)} key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center rounded-xl px-4 py-3 font-semibold ${active ? "bg-[var(--mf-primary)]" : "bg-white/5 hover:bg-[var(--mf-primary)]"}`}><span>{item.label}{item.locked ? " 🔒" : ""}</span>{Boolean(item.badge) && <span className="ml-auto min-w-6 rounded-full bg-white px-2 py-0.5 text-center text-xs font-black text-[var(--mf-primary)]">{item.badge}</span>}</Link>})}</nav><form action={logout} className="mt-auto"><button className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 font-semibold hover:bg-red-600"><LogOut size={18}/>Sair</button></form></aside></div>}
  </>;
}
