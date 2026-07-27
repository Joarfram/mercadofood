"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { submitPublicComboOrder } from "./actions";

type ComboProduct = { id: string; name: string; description?: string; image_url?: string; price_delta: number; max_quantity: number };
type ComboGroup = { id: string; name: string; description?: string; min_selection: number; max_selection: number; free_selection: number; products: ComboProduct[] };
type Combo = { id: string; name: string; description?: string; image_url?: string; price: number; original_price?: number | null; preparation_time?: number; groups: ComboGroup[] };
type Company = { id: string; name: string; slug: string; logo_url?: string; primary_color?: string; default_delivery_fee?: number; is_open: boolean };
type Selection = Record<string, Record<string, number>>;
type Choice = { groupId: string; groupName: string; productId: string; productName: string; quantity: number; unitPrice: number; freeQuantity: number; chargedQuantity: number; totalPrice: number };
type CartItem = { key: string; combo: Combo; quantity: number; choices: Choice[]; notes: string; extrasUnitTotal: number };

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function countSelection(selection: Selection, groupId: string) {
  return Object.values(selection[groupId] || {}).reduce((total, value) => total + value, 0);
}

function calculateChoices(combo: Combo, selection: Selection) {
  const choices: Choice[] = [];
  let extrasUnitTotal = 0;

  for (const group of combo.groups || []) {
    const selected = group.products
      .map(product => ({ product, quantity: selection[group.id]?.[product.id] || 0 }))
      .filter(item => item.quantity > 0);

    let freeRemaining = Math.max(0, Number(group.free_selection || 0));
    const freeMap = new Map<string, number>();
    for (const item of [...selected].sort((a, b) => Number(b.product.price_delta) - Number(a.product.price_delta))) {
      const freeQuantity = Math.min(item.quantity, freeRemaining);
      freeMap.set(item.product.id, freeQuantity);
      freeRemaining -= freeQuantity;
    }

    for (const { product, quantity } of selected) {
      const freeQuantity = freeMap.get(product.id) || 0;
      const chargedQuantity = quantity - freeQuantity;
      const totalPrice = chargedQuantity * Number(product.price_delta || 0);
      extrasUnitTotal += totalPrice;
      choices.push({
        groupId: group.id,
        groupName: group.name,
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: Number(product.price_delta || 0),
        freeQuantity,
        chargedQuantity,
        totalPrice
      });
    }
  }

  return { choices, extrasUnitTotal };
}

export default function ComboMenuClient({ company, combos }: { company: Company; combos: Combo[] }) {
  const [query, setQuery] = useState("");
  const [selectedCombo, setSelectedCombo] = useState<Combo | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [itemNotes, setItemNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [serviceType, setServiceType] = useState("delivery");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);
  const [pending, startTransition] = useTransition();

  const visibleCombos = useMemo(() => combos.filter(combo => `${combo.name} ${combo.description || ""}`.toLowerCase().includes(query.toLowerCase())), [combos, query]);
  const modalPrice = selectedCombo ? calculateChoices(selectedCombo, selection) : { choices: [], extrasUnitTotal: 0 };
  const subtotal = cart.reduce((total, item) => total + (Number(item.combo.price) + item.extrasUnitTotal) * item.quantity, 0);
  const deliveryFee = serviceType === "delivery" ? Number(company.default_delivery_fee || 0) : 0;

  function setChoice(group: ComboGroup, product: ComboProduct, next: number) {
    setSelection(previous => {
      const current = { ...(previous[group.id] || {}) };
      const currentQuantity = current[product.id] || 0;
      const totalWithout = countSelection(previous, group.id) - currentQuantity;
      const quantity = Math.max(0, Math.min(Number(product.max_quantity || 1), next, Math.max(0, group.max_selection - totalWithout)));
      if (quantity === 0) delete current[product.id]; else current[product.id] = quantity;
      return { ...previous, [group.id]: current };
    });
  }

  function addCombo() {
    if (!selectedCombo) return;
    for (const group of selectedCombo.groups || []) {
      const count = countSelection(selection, group.id);
      if (count < group.min_selection) return setError(`Escolha pelo menos ${group.min_selection} item(ns) em “${group.name}”.`);
      if (count > group.max_selection) return setError(`Escolha no máximo ${group.max_selection} item(ns) em “${group.name}”.`);
    }
    const pricing = calculateChoices(selectedCombo, selection);
    setCart(current => [...current, { key: crypto.randomUUID(), combo: selectedCombo, quantity: 1, choices: pricing.choices, notes: itemNotes, extrasUnitTotal: pricing.extrasUnitTotal }]);
    setSelectedCombo(null); setSelection({}); setItemNotes(""); setError("");
  }

  function submit(formData: FormData) {
    setError("");
    const payload = {
      slug: company.slug,
      customer_name: String(formData.get("customer_name") || ""),
      customer_phone: String(formData.get("customer_phone") || ""),
      service_type: serviceType,
      payment_method: String(formData.get("payment_method") || "pix"),
      notes: String(formData.get("notes") || ""),
      marketing_consent: formData.get("marketing_consent") === "on",
      delivery_address: {
        street: String(formData.get("street") || ""), number: String(formData.get("number") || ""),
        neighborhood: String(formData.get("neighborhood") || ""), reference: String(formData.get("reference") || "")
      },
      items: cart.map(item => ({ combo_id: item.combo.id, quantity: item.quantity, notes: item.notes, choices: item.choices.map(choice => ({ group_id: choice.groupId, product_id: choice.productId, quantity: choice.quantity })) }))
    };
    startTransition(async () => {
      const result = await submitPublicComboOrder(payload);
      if (!result.ok) return setError(result.error);
      setSuccess(result.data); setCart([]); setCheckoutOpen(false);
    });
  }

  if (success) return <main className="grid min-h-screen place-items-center bg-[#fffaf5] p-6"><section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-xl"><div className="text-6xl">✅</div><h1 className="mt-4 text-3xl font-black">Pedido recebido!</h1><p className="mt-2">Pedido <strong>#{success.order_number}</strong></p><p className="mt-2 text-xl font-black text-green-700">{money(Number(success.total))}</p><a className="mt-6 block rounded-xl bg-green-700 p-3 font-bold text-white" href={`/acompanhar/${success.public_code}`}>Acompanhar pedido</a></section></main>;

  return <main className="min-h-screen bg-[#fffaf5] pb-28">
    <header className="text-white" style={{ backgroundColor: company.primary_color || "#15803D" }}><div className="mx-auto max-w-6xl p-5 md:p-8"><a href={`/cardapio/${company.slug}`} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-white/90"><ArrowLeft size={17}/> Voltar ao cardápio</a><div className="flex items-center gap-5 md:gap-7">{company.logo_url ? <img src={company.logo_url} alt={`Logomarca da ${company.name}`} className="h-28 w-28 shrink-0 rounded-3xl border-4 border-white bg-white object-contain p-1 shadow-xl md:h-36 md:w-36"/> : <div className="grid h-28 w-28 shrink-0 place-items-center rounded-3xl border-4 border-white/30 bg-white/20 text-5xl shadow-xl md:h-36 md:w-36">🍔</div>}<div><p className="text-sm text-white/80">Combos MercadoFood</p><h1 className="text-2xl font-black sm:text-3xl md:text-4xl">{company.name}</h1><p className="text-sm">{company.is_open ? "🟢 Aberto agora" : "🔴 Fechado"}</p></div></div></div></header>
    <section className="mx-auto max-w-6xl p-4 md:p-6"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar combos" className="w-full rounded-2xl border bg-white p-4 shadow-sm"/><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleCombos.map(combo => <article key={combo.id} className="overflow-hidden rounded-3xl border bg-white shadow-sm"><div className="h-44 bg-orange-50">{combo.image_url ? <img src={combo.image_url} alt={combo.name} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-6xl">🍟</div>}</div><div className="p-5"><h2 className="text-xl font-black">{combo.name}</h2><p className="mt-1 min-h-10 text-sm text-gray-600">{combo.description}</p><div className="mt-4 flex items-center justify-between"><div>{combo.original_price && <span className="mr-2 text-xs text-gray-400 line-through">{money(Number(combo.original_price))}</span>}<strong className="text-lg text-green-700">{money(Number(combo.price))}</strong></div><button disabled={!company.is_open} onClick={() => { setSelectedCombo(combo); setSelection({}); setItemNotes(""); setError(""); }} className="rounded-xl bg-orange-500 px-4 py-2 font-bold text-white disabled:bg-gray-300">Montar combo</button></div></div></article>)}</div>{visibleCombos.length === 0 && <p className="mt-10 text-center text-gray-500">Nenhum combo encontrado.</p>}</section>
    {cart.length > 0 && <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4 shadow-2xl"><div className="mx-auto flex max-w-6xl items-center justify-between"><div><strong>{cart.reduce((sum,item)=>sum+item.quantity,0)} combo(s)</strong><p className="text-sm text-gray-600">Subtotal {money(subtotal)}</p></div><button onClick={()=>setCheckoutOpen(true)} className="flex items-center gap-2 rounded-xl bg-green-700 px-6 py-3 font-black text-white"><ShoppingCart size={18}/> Ver carrinho</button></div></div>}
    {selectedCombo && <div className="fixed inset-0 z-40 flex items-end bg-black/50 md:items-center md:justify-center"><section className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 md:max-w-xl md:rounded-3xl"><button onClick={()=>setSelectedCombo(null)} className="float-right text-2xl">×</button><h2 className="text-2xl font-black">{selectedCombo.name}</h2><p className="mt-2 text-gray-600">{selectedCombo.description}</p>{selectedCombo.groups.map(group => { const count=countSelection(selection,group.id); return <div key={group.id} className="mt-6"><div className="flex justify-between gap-3"><div><strong>{group.name}</strong><p className="text-sm text-gray-500">{group.description}</p></div><span className="text-right text-xs text-gray-500">{count}/{group.max_selection}<br/>{group.free_selection} incluído(s)</span></div><div className="mt-2 space-y-2">{group.products.map(product => { const quantity=selection[group.id]?.[product.id]||0; return <div key={product.id} className={`flex items-center justify-between rounded-xl border p-3 ${quantity>0?"border-green-600 bg-green-50":""}`}><div><p className="font-medium">{product.name}</p><span className="text-sm text-gray-600">{Number(product.price_delta)>0?`+ ${money(Number(product.price_delta))}`:"Incluído"}</span></div><div className="flex items-center gap-2"><button type="button" onClick={()=>setChoice(group,product,quantity-1)} className="rounded-full border bg-white p-2"><Minus size={15}/></button><strong className="w-5 text-center">{quantity}</strong><button type="button" disabled={count>=group.max_selection||quantity>=product.max_quantity} onClick={()=>setChoice(group,product,quantity+1)} className="rounded-full bg-green-700 p-2 text-white disabled:bg-gray-300"><Plus size={15}/></button></div></div>})}</div></div>})}<textarea value={itemNotes} onChange={event=>setItemNotes(event.target.value)} placeholder="Observação do combo" className="mt-5 w-full rounded-xl border p-3"/><div className="mt-4 rounded-2xl bg-gray-50 p-4"><div className="flex justify-between"><span>Combo</span><strong>{money(Number(selectedCombo.price))}</strong></div><div className="mt-1 flex justify-between"><span>Acréscimos</span><strong>{money(modalPrice.extrasUnitTotal)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><span>Total</span><strong>{money(Number(selectedCombo.price)+modalPrice.extrasUnitTotal)}</strong></div></div>{error&&<p className="mt-3 text-sm font-bold text-red-600">{error}</p>}<button onClick={addCombo} className="mt-5 w-full rounded-xl bg-orange-500 py-3 font-black text-white">Adicionar • {money(Number(selectedCombo.price)+modalPrice.extrasUnitTotal)}</button></section></div>}
    {checkoutOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3"><section className="mx-auto my-4 max-w-2xl rounded-3xl bg-white p-6"><button onClick={()=>setCheckoutOpen(false)} className="float-right text-2xl">×</button><h2 className="text-2xl font-black">Seus combos</h2><div className="mt-4 space-y-3">{cart.map(item=><div key={item.key} className="rounded-xl border p-3"><div className="flex justify-between"><div><strong>{item.combo.name}</strong><p className="text-sm text-gray-500">{money(Number(item.combo.price)+item.extrasUnitTotal)} por unidade</p></div><button onClick={()=>setCart(current=>current.filter(entry=>entry.key!==item.key))} className="text-red-600"><Trash2 size={17}/></button></div><ul className="mt-2 text-sm text-gray-600">{item.choices.map(choice=><li key={`${choice.groupId}-${choice.productId}`}>{choice.quantity}× {choice.productName}{choice.totalPrice>0?` • + ${money(choice.totalPrice)}`:""}</li>)}</ul><div className="mt-3 flex items-center justify-between border-t pt-3"><div className="flex items-center gap-2"><button onClick={()=>setCart(current=>current.map(entry=>entry.key===item.key?{...entry,quantity:Math.max(1,entry.quantity-1)}:entry))} className="rounded-full border p-2"><Minus size={15}/></button><strong>{item.quantity}</strong><button onClick={()=>setCart(current=>current.map(entry=>entry.key===item.key?{...entry,quantity:Math.min(99,entry.quantity+1)}:entry))} className="rounded-full bg-green-700 p-2 text-white"><Plus size={15}/></button></div><strong>{money((Number(item.combo.price)+item.extrasUnitTotal)*item.quantity)}</strong></div></div>)}</div><form action={submit} className="mt-6 space-y-4"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>setServiceType("delivery")} className={`rounded-xl border p-3 font-bold ${serviceType==="delivery"?"bg-green-700 text-white":""}`}>Entrega</button><button type="button" onClick={()=>setServiceType("pickup")} className={`rounded-xl border p-3 font-bold ${serviceType==="pickup"?"bg-green-700 text-white":""}`}>Retirada</button></div><input name="customer_name" required placeholder="Seu nome" className="w-full rounded-xl border p-3"/><input name="customer_phone" required placeholder="WhatsApp com DDD" className="w-full rounded-xl border p-3"/>{serviceType==="delivery"&&<div className="grid gap-3 sm:grid-cols-2"><input name="street" required placeholder="Rua" className="rounded-xl border p-3"/><input name="number" required placeholder="Número" className="rounded-xl border p-3"/><input name="neighborhood" required placeholder="Bairro" className="rounded-xl border p-3"/><input name="reference" placeholder="Referência" className="rounded-xl border p-3"/></div>}<select name="payment_method" className="w-full rounded-xl border p-3"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="card_on_delivery">Cartão na entrega</option></select><textarea name="notes" placeholder="Observação geral" className="w-full rounded-xl border p-3"/><label className="flex gap-2 text-sm"><input type="checkbox" name="marketing_consent"/> Quero receber promoções.</label><div className="rounded-2xl bg-gray-50 p-4"><div className="flex justify-between"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="mt-1 flex justify-between"><span>Entrega</span><strong>{money(deliveryFee)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><span>Total estimado</span><strong>{money(subtotal+deliveryFee)}</strong></div></div>{error&&<p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={pending} className="w-full rounded-xl bg-green-700 py-4 font-black text-white disabled:opacity-60">{pending?"Enviando...":"Confirmar pedido"}</button></form></section></div>}
  </main>;
}
