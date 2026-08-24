import Link from "next/link";
import { BadgeDollarSign, Building2, Headphones, LayoutDashboard, LogOut, MailPlus, ShieldCheck } from "lucide-react";
import { requirePlatformStaff } from "@/lib/master/auth";
import { logout } from "@/app/logout-action";

const links=[
  {href:"/master",label:"Visão geral",icon:LayoutDashboard},
  {href:"/master/planos",label:"Planos e Recursos",icon:BadgeDollarSign},
  {href:"/master/empresas",label:"Empresas",icon:Building2},
  {href:"/master/convites",label:"Convites",icon:MailPlus},
  {href:"/master/suporte",label:"Suporte",icon:Headphones},
];
export default async function MasterLayout({children}:{children:React.ReactNode}){
  const {staff}=await requirePlatformStaff();
  return <div className="min-h-screen bg-slate-50"><header className="border-b bg-[#052e24] text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4"><Link href="/master" className="flex items-center gap-2 font-black"><ShieldCheck className="text-orange-400"/>MercadoFood Master</Link><nav className="flex flex-wrap items-center gap-2 text-sm font-semibold">{links.map(({href,label,icon:Icon})=><Link key={href} href={href} className="flex gap-2 rounded-lg px-3 py-2 hover:bg-white/10"><Icon size={17}/>{label}</Link>)}<span className="rounded-full bg-white/10 px-3 py-2">{staff.display_name} • {staff.support_level}</span><form action={logout}><button className="rounded-lg p-2 hover:bg-red-600" aria-label="Sair"><LogOut size={18}/></button></form></nav></div></header><main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main></div>;
}
