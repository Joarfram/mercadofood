import Link from "next/link";
import { LayoutDashboard, ShoppingBag, Utensils, Settings, Bike, ChefHat, WalletCards, Banknote, BarChart3, PackageOpen, Users, Tags, Armchair, Boxes, UserCog, Images } from "lucide-react";
import { getCurrentCompany } from "@/lib/auth/current-company";
import { canAccess, roleLabels, type ModuleKey } from "@/lib/auth/permissions";
import { BrandMark } from "@/components/brand/brand-mark";

const items: Array<{href:string;label:string;icon:typeof LayoutDashboard;module:ModuleKey}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingBag, module: "orders" },
  { href: "/produtos", label: "Produtos", icon: Utensils, module: "products" },
  { href: "/combos", label: "Combos", icon: Boxes, module: "products" },
  { href: "/midias", label: "Fotos e imagens", icon: Images, module: "products" },
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
  return <aside className="hidden min-h-screen border-r border-emerald-950 bg-[#063D2F] p-4 text-white shadow-xl md:flex md:w-64 md:flex-col">
    <div className="flex items-center gap-3 border-b border-white/10 px-2 py-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-md"><BrandMark size={42}/></div><div className="min-w-0"><p className="font-bold">Mercado<span className="text-orange-400">Food</span></p><p className="truncate text-xs text-emerald-100/80">{company.name}</p><p className="text-[11px] font-semibold text-emerald-300">{roleLabels[role]}</p></div></div>
    <nav className="mt-6 space-y-2">{items.filter(item => canAccess(role,item.module)).map(({href,label,icon:Icon}) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-emerald-50 transition-colors duration-200 hover:bg-[#F97316] hover:text-white focus-visible:bg-[#F97316] focus-visible:outline-none"><Icon size={18}/>{label}</Link>)}</nav>
  </aside>;
}
