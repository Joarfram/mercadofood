"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { logout } from "@/app/logout-action";

export type MobileNavItem = { href: string; label: string; locked?: boolean };

export function MobileNavigation({ companyName, items }: { companyName: string; items: MobileNavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <>
    <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-[#063D2F] px-4 py-3 text-white shadow-md md:hidden">
      <Link href="/dashboard" className="flex min-w-0 items-center gap-2"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white"><BrandMark size={34}/></span><span className="min-w-0"><b>Mercado<span className="text-orange-400">Food</span></b><span className="block truncate text-xs text-emerald-100">{companyName}</span></span></Link>
      <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="rounded-xl border border-white/20 p-2"><Menu/></button>
    </header>
    {open && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)}/><aside className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-[#063D2F] p-5 text-white shadow-2xl"><div className="flex items-center justify-between"><b className="text-lg">Menu Mercado<span className="text-orange-400">Food</span></b><button onClick={() => setOpen(false)} className="rounded-xl border border-white/20 p-2"><X/></button></div><nav className="mt-6 grid gap-2 overflow-y-auto">{items.map(item => {const active=pathname===item.href||pathname.startsWith(`${item.href}/`);return <Link onClick={() => setOpen(false)} key={item.href} href={item.href} className={`rounded-xl px-4 py-3 font-semibold ${active ? "bg-orange-500" : "bg-white/5 hover:bg-orange-500"}`}>{item.label}{item.locked ? " 🔒" : ""}</Link>})}</nav><form action={logout} className="mt-auto"><button className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 font-semibold hover:bg-red-600"><LogOut size={18}/>Sair</button></form></aside></div>}
  </>;
}
