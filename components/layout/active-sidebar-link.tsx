"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ActiveSidebarLink({ href, activeHref, children, muted = false }: {
  href: string;
  activeHref: string;
  children: ReactNode;
  muted?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === activeHref || pathname.startsWith(`${activeHref}/`);
  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors duration-200 hover:bg-[#F97316] hover:text-white focus-visible:bg-[#F97316] focus-visible:outline-none ${active ? "bg-[#F97316] text-white shadow-sm" : muted ? "text-emerald-100/55" : "text-emerald-50"}`}>{children}</Link>;
}
