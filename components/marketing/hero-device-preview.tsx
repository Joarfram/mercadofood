import Image from "next/image";
import { Bell, Bike, Check, ClipboardList, Clock3, CreditCard, Home, MenuSquare, PackageCheck, ShoppingBag, Truck } from "lucide-react";

export function HeroDevicePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[790px] pb-24 pt-3 lg:max-w-none xl:pb-16">
      <div className="absolute -right-16 -top-8 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="absolute left-10 top-20 h-56 w-56 rounded-full bg-emerald-300/15 blur-3xl" />

      <div className="relative z-10">
        <div className="relative rounded-[1.8rem] border-[10px] border-[#171d1b] bg-[#171d1b] p-1.5 shadow-[0_28px_60px_rgba(8,48,35,.22)] sm:rounded-[2.2rem] sm:border-[13px]">
          <div className="overflow-hidden rounded-[1.1rem] bg-[#f4f7f4] sm:rounded-[1.35rem]">
            <div className="grid min-h-[390px] grid-cols-[76px_1fr] sm:grid-cols-[158px_1fr]">
              <aside className="bg-[#073b2d] px-3 py-5 text-white sm:px-4 sm:py-6">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#b7ef52] text-[#073b2d]">
                    <ShoppingBag size={19} strokeWidth={2.5} />
                  </span>
                  <strong className="hidden text-[13px] tracking-tight sm:block">MercadoFood</strong>
                </div>

                <div className="mt-7 grid gap-1.5 text-[10px] font-bold text-emerald-50/85 sm:text-[11px]">
                  <MenuItem icon={Home} label="Início" active />
                  <MenuItem icon={ClipboardList} label="Pedidos" />
                  <MenuItem icon={MenuSquare} label="Cardápio" />
                  <MenuItem icon={Bike} label="Entrega" />
                  <MenuItem icon={CreditCard} label="Pagamentos" />
                </div>
              </aside>

              <div className="min-w-0 bg-[#f6f8f5] p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.12em] text-emerald-700 sm:text-[10px]">Visão geral</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-[26px]">Olá, Chef!</h2>
                    <p className="mt-1 hidden text-xs text-slate-500 sm:block">Aqui está o resumo da sua operação hoje.</p>
                  </div>
                  <span className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[8px] font-bold text-slate-500 shadow-sm sm:px-3 sm:text-[10px]">
                    Hoje, 24 de abr.
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Metric label="Pedidos" value="28" icon={ClipboardList} />
                  <Metric label="Em preparo" value="6" icon={Clock3} amber />
                  <Metric label="Em entrega" value="5" icon={Truck} />
                  <Metric label="Vendas do dia" value="R$ 1.248,90" icon={CreditCard} />
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.25fr_.75fr]">
                  <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-black text-slate-950">Pedidos recentes</p>
                        <p className="text-[9px] text-slate-500">Acompanhe os pedidos da loja</p>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-700">Ver todos</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Order number="#1048" name="Burger Clássico" status="Em preparo" tone="amber" />
                      <Order number="#1047" name="Pizza Margherita" status="Em entrega" tone="green" />
                      <Order number="#1046" name="Combo Família" status="Recebido" tone="slate" />
                      <Order number="#1045" name="Salada Caesar" status="Em preparo" tone="amber" />
                    </div>
                  </div>

                  <div className="hidden rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100 lg:block">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-black text-slate-950">Status da cozinha</p>
                      <span className="text-[8px] font-bold text-emerald-700">Ver todos</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <Status icon={Clock3} number="2" text="Em preparo" amber />
                      <Status icon={ClipboardList} number="3" text="Aguardando" />
                      <Status icon={PackageCheck} number="1" text="Pronto para retirada" green />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto h-4 w-[88%] rounded-b-[70%] bg-gradient-to-b from-[#b8bbb9] to-[#777c79] shadow-[0_12px_18px_rgba(0,0,0,.12)]" />
        <div className="mx-auto -mt-4 h-4 w-[28%] rounded-b-xl bg-[#8d918f]" />
      </div>

      <div className="absolute bottom-0 right-0 z-30 hidden sm:block xl:right-1">
        <MobileOrderPreview />
      </div>

      <div className="absolute bottom-1 right-[132px] z-40 hidden w-[118px] sm:block md:w-[138px] xl:right-[148px] xl:w-[150px]">
        <Image
          src="/mercadinho-mascote.png"
          alt="Mascote MercadoFood"
          width={400}
          height={600}
          className="h-auto w-full object-contain drop-shadow-[0_16px_16px_rgba(5,45,32,.24)]"
          priority
        />
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, active = false }: { icon: typeof Home; label: string; active?: boolean }) {
  return (
    <span className={`flex items-center gap-2 rounded-lg px-2 py-2 ${active ? "bg-white/14 text-white" : ""}`}>
      <Icon size={13} />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

function Metric({ label, value, icon: Icon, amber = false }: { label: string; value: string; icon: typeof Home; amber?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-100 sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[8px] font-bold uppercase tracking-wide text-slate-500 sm:text-[9px]">{label}</p>
        <Icon size={13} className={amber ? "text-amber-500" : "text-emerald-600"} />
      </div>
      <p className={amber ? "mt-1.5 text-sm font-black text-amber-600 sm:text-base" : "mt-1.5 text-sm font-black text-slate-950 sm:text-base"}>{value}</p>
    </div>
  );
}

function Order({ number, name, status, tone }: { number: string; name: string; status: string; tone: "amber" | "green" | "slate" }) {
  const toneClass = tone === "amber" ? "bg-amber-100 text-amber-700" : tone === "green" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[9px]">
      <strong className="text-slate-700">{number}</strong>
      <span className="truncate text-slate-500">{name}</span>
      <span className={`rounded-full px-2 py-1 font-bold ${toneClass}`}>{status}</span>
    </div>
  );
}

function Status({ icon: Icon, number, text, amber = false, green = false }: { icon: typeof Home; number: string; text: string; amber?: boolean; green?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid h-8 w-8 place-items-center rounded-full ${amber ? "bg-amber-50 text-amber-600" : green ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-700"}`}>
        <Icon size={15} />
      </span>
      <div>
        <p className="text-[11px] font-black text-slate-900">{number}</p>
        <p className="text-[8px] text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function MobileOrderPreview() {
  return (
    <div className="w-[142px] rounded-[2rem] border-[6px] border-[#17201d] bg-[#17201d] p-1 shadow-[0_24px_38px_rgba(8,44,34,.28)] md:w-[158px]">
      <div className="overflow-hidden rounded-[1.5rem] bg-[#f8fbf8]">
        <div className="mx-auto mt-1.5 h-1.5 w-12 rounded-full bg-[#2d3431]" />
        <div className="px-3 pb-4 pt-3">
          <div className="flex items-center justify-between rounded-lg bg-[#073b2d] px-2 py-2 text-[8px] font-black text-white">
            <span>MercadoFood</span>
            <Bell size={11} />
          </div>

          <div className="mt-3 text-center">
            <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <ClipboardList size={16} />
            </span>
            <p className="mt-2 text-[12px] font-black leading-tight text-slate-950">Novo pedido!</p>
            <p className="mt-0.5 text-[8px] text-slate-500">#1049 · Agora há pouco</p>
          </div>

          <div className="mt-3 space-y-1.5">
            <PhoneItem name="X-Bacon" price="R$ 32,90" icon="🍔" />
            <PhoneItem name="Batata frita" price="R$ 18,90" icon="🍟" />
            <PhoneItem name="Refrigerante" price="R$ 6,00" icon="🥤" />
          </div>

          <div className="mt-3 flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-[8px] font-bold text-emerald-800">
            <Truck size={10} /> Entrega
          </div>

          <button className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2.5 text-[8px] font-black text-white shadow-sm">
            <Check size={11} /> Aceitar pedido
          </button>
          <p className="mt-2 text-center text-[8px] font-bold text-emerald-700">Ver detalhes</p>
        </div>
      </div>
    </div>
  );
}

function PhoneItem({ name, price, icon }: { name: string; price: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-slate-100">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-amber-50 text-sm">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[8px] font-black text-slate-800">{name}</p>
        <p className="text-[7px] text-slate-500">1 x {price}</p>
      </div>
    </div>
  );
}
