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
  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--mf-primary)] hover:text-white focus-visible:bg-[var(--mf-primary)] focus-visible:outline-none ${active ? "bg-[var(--mf-primary)] shadow-sm" : muted ? "opacity-50" : "opacity-95"}`}>{children}</Link>;
}
