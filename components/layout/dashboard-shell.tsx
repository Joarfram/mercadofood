import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7faf8] md:flex">
      <Sidebar />
      <main className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
    </div>
  );
}
