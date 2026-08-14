import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { SupportBanner } from "@/components/support/support-banner";
import { getBrandTheme, themeStyle } from "@/lib/brand/themes";

export async function DashboardShell({ children }: { children: ReactNode }) {
  const { company, supportSession } = await getCurrentCompany();
  const theme = getBrandTheme(company.menu_theme);
  return (
    <div data-brand-theme={theme.id} data-dark={theme.dark || undefined} style={themeStyle(theme)} className="mf-dashboard-theme min-h-screen bg-[var(--mf-bg)] text-[var(--mf-text)]">
      {supportSession && <SupportBanner companyName={company.name} accessLevel={supportSession.accessLevel} expiresAt={supportSession.expiresAt}/>} 
      <div className="md:flex"><Sidebar/><main className="min-w-0 max-w-full flex-1 overflow-x-hidden p-4 md:p-8">{children}</main></div>
    </div>
  );
}
