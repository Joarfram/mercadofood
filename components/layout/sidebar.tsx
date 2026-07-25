import Link from "next/link";
import { LayoutDashboard, ShoppingBag, Utensils, Settings, Bike, ChefHat, WalletCards, Banknote, BarChart3, PackageOpen, Users, Tags, Armchair, Boxes, UserCog } from "lucide-react";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { canAccess, roleLabels, type ModuleKey } from "@/lib/auth/permissions";

const items: Array<{href:string;label:string;icon:typeof LayoutDashboard;module:ModuleKey}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingBag, module: "orders" },
  { href: "/produtos", label: "Produtos", icon: Utensils, module: "products" },
  { href: "/combos", label: "Combos", icon: Boxes, module: "products" },
  { href: "/cozinha", label: "Cozinha", icon: ChefHat, module: "kitchen" },
  { href: "/entregadores", label: "Entregadores", icon: Bike, module: "delivery" },
  { href: "/pagamentos", label: "Pagamentos", icon: WalletCards, module: "payments" },
  { href: "/financeiro", label: "Caixa", icon: Banknote, module: "finance" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, module: "reports" },
  { href: "/estoque", label: "Estoque", icon: PackageOpen, module: "stock" },
  { href: "/clientes", label: "Clientes", icon: Users, module: "customers" },
  { href: "/promocoes", label: "Promoções", icon: Tags, module: "promotions" },
  { href: "/mesas", label: "Mesas e comandas", icon: Armchair, module: "tables" },
  { href: "/usuarios", label: "Usuários", icon: UserCog, module: "team" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, module: "settings" }
];

export async function Sidebar() {
  const { company, role } = await getCurrentCompany();
  return <aside className="hidden md:flex md:w-64 md:flex-col bg-white border-r border-gray-200 min-h-screen p-4">
    <div className="flex items-center gap-3 px-2 py-4"><div className="h-10 w-10 rounded-xl bg-mercado-green text-white flex items-center justify-center font-bold">MF</div><div><p className="font-bold">MercadoFood</p><p className="text-xs text-gray-500">{company.name}</p><p className="text-[11px] font-semibold text-emerald-700">{roleLabels[role]}</p></div></div>
    <nav className="mt-6 space-y-2">{items.filter(item => canAccess(role,item.module)).map(({href,label,icon:Icon}) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-mercado-soft"><Icon size={18}/>{label}</Link>)}</nav>
  </aside>;
}
