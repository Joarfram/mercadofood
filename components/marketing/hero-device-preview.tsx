import Image from "next/image";
import { Bell, ClipboardList, MenuSquare, Truck } from "lucide-react";

export function HeroDevicePreview() {
  return (
    <div className="relative mx-auto w-full max-w-3xl pb-16 lg:max-w-none">
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-amber-300/25 blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.7rem] border-[7px] border-[#111816] bg-[#111816] p-1.5 shadow-2xl shadow-emerald-950/25 sm:rounded-[2rem] sm:border-[10px]">
        <div className="rounded-[1rem] bg-[#f6f8f5] sm:rounded-[1.3rem]">
          <div className="grid min-h-[365px] grid-cols-[58px_1fr] sm:grid-cols-[150px_1fr]">
            <aside className="rounded-l-[1rem] bg-[#073b2d] p-3 text-white sm:rounded-l-[1.3rem] sm:p-5">
              <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-300 text-[#073b2d]"><MenuSquare size={18} /></span><strong className="hidden text-sm sm:block">MercadoFood</strong></div>
              <div className="mt-8 grid gap-2 text-[10px] font-bold text-emerald-50/80 sm:text-xs"><span className="rounded-lg bg-white/15 p-2 sm:px-3">Início</span><span className="p-2 sm:px-3">Pedidos</span><span className="p-2 sm:px-3">Cardápio</span><span className="p-2 sm:px-3">Entrega</span><span className="p-2 sm:px-3">Pagamentos</span></div>
            </aside>
            <div className="min-w-0 p-4 sm:p-6"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Exemplo de painel</p><h2 className="mt-1 text-lg font-black text-slate-900 sm:text-2xl">Olá, Chef!</h2><p className="hidden text-xs text-slate-500 sm:block">Aqui está o resumo da sua operação hoje.</p></div><span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-500 sm:px-3 sm:text-xs">Hoje, 24 de abr.</span></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"><Metric label="Pedidos" value="28" /><Metric label="Em preparo" value="6" amber /><Metric label="Em entrega" value="5" /><Metric label="Vendas" value="R$ 1.248" /></div><div className="mt-4 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100"><div className="flex justify-between gap-2"><div><p className="text-sm font-black text-slate-900">Pedidos recentes</p><p className="text-[10px] text-slate-500">Acompanhe os pedidos da loja</p></div><span className="text-[10px] font-bold text-emerald-700">Ver todos</span></div><div className="mt-3 space-y-2"><Order number="#1048" name="Burger Clássico" status="Em preparo" /><Order number="#1047" name="Pizza Margherita" status="Em entrega" /></div></div></div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-1 right-0 z-20 hidden xl:block"><MobileOrderPreview /></div>
      <div className="absolute -bottom-1 right-24 z-30 hidden w-28 xl:block"><Image src="/mercadinho-mascote.png" alt="Mascote Mercadinho" width={400} height={600} className="h-auto w-full drop-shadow-xl" priority /></div>
    </div>
  );
}

function Metric({ label, value, amber = false }: { label: string; value: string; amber?: boolean }) { return <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-100 sm:p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:text-[10px]">{label}</p><p className={amber ? "mt-1 text-sm font-black text-amber-600 sm:text-lg" : "mt-1 text-sm font-black text-slate-900 sm:text-lg"}>{value}</p></div>; }
function Order({ number, name, status }: { number: string; name: string; status: string }) { return <div className="flex items-center justify-between gap-2 text-[10px]"><span className="min-w-0 truncate font-bold text-slate-700">{number} <span className="font-medium text-slate-500">{name}</span></span><span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 font-bold text-emerald-800">{status}</span></div>; }

function MobileOrderPreview() { return <div className="w-28 rounded-[1.5rem] border-[4px] border-[#17201d] bg-white p-1.5 shadow-2xl"><div className="rounded-[1rem] bg-[#f8fbf8] px-2 py-3"><div className="flex items-center justify-between rounded-lg bg-[#073b2d] px-2 py-2 text-[8px] font-black text-white"><span>MercadoFood</span><Bell size={11} /></div><div className="mt-3 text-center"><span className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-700"><ClipboardList size={15} /></span><p className="mt-2 text-xs font-black text-slate-900">Novo pedido!</p><p className="text-[8px] text-slate-500">#1043 · Agora há pouco</p></div><div className="mt-3 rounded-lg bg-white p-2 text-[8px] shadow-sm"><p className="font-bold text-slate-800">X-Burger</p><p className="mt-1 text-slate-500">1 un. · R$ 24,90</p><div className="mt-2 flex items-center gap-1 text-emerald-800"><Truck size={10} /> Entrega</div></div><button className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-[8px] font-black text-white">Aceitar pedido</button><p className="mt-2 text-center text-[8px] font-bold text-emerald-700">Ver detalhes</p></div></div>; }

