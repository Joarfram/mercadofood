import Link from "next/link";
import { LayoutDashboard, ShoppingBag, Utensils, Settings, Bike, ChefHat, Banknote, BarChart3, PackageOpen, Users, Tags, Armchair, Boxes, UserCog, Images, BadgeDollarSign, LockKeyhole, Megaphone, LogOut, MessageSquareText, SlidersHorizontal } from "lucide-react";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { canAccess, roleLabels, type ModuleKey } from "@/lib/auth/permissions";
import { BrandMark } from "@/components/brand/brand-mark";
import { isPlanCode, planAllows, plans } from "@/lib/billing/plans";
import { MobileNavigation } from "./mobile-navigation";
import { logout } from "@/app/logout-action";
import { ActiveSidebarLink } from "./active-sidebar-link";

const items: Array<{href:string;label:string;icon:typeof LayoutDashboard;module:ModuleKey}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingBag, module: "orders" },
  { href: "/produtos", label: "Produtos", icon: Utensils, module: "products" },
  { href: "/combos", label: "Combos", icon: Boxes, module: "products" },
  { href: "/complementos", label: "Complementos e Adicionais", icon: SlidersHorizontal, module: "products" },
  { href: "/midias", label: "Fotos e imagens", icon: Images, module: "products" },
  { href: "/cozinha", label: "Cozinha", icon: ChefHat, module: "kitchen" },
  { href: "/entregadores", label: "Entregadores", icon: Bike, module: "drivers" },
  { href: "/financeiro", label: "Caixa e pagamentos", icon: Banknote, module: "finance" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, module: "reports" },
  { href: "/estoque", label: "Estoque", icon: PackageOpen, module: "stock" },
  { href: "/clientes", label: "Clientes", icon: Users, module: "customers" },
  { href: "/promocoes", label: "Promoções", icon: Tags, module: "promotions" },
  { href: "/impulsiona", label: "Impulsiona", icon: Megaphone, module: "marketing" },
  { href: "/mensagens", label: "Mensagens", icon: MessageSquareText, module: "messages" },
  { href: "/mesas", label: "Mesas e comandas", icon: Armchair, module: "tables" },
  { href: "/usuarios", label: "Usuários", icon: UserCog, module: "team" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, module: "settings" }
];

export async function Sidebar() {
  const { company, role, supabase } = await getCurrentCompany();
  const { data: subscription } = await supabase.from("company_subscriptions").select("status, subscription_plans(code)").eq("company_id", company.id).maybeSingle();
  const relatedPlan = Array.isArray(subscription?.subscription_plans) ? subscription?.subscription_plans[0] : subscription?.subscription_plans;
  const planCode = isPlanCode(relatedPlan?.code) ? relatedPlan.code : "basic";
  const roleItems = items.filter(item => canAccess(role,item.module));
  const entitlementResults = await Promise.all(roleItems.map(item => supabase.rpc("company_plan_allows",{target_company:company.id,requested_module:item.module})));
  const visibleItems = roleItems.map((item,index) => ({ ...item, allowed: entitlementResults[index].error ? planAllows(planCode,item.module) : Boolean(entitlementResults[index].data) })).filter(item => item.allowed);
  const [{ count: unreadFeedback }, { data: unreadWhatsApp }] = canAccess(role,"messages")
    ? await Promise.all([
      supabase.from("customer_messages").select("id",{count:"exact",head:true}).eq("company_id",company.id).eq("status","new"),
      supabase.from("whatsapp_conversations").select("unread_count").eq("company_id",company.id).gt("unread_count",0),
    ])
    : [{ count: 0 }, { data: [] }];
  const unreadMessages = Number(unreadFeedback || 0) + (unreadWhatsApp || []).reduce((sum,item) => sum + Number(item.unread_count || 0), 0);
  return <><MobileNavigation companyName={company.name} items={visibleItems.map(item => ({ href: item.allowed ? item.href : `/assinatura?bloqueado=${item.module}`, label: item.label, locked: !item.allowed, badge: item.module === "messages" ? unreadMessages || 0 : 0 }))}/><aside className="mf-sidebar hidden min-h-screen border-r border-white/10 bg-[var(--mf-sidebar)] p-4 text-[var(--mf-sidebar-text)] shadow-xl md:flex md:w-64 md:flex-col">
    <div className="flex items-center gap-3 border-b border-white/10 px-2 py-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-md"><BrandMark size={42}/></div><div className="min-w-0 text-white"><p className="font-bold text-white">Mercado<span className="text-amber-300">Food</span></p><p className="truncate text-xs text-white/80">{company.name}</p><p className="text-[11px] font-semibold text-white/90">{roleLabels[role]}</p></div></div>
    <nav className="mt-6 space-y-2">{visibleItems.map(({href,label,icon:Icon,module,allowed}) => {
      return <ActiveSidebarLink key={href} href={allowed ? href : `/assinatura?bloqueado=${module}`} activeHref={href} muted={!allowed}><Icon size={18}/><span>{label}</span>{allowed && module === "messages" && Boolean(unreadMessages) && <span className="ml-auto min-w-6 rounded-full bg-white px-2 py-0.5 text-center text-xs font-black text-orange-600">{unreadMessages}</span>}{!allowed && <LockKeyhole className="ml-auto" size={14}/>}</ActiveSidebarLink>;
    })}</nav>
    <div className="mt-auto space-y-2"><Link href="/assinatura" className="flex items-center gap-3 rounded-xl border border-white/15 px-3 py-3 text-sm font-semibold text-white/90 hover:bg-[var(--mf-primary)]"><BadgeDollarSign size={18}/><span>Plano {plans[planCode].name}</span></Link><form action={logout}><button className="flex w-full items-center gap-3 rounded-xl border border-white/15 px-3 py-3 text-sm font-semibold hover:bg-red-600"><LogOut size={18}/>Sair</button></form></div>
  </aside></>;
}
