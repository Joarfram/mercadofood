"use client";
import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { createTableOrder } from "./actions";

type Product = { id:string; name:string; description?:string; price:number|string; category_id?:string };
function money(v:number|string) { return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0)); }
export default function TableMenuClient({ token, context }:{token:string;context:any}) {
  const [cart,setCart] = useState<Record<string,number>>({});
  const products = useMemo<Product[]>(() => context.products || [], [context.products]);
  const items = useMemo(() => products.filter(p => (cart[p.id]||0)>0).map(p => ({ product_id:p.id, quantity:cart[p.id] })),[cart,products]);
  const total = products.reduce((s,p)=>s+Number(p.price)*(cart[p.id]||0),0);
  const action = createTableOrder.bind(null,token);
  const change=(id:string,d:number)=>setCart(c=>({...c,[id]:Math.max(0,(c[id]||0)+d)}));
  return <div className="mx-auto max-w-4xl space-y-5 p-4 pb-40"><header className="rounded-3xl bg-emerald-800 p-6 text-white"><p className="text-sm font-semibold opacity-80">{context.company?.name}</p><h1 className="text-3xl font-bold">{context.table?.name}</h1><p className="mt-2 opacity-90">Faça seu pedido pelo QR Code. Os itens serão enviados diretamente para a cozinha.</p>{context.tab && <div className="mt-4 rounded-2xl bg-white/10 p-3"><p>Comanda atual</p><strong className="text-xl">{money(context.tab.total)}</strong></div>}</header>
  <section className="grid gap-3 md:grid-cols-2">{products.map(p=><article key={p.id} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex justify-between gap-4"><div><h2 className="font-bold">{p.name}</h2><p className="mt-1 text-sm text-gray-500">{p.description||"Produto disponível"}</p><strong className="mt-3 block text-emerald-700">{money(p.price)}</strong></div><div className="flex items-center gap-2 self-end"><button onClick={()=>change(p.id,-1)} className="rounded-full border p-2"><Minus size={16}/></button><span className="w-6 text-center font-bold">{cart[p.id]||0}</span><button onClick={()=>change(p.id,1)} className="rounded-full bg-emerald-700 p-2 text-white"><Plus size={16}/></button></div></div></article>)}</section>
  {!products.length && <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">Nenhum produto disponível.</div>}
  <form action={action} className="fixed bottom-0 left-0 right-0 border-t bg-white p-4 shadow-2xl"><div className="mx-auto grid max-w-4xl gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"><input name="customerName" placeholder="Seu nome" className="rounded-xl border px-3 py-3"/><input name="customerPhone" placeholder="WhatsApp" className="rounded-xl border px-3 py-3"/><input name="notes" placeholder="Observação geral" className="rounded-xl border px-3 py-3"/><input type="hidden" name="items" value={JSON.stringify(items)}/><button disabled={!items.length} className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white disabled:opacity-50"><ShoppingBag size={18}/> Pedir • {money(total)}</button></div></form></div>;
}
