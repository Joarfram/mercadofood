"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { createCounterSale } from "@/app/(dashboard)/financeiro/actions";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
};

type CartItem = Product & { quantity: number };

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function CashRegister({ sessionId, products }: { sessionId: string; products: Product[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [received, setReceived] = useState("");

  const categories = useMemo(() => ["Todas", ...Array.from(new Set(products.map(product => product.category))).sort()], [products]);
  const visibleProducts = products.filter(product => {
    const matchesSearch = product.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
    return matchesSearch && (category === "Todas" || product.category === category);
  });
  const items = Object.values(cart);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const receivedNumber = Number(received.replace(",", ".")) || 0;
  const change = paymentMethod === "cash" ? Math.max(0, receivedNumber - total) : 0;
  const insufficientCash = paymentMethod === "cash" && receivedNumber < total;

  function changeQuantity(product: Product, delta: number) {
    setCart(current => {
      const next = { ...current };
      const quantity = (next[product.id]?.quantity || 0) + delta;
      if (quantity <= 0) delete next[product.id];
      else next[product.id] = { ...product, quantity };
      return next;
    });
  }

  function selectPayment(method: string) {
    setPaymentMethod(method);
    if (method !== "cash") setReceived("");
  }

  return <section className="rounded-3xl border border-emerald-200 bg-white p-4 shadow-sm md:p-6">
    <div className="flex flex-col gap-2 border-b pb-5 md:flex-row md:items-center md:justify-between">
      <div><p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Venda no balcão</p><h2 className="text-2xl font-black">Caixa rápido</h2><p className="text-sm text-gray-500">Selecione os produtos, receba o pagamento e envie o pedido para a cozinha.</p></div>
      <div className="rounded-2xl bg-emerald-50 px-5 py-3 text-right"><p className="text-xs font-semibold text-emerald-700">Total da venda</p><strong className="text-3xl text-emerald-800">{money(total)}</strong></div>
    </div>

    <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_410px]">
      <div>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={19}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar produto pelo nome" className="w-full rounded-xl border py-3 pl-10 pr-4"/></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{categories.map(item => <button key={item} type="button" onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${category === item ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700"}`}>{item}</button>)}</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProducts.map(product => {
            const quantity = cart[product.id]?.quantity || 0;
            return <article key={product.id} className={`rounded-2xl border p-4 transition ${quantity ? "border-emerald-500 bg-emerald-50" : "bg-white"}`}>
              <p className="text-xs font-semibold text-gray-500">{product.category}</p><h3 className="mt-1 min-h-12 font-bold">{product.name}</h3><strong className="text-lg text-emerald-700">{money(product.price)}</strong>
              <div className="mt-3 flex items-center justify-between">{quantity ? <><button type="button" aria-label={`Diminuir ${product.name}`} onClick={() => changeQuantity(product, -1)} className="rounded-full border bg-white p-2"><Minus size={17}/></button><strong>{quantity}</strong><button type="button" aria-label={`Aumentar ${product.name}`} onClick={() => changeQuantity(product, 1)} className="rounded-full bg-emerald-700 p-2 text-white"><Plus size={17}/></button></> : <button type="button" onClick={() => changeQuantity(product, 1)} className="w-full rounded-xl bg-emerald-700 py-2 font-bold text-white">Adicionar</button>}</div>
            </article>;
          })}
          {!visibleProducts.length && <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500 sm:col-span-2 lg:col-span-3">Nenhum produto disponível encontrado.</p>}
        </div>
      </div>

      <form action={createCounterSale} className="h-fit rounded-2xl border bg-gray-50 p-4 xl:sticky xl:top-5">
        <input type="hidden" name="sessionId" value={sessionId}/><input type="hidden" name="items" value={JSON.stringify(items.map(item => ({ productId: item.id, quantity: item.quantity })))}/><input type="hidden" name="paymentMethod" value={paymentMethod}/>
        <div className="flex items-center gap-2"><ShoppingCart className="text-emerald-700"/><h3 className="text-xl font-black">Venda atual</h3><span className="ml-auto rounded-full bg-white px-3 py-1 text-sm font-semibold">{items.reduce((sum, item) => sum + item.quantity, 0)} itens</span></div>
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {!items.length && <p className="rounded-xl bg-white p-5 text-center text-sm text-gray-500">Adicione produtos para começar.</p>}
          {items.map(item => <div key={item.id} className="flex items-center gap-2 rounded-xl bg-white p-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.name}</p><p className="text-sm text-gray-500">{item.quantity} × {money(item.price)}</p></div><strong>{money(item.quantity * item.price)}</strong><button type="button" aria-label={`Remover ${item.name}`} onClick={() => setCart(current => { const next = { ...current }; delete next[item.id]; return next; })} className="p-1 text-red-500"><Trash2 size={17}/></button></div>)}
        </div>

        <label className="mt-4 block text-sm font-semibold">Nome do cliente <span className="font-normal text-gray-400">(opcional)</span><input name="customerName" placeholder="Venda balcão" className="mt-1 w-full rounded-xl border bg-white p-3 font-normal"/></label>
        <label className="mt-3 block text-sm font-semibold">Observação <span className="font-normal text-gray-400">(opcional)</span><input name="notes" placeholder="Ex.: sem cebola" className="mt-1 w-full rounded-xl border bg-white p-3 font-normal"/></label>

        <p className="mt-4 text-sm font-semibold">Forma de pagamento</p>
        <div className="mt-2 grid grid-cols-2 gap-2">{[
          ["cash", "Dinheiro"], ["pix", "PIX"], ["debit_card", "Débito"], ["credit_card", "Crédito"],
        ].map(([value, label]) => <button key={value} type="button" onClick={() => selectPayment(value)} className={`rounded-xl border p-3 font-bold ${paymentMethod === value ? "border-orange-500 bg-orange-50 text-orange-700" : "bg-white"}`}>{label}</button>)}</div>

        {paymentMethod === "cash" ? <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4"><label className="text-sm font-bold text-blue-900">Valor recebido em dinheiro<input name="amountReceived" inputMode="decimal" value={received} onChange={event => setReceived(event.target.value)} placeholder="0,00" className="mt-1 w-full rounded-xl border bg-white p-3 text-xl font-black text-gray-900"/></label><div className="mt-3 flex items-center justify-between border-t border-blue-200 pt-3"><span className="font-semibold text-blue-900">Troco</span><strong className="text-2xl text-blue-900">{money(change)}</strong></div>{insufficientCash && total > 0 && <p className="mt-2 text-xs font-semibold text-red-600">O valor recebido é menor que o total.</p>}</div> : <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-4"><span className="font-semibold">Troco</span><strong className="text-xl">R$ 0,00</strong></div>}

        <div className="mt-4 flex items-center justify-between border-t pt-4"><span className="text-lg font-bold">Total</span><strong className="text-2xl text-emerald-700">{money(total)}</strong></div>
        <button disabled={!items.length || insufficientCash} className="mt-4 w-full rounded-xl bg-orange-500 py-4 text-lg font-black text-white disabled:cursor-not-allowed disabled:bg-gray-300">Finalizar venda e enviar à cozinha</button>
      </form>
    </div>
  </section>;
}
