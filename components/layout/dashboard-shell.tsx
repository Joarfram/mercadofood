import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { SupportBanner } from "@/components/support/support-banner";

export async function DashboardShell({ children }: { children: ReactNode }) {
  const { company, supportSession } = await getCurrentCompany();
  return (
    <div className="mf-dashboard-theme mf-system-theme min-h-screen bg-[var(--mf-bg)] text-[var(--mf-text)]">
      {supportSession && <SupportBanner companyName={company.name} accessLevel={supportSession.accessLevel} expiresAt={supportSession.expiresAt}/>} 
      <div className="md:flex"><Sidebar/><main className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 md:p-8">{children}</main></div>
    </div>
  );
}
