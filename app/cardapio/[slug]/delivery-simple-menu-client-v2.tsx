"use client";

import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { submitPublicOrder } from "./actions";

type FixedWeightOption = { quantity: number; unit: "g" | "kg"; price: number };
type Option = { id: string; name: string; price_delta: number; max_quantity?: number };
type Group = {
  id: string;
  name: string;
  description?: string;
  group_type?: "single" | "multiple" | "quantity";
  min_selection: number;
  max_selection: number;
  free_selection?: number;
  options: Option[];
};
type Product = {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  price: number;
  selling_mode?: "unit" | "weight" | "fixed_weight";
  reference_quantity?: number | null;
  reference_unit?: "g" | "kg" | null;
  minimum_sale_quantity?: number | null;
  sale_increment?: number | null;
  fixed_weight_options?: FixedWeightOption[];
  option_groups?: Group[];
};
type Category = { id: string; name: string; products: Product[] };
type DeliveryZone = { id: string; name: string; delivery_fee: number; minimum_order: number; estimated_minutes: number };
type ServiceConfig = { delivery_enabled: boolean; pickup_enabled: boolean; average_delivery_minutes: number };
type MenuData = { company: { name: string; slug: string; logo_url?: string; default_delivery_fee: number; is_open: boolean }; categories: Category[] };
type Selection = Record<string, Record<string, number>>;
type CartChoice = { optionId: string; name: string; quantity: number; chargedQuantity: number; total: number };
type CartItem = {
  key: string;
  product: Product;
  lineQuantity: number;
  saleQuantity: number;
  saleUnit: "unit" | "g" | "kg";
  baseUnitPrice: number;
  optionUnitTotal: number;
  choices: CartChoice[];
};

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const toGrams = (q: number, u: "g" | "kg") => u === "kg" ? q * 1000 : q;
function measure(q: number, u: "unit" | "g" | "kg") {
  if (u === "unit") return `${q} ${q === 1 ? "unidade" : "unidades"}`;
  if (u === "g" && q >= 1000 && q % 1000 === 0) return `${q / 1000} kg`;
  return `${q} ${u}`;
}
function proportionalPrice(product: Product, q: number, u: "g" | "kg") {
  const refQ = Number(product.reference_quantity || 0);
  const refU = product.reference_unit || "g";
  if (!refQ) return Number(product.price || 0);
  return Math.round((toGrams(q, u) / toGrams(refQ, refU)) * Number(product.price || 0) * 100) / 100;
}
function groupCount(selection: Selection, groupId: string) {
  return Object.values(selection[groupId] || {}).reduce((sum, q) => sum + q, 0);
}
function calculateChoices(product: Product, selection: Selection) {
  const choices: CartChoice[] = [];
  let optionUnitTotal = 0;
  for (const group of product.option_groups || []) {
    const selected = group.options.map(option => ({ option, quantity: selection[group.id]?.[option.id] || 0 })).filter(item => item.quantity > 0);
    let freeRemaining = Math.max(0, Number(group.free_selection || 0));
    const freeMap = new Map<string, number>();
    for (const item of [...selected].sort((a, b) => Number(b.option.price_delta) - Number(a.option.price_delta))) {
      const free = Math.min(item.quantity, freeRemaining);
      freeMap.set(item.option.id, free);
      freeRemaining -= free;
    }
    for (const item of selected) {
      const free = freeMap.get(item.option.id) || 0;
      const charged = item.quantity - free;
      const total = charged * Number(item.option.price_delta || 0);
      optionUnitTotal += total;
      choices.push({ optionId: item.option.id, name: item.option.name, quantity: item.quantity, chargedQuantity: charged, total });
    }
  }
  return { choices, optionUnitTotal };
}

export default function DeliverySimpleMenuClientV2({ menu, deliveryZones, serviceConfig }: { menu: MenuData; deliveryZones: DeliveryZone[]; serviceConfig: ServiceConfig }) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [weight, setWeight] = useState(100);
  const [fixedOption, setFixedOption] = useState<FixedWeightOption | null>(null);
  const [unitQuantity, setUnitQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Selection>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [serviceType, setServiceType] = useState(serviceConfig.delivery_enabled ? "delivery" : "pickup");
  const [deliveryZoneId, setDeliveryZoneId] = useState(deliveryZones[0]?.id || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ order_number: number; public_code: string; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const products = useMemo(() => menu.categories.flatMap(category => category.products)
    .filter(product => `${product.name} ${product.description || ""}`.toLowerCase().includes(query.toLowerCase())), [menu, query]);
  const subtotal = cart.reduce((sum, item) => sum + (item.baseUnitPrice + item.optionUnitTotal) * item.lineQuantity, 0);
  const selectedZone = deliveryZones.find(zone => zone.id === deliveryZoneId);
  const deliveryFee = serviceType === "delivery" ? Number(selectedZone?.delivery_fee ?? menu.company.default_delivery_fee ?? 0) : 0;
  const currentChoices = selected ? calculateChoices(selected, selectedOptions) : { choices: [], optionUnitTotal: 0 };

  function openProduct(product: Product) {
    setSelected(product); setError(""); setUnitQuantity(1); setSelectedOptions({});
    if (product.selling_mode === "weight") setWeight(Number(product.minimum_sale_quantity || product.sale_increment || 100));
    setFixedOption(product.selling_mode === "fixed_weight" ? product.fixed_weight_options?.[0] || null : null);
  }
  function setOption(group: Group, option: Option, next: number) {
    setSelectedOptions(previous => {
      const current = { ...(previous[group.id] || {}) };
      const old = current[option.id] || 0;
      const without = groupCount(previous, group.id) - old;
      const maxPerOption = Math.max(1, Number(option.max_quantity || 1));
      let value = Math.max(0, Math.min(maxPerOption, next));
      if (group.group_type === "single" || group.max_selection === 1) return { ...previous, [group.id]: value > 0 ? { [option.id]: 1 } : {} };
      value = Math.min(value, Math.max(0, group.max_selection - without));
      if (value === 0) delete current[option.id]; else current[option.id] = value;
      return { ...previous, [group.id]: current };
    });
  }
  function addSelected() {
    if (!selected) return;
    for (const group of selected.option_groups || []) {
      const count = groupCount(selectedOptions, group.id);
      if (count < group.min_selection) { setError(`Escolha pelo menos ${group.min_selection} item(ns) em ${group.name}.`); return; }
      if (count > group.max_selection) { setError(`Escolha no máximo ${group.max_selection} item(ns) em ${group.name}.`); return; }
    }
    const mode = selected.selling_mode || "unit";
    let saleQuantity = unitQuantity;
    let saleUnit: "unit" | "g" | "kg" = "unit";
    let baseUnitPrice = Number(selected.price || 0);
    let lineQuantity = unitQuantity;
    if (mode === "weight") {
      const minimum = Number(selected.minimum_sale_quantity || 0);
      const increment = Number(selected.sale_increment || 0);
      if (minimum && weight < minimum) { setError(`O mínimo é ${measure(minimum, selected.reference_unit || "g")}.`); return; }
      if (increment && minimum && ((weight - minimum) / increment) % 1 !== 0) { setError(`Escolha o peso de ${increment} em ${increment}.`); return; }
      saleQuantity = weight; saleUnit = selected.reference_unit || "g"; baseUnitPrice = proportionalPrice(selected, weight, saleUnit); lineQuantity = 1;
    } else if (mode === "fixed_weight") {
      if (!fixedOption) { setError("Selecione uma opção de peso."); return; }
      saleQuantity = fixedOption.quantity; saleUnit = fixedOption.unit; baseUnitPrice = Number(fixedOption.price);
    }
    setCart(items => [...items, { key: crypto.randomUUID(), product: selected, lineQuantity, saleQuantity, saleUnit, baseUnitPrice, optionUnitTotal: currentChoices.optionUnitTotal, choices: currentChoices.choices }]);
    setSelected(null);
  }
  function submit(formData: FormData) {
    setError("");
    const payload = {
      slug: menu.company.slug,
      customer_name: String(formData.get("customer_name") || ""), customer_phone: String(formData.get("customer_phone") || ""),
      service_type: serviceType, delivery_zone_id: serviceType === "delivery" ? deliveryZoneId : null,
      payment_method: String(formData.get("payment_method") || "pix"), notes: String(formData.get("notes") || ""),
      delivery_address: serviceType === "delivery" ? { street: String(formData.get("street") || ""), number: String(formData.get("number") || ""), complement: String(formData.get("complement") || ""), neighborhood: selectedZone?.name || String(formData.get("neighborhood") || ""), city: String(formData.get("city") || ""), reference: String(formData.get("reference") || "") } : {},
      items: cart.map(item => ({ product_id: item.product.id, quantity: item.lineQuantity, sale_quantity: item.saleQuantity, sale_unit: item.saleUnit, options: item.choices.map(choice => ({ option_id: choice.optionId, quantity: choice.quantity })) }))
    };
    startTransition(async () => {
      const result = await submitPublicOrder(payload);
      if (!result.ok) { setError(result.error); return; }
      setSuccess(result.data as never); setCart([]); setCheckoutOpen(false);
    });
  }

  if (success) return <main className="min-h-screen bg-slate-50 p-6 flex items-center justify-center"><section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><div className="text-5xl">✅</div><h1 className="mt-4 text-2xl font-black">Pedido recebido!</h1><p className="mt-2">Pedido <strong>#{success.order_number}</strong></p><p className="mt-2 text-xl font-black text-emerald-700">{money(Number(success.total))}</p><a href={`/acompanhar/${success.public_code}`} className="mt-6 block rounded-xl bg-emerald-700 p-3 font-bold text-white">Acompanhar pedido</a></section></main>;

  return <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
    <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3"><strong className="text-lg">Mercado<span className="text-orange-500">Food</span></strong><div className="relative ml-auto flex-1 max-w-md"><Search size={17} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto" className="w-full rounded-xl border py-2.5 pl-9 pr-3"/></div><button onClick={()=>cart.length&&setCheckoutOpen(true)} className="relative rounded-xl bg-emerald-700 p-3 text-white"><ShoppingCart size={19}/>{cart.length>0&&<span className="absolute -right-2 -top-2 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-black">{cart.length}</span>}</button></div></header>
    <section className="bg-emerald-900 text-white"><div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-7">{menu.company.logo_url&&<img src={menu.company.logo_url} alt={menu.company.name} className="h-16 w-16 rounded-2xl bg-white object-contain"/>}<div><p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Cardápio digital</p><h1 className="text-2xl font-black">{menu.company.name}</h1><p className="text-sm text-emerald-100">{menu.company.is_open ? "Aberto para pedidos" : "Loja fechada"}</p></div></div></section>
    <section className="mx-auto max-w-6xl p-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map(product=><article key={product.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">{product.image_url?<img src={product.image_url} alt={product.name} className="aspect-[16/9] w-full object-cover"/>:<div className="grid aspect-[16/9] place-items-center bg-emerald-50 text-5xl">🍽️</div>}<div className="p-4"><h2 className="font-black">{product.name}</h2>{product.description&&<p className="mt-1 line-clamp-2 text-sm text-slate-500">{product.description}</p>}<div className="mt-4 flex items-end justify-between"><div>{product.selling_mode==="weight"?<><strong className="text-lg text-emerald-700">{money(Number(product.price))}/{product.reference_quantity}{product.reference_unit}</strong><p className="text-xs text-slate-500">A partir de {measure(Number(product.minimum_sale_quantity||0),product.reference_unit||"g")}</p></>:product.selling_mode==="fixed_weight"?<><strong className="text-lg text-emerald-700">Escolha o peso</strong><p className="text-xs text-slate-500">Opções prontas</p></>:<strong className="text-lg text-emerald-700">{money(Number(product.price))}</strong>}</div><button onClick={()=>openProduct(product)} className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white"><Plus size={20}/></button></div>{(product.option_groups||[]).length>0&&<p className="mt-2 text-xs font-semibold text-orange-600">Personalizável com complementos</p>}</div></article>)}</div></section>
    {cart.length>0&&<button onClick={()=>setCheckoutOpen(true)} className="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center justify-between rounded-2xl bg-emerald-700 px-5 py-4 font-black text-white shadow-2xl"><span className="flex items-center gap-2"><ShoppingCart size={19}/>{cart.length} item(ns)</span><span>{money(subtotal)}</span></button>}

    {selected&&<div className="fixed inset-0 z-40 flex items-end bg-black/50 md:items-center md:justify-center"><section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 md:rounded-3xl"><button onClick={()=>setSelected(null)} className="float-right rounded-full p-2"><X/></button><h2 className="text-2xl font-black">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.description}</p>
      {(selected.selling_mode||"unit")==="weight"&&<div className="mt-6 rounded-2xl bg-emerald-50 p-5"><p className="font-bold">Quanto você deseja?</p><div className="mt-3 flex items-center justify-between"><button onClick={()=>setWeight(v=>Math.max(Number(selected.minimum_sale_quantity||1),v-Number(selected.sale_increment||1)))} className="rounded-full bg-white p-3 shadow"><Minus/></button><div className="text-center"><strong className="text-3xl">{measure(weight,selected.reference_unit||"g")}</strong><p className="text-sm text-slate-500">{money(proportionalPrice(selected,weight,selected.reference_unit||"g"))}</p></div><button onClick={()=>setWeight(v=>v+Number(selected.sale_increment||1))} className="rounded-full bg-emerald-700 p-3 text-white"><Plus/></button></div></div>}
      {selected.selling_mode==="fixed_weight"&&<div className="mt-6 grid gap-2">{(selected.fixed_weight_options||[]).map((option,index)=><button key={index} onClick={()=>setFixedOption(option)} className={`flex justify-between rounded-xl border p-3 text-left ${fixedOption===option?"border-emerald-600 bg-emerald-50":""}`}><span className="font-bold">{measure(option.quantity,option.unit)}</span><strong>{money(Number(option.price))}</strong></button>)}</div>}
      {(selected.selling_mode||"unit")!=="weight"&&<div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 p-4"><span className="font-bold">Quantidade</span><div className="flex items-center gap-3"><button onClick={()=>setUnitQuantity(v=>Math.max(1,v-1))} className="rounded-full border bg-white p-2"><Minus size={17}/></button><strong>{unitQuantity}</strong><button onClick={()=>setUnitQuantity(v=>Math.min(99,v+1))} className="rounded-full bg-emerald-700 p-2 text-white"><Plus size={17}/></button></div></div>}
      {(selected.option_groups||[]).map(group=>{const count=groupCount(selectedOptions,group.id);return <section key={group.id} className="mt-5 rounded-2xl border p-4"><div className="flex justify-between gap-3"><div><strong>{group.name}</strong>{group.description&&<p className="text-sm text-slate-500">{group.description}</p>}</div><span className="text-xs text-slate-500">{group.min_selection>0?"Obrigatório":"Opcional"}<br/>{count}/{group.max_selection}</span></div><div className="mt-3 space-y-2">{group.options.map(option=>{const quantity=selectedOptions[group.id]?.[option.id]||0;const quantityMode=group.group_type==="quantity"||Number(option.max_quantity||1)>1;return <div key={option.id} className={`flex items-center justify-between rounded-xl border p-3 ${quantity>0?"border-emerald-500 bg-emerald-50":""}`}><div><p className="font-medium">{option.name}</p><p className="text-xs text-slate-500">{Number(option.price_delta)>0?`+ ${money(Number(option.price_delta))}`:"Sem acréscimo"}</p></div>{quantityMode?<div className="flex items-center gap-2"><button onClick={()=>setOption(group,option,quantity-1)} className="rounded-full border bg-white p-2"><Minus size={14}/></button><strong>{quantity}</strong><button onClick={()=>setOption(group,option,quantity+1)} disabled={count>=group.max_selection||quantity>=Number(option.max_quantity||1)} className="rounded-full bg-emerald-700 p-2 text-white disabled:bg-slate-300"><Plus size={14}/></button></div>:<input type={group.max_selection===1?"radio":"checkbox"} checked={quantity>0} onChange={()=>setOption(group,option,quantity>0?0:1)} className="h-5 w-5"/>}</div>})}</div></section>})}
      <div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="flex justify-between"><span>Complementos</span><strong>{money(currentChoices.optionUnitTotal)}</strong></div></div>
      {error&&<p className="mt-3 text-sm font-bold text-red-600">{error}</p>}<button onClick={addSelected} className="mt-5 w-full rounded-xl bg-orange-500 py-4 font-black text-white">Adicionar ao carrinho</button></section></div>}

    {checkoutOpen&&<div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3"><section className="mx-auto my-4 max-w-2xl rounded-3xl bg-white p-6"><button onClick={()=>setCheckoutOpen(false)} className="float-right"><X/></button><h2 className="text-2xl font-black">Seu pedido</h2><div className="mt-4 space-y-3">{cart.map(item=><div key={item.key} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><div><strong>{item.product.name}</strong><p className="text-sm text-slate-500">{item.product.selling_mode==="fixed_weight"&&item.lineQuantity>1?`${item.lineQuantity} × ${measure(item.saleQuantity,item.saleUnit)}`:measure(item.saleQuantity,item.saleUnit)}</p>{item.choices.length>0&&<ul className="mt-2 text-xs text-slate-500">{item.choices.map(choice=><li key={choice.optionId}>{choice.quantity}× {choice.name}{choice.total>0?` (+ ${money(choice.total)})`:""}</li>)}</ul>}</div><div className="text-right"><strong>{money((item.baseUnitPrice+item.optionUnitTotal)*item.lineQuantity)}</strong><button onClick={()=>setCart(items=>items.filter(x=>x.key!==item.key))} className="ml-2 text-red-600"><Trash2 size={16}/></button></div></div></div>)}</div><div className="mt-4 flex justify-between border-t pt-4 text-lg"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
      <form action={submit} className="mt-6 space-y-4"><div className="grid grid-cols-2 gap-2"><button type="button" disabled={!serviceConfig.delivery_enabled} onClick={()=>setServiceType("delivery")} className={`rounded-xl border p-3 font-bold ${serviceType==="delivery"?"bg-emerald-700 text-white":""}`}>Entrega</button><button type="button" disabled={!serviceConfig.pickup_enabled} onClick={()=>setServiceType("pickup")} className={`rounded-xl border p-3 font-bold ${serviceType==="pickup"?"bg-emerald-700 text-white":""}`}>Retirada</button></div><input name="customer_name" required placeholder="Nome" className="w-full rounded-xl border p-3"/><input name="customer_phone" required placeholder="WhatsApp" className="w-full rounded-xl border p-3"/>{serviceType==="delivery"&&<div className="grid gap-3 sm:grid-cols-2"><input name="street" required placeholder="Rua" className="rounded-xl border p-3"/><input name="number" required placeholder="Número" className="rounded-xl border p-3"/>{deliveryZones.length?<select value={deliveryZoneId} onChange={e=>setDeliveryZoneId(e.target.value)} className="rounded-xl border p-3"><option value="">Bairro</option>{deliveryZones.map(zone=><option key={zone.id} value={zone.id}>{zone.name} · {money(Number(zone.delivery_fee))}</option>)}</select>:<input name="neighborhood" required placeholder="Bairro" className="rounded-xl border p-3"/>}<input name="city" required placeholder="Cidade" className="rounded-xl border p-3"/><input name="complement" placeholder="Complemento" className="rounded-xl border p-3"/><input name="reference" placeholder="Referência" className="rounded-xl border p-3"/></div>}<select name="payment_method" className="w-full rounded-xl border p-3"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="card_on_delivery">Cartão</option></select><textarea name="notes" placeholder="Observações" className="w-full rounded-xl border p-3"/><div className="rounded-2xl bg-slate-50 p-4"><div className="flex justify-between"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="mt-1 flex justify-between"><span>Entrega</span><strong>{money(deliveryFee)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><span>Total</span><strong>{money(subtotal+deliveryFee)}</strong></div></div>{error&&<p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={pending||!menu.company.is_open||cart.length===0} className="w-full rounded-xl bg-emerald-700 py-4 font-black text-white disabled:bg-slate-300">{pending?"Enviando...":`Confirmar pedido · ${money(subtotal+deliveryFee)}`}</button></form></section></div>}
  </main>;
}
