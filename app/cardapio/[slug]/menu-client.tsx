"use client";

import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { submitPublicOrder } from "./actions";
import { PublicFeedback } from "@/components/feedback/public-feedback";

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
  image_fit?: "cover" | "contain";
  image_position?: "center" | "top" | "bottom" | "left" | "right";
  price: number;
  original_price?: number | null;
  preparation_time?: number;
  is_featured?: boolean;
  option_groups: Group[];
};
type Category = { id: string; name: string; description?: string; products: Product[] };
type DeliveryZone = { id:string; name:string; delivery_fee:number; minimum_order:number; estimated_minutes:number };
type ServiceConfig = { delivery_enabled:boolean; pickup_enabled:boolean; average_delivery_minutes:number };
type MenuData = {
  company: {
    name: string;
    slug: string;
    logo_url?: string;
    banner_url?: string;
    primary_color?: string;
    accent_color?: string;
    menu_message?: string;
    delivery_minimum: number;
    default_delivery_fee: number;
    is_open: boolean;
  };
  categories: Category[];
  promotions: { id: string; title: string; description?: string; image_url?: string }[];
};
type Selection = Record<string, Record<string, number>>;
type CartChoice = { groupId: string; groupName: string; optionId: string; optionName: string; quantity: number; unitPrice: number; chargedQuantity: number; totalPrice: number };
type CartItem = { key: string; product: Product; quantity: number; choices: CartChoice[]; notes: string; optionUnitTotal: number };

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function groupSelectionCount(selection: Selection, groupId: string) {
  return Object.values(selection[groupId] || {}).reduce((sum, quantity) => sum + quantity, 0);
}

function calculateChoices(product: Product, selection: Selection): { choices: CartChoice[]; optionUnitTotal: number } {
  const choices: CartChoice[] = [];
  let optionUnitTotal = 0;

  for (const group of product.option_groups || []) {
    const quantities = selection[group.id] || {};
    const selected = group.options
      .map(option => ({ option, quantity: quantities[option.id] || 0 }))
      .filter(item => item.quantity > 0);

    // Regra transparente: as unidades grátis são aplicadas primeiro às opções de maior valor.
    let freeRemaining = Math.max(0, Number(group.free_selection || 0));
    const freeByOption = new Map<string, number>();
    for (const item of [...selected].sort((a, b) => Number(b.option.price_delta) - Number(a.option.price_delta))) {
      const freeQuantity = Math.min(item.quantity, freeRemaining);
      freeByOption.set(item.option.id, freeQuantity);
      freeRemaining -= freeQuantity;
    }

    for (const { option, quantity } of selected) {
      const freeQuantity = freeByOption.get(option.id) || 0;
      const chargedQuantity = quantity - freeQuantity;
      const totalPrice = chargedQuantity * Number(option.price_delta || 0);
      optionUnitTotal += totalPrice;
      choices.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        quantity,
        unitPrice: Number(option.price_delta || 0),
        chargedQuantity,
        totalPrice
      });
    }
  }

  return { choices, optionUnitTotal };
}

export default function MenuClient({ menu, deliveryZones, hasCombos, serviceConfig }: { menu: MenuData; deliveryZones: DeliveryZone[]; hasCombos: boolean; serviceConfig: ServiceConfig }) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductQuantity, setSelectedProductQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Selection>({});
  const [itemNotes, setItemNotes] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [serviceType, setServiceType] = useState(serviceConfig.delivery_enabled ? "delivery" : "pickup");
  const [deliveryZoneId, setDeliveryZoneId] = useState(deliveryZones[0]?.id || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);
  const [pending, startTransition] = useTransition();

  const products = useMemo(() => menu.categories
    .flatMap(category => category.products.map(product => ({ ...product, categoryId: category.id })))
    .filter(product => (categoryId === "all" || product.categoryId === categoryId)
      && `${product.name} ${product.description || ""}`.toLowerCase().includes(query.toLowerCase())), [menu, categoryId, query]);

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.product.price) + item.optionUnitTotal) * item.quantity, 0);
  const selectedZone = deliveryZones.find(zone => zone.id === deliveryZoneId);
  const deliveryFee = serviceType === "delivery" ? Number(selectedZone?.delivery_fee ?? menu.company.default_delivery_fee ?? 0) : 0;
  const modalPricing = selectedProduct ? calculateChoices(selectedProduct, selectedOptions) : { choices: [], optionUnitTotal: 0 };
  const productQuantities = useMemo(() => cart.reduce<Record<string, number>>((totals, item) => {
    totals[item.product.id] = (totals[item.product.id] || 0) + item.quantity;
    return totals;
  }, {}), [cart]);

  function openProduct(product: Product) {
    setSelectedProduct(product);
    setSelectedProductQuantity(1);
    setSelectedOptions({});
    setItemNotes("");
    setError("");
  }

  function setOptionQuantity(group: Group, option: Option, nextQuantity: number) {
    setSelectedOptions(previous => {
      const currentGroup = { ...(previous[group.id] || {}) };
      const currentQuantity = currentGroup[option.id] || 0;
      const groupTotalWithoutOption = groupSelectionCount(previous, group.id) - currentQuantity;
      const maxPerOption = Math.max(1, Number(option.max_quantity || 1));
      let quantity = Math.max(0, Math.min(maxPerOption, nextQuantity));

      if (group.group_type === "single" || group.max_selection === 1) {
        return { ...previous, [group.id]: quantity > 0 ? { [option.id]: 1 } : {} };
      }

      quantity = Math.min(quantity, Math.max(0, group.max_selection - groupTotalWithoutOption));
      if (quantity === 0) delete currentGroup[option.id];
      else currentGroup[option.id] = quantity;
      return { ...previous, [group.id]: currentGroup };
    });
  }

  function addSelectedProduct() {
    if (!selectedProduct) return;
    for (const group of selectedProduct.option_groups || []) {
      const count = groupSelectionCount(selectedOptions, group.id);
      if (count < group.min_selection) {
        setError(`Escolha pelo menos ${group.min_selection} unidade(s) em “${group.name}”.`);
        return;
      }
      if (count > group.max_selection) {
        setError(`Escolha no máximo ${group.max_selection} unidade(s) em “${group.name}”.`);
        return;
      }
    }

    const pricing = calculateChoices(selectedProduct, selectedOptions);
    setCart(previous => [...previous, {
      key: crypto.randomUUID(),
      product: selectedProduct,
      quantity: selectedProductQuantity,
      choices: pricing.choices,
      optionUnitTotal: pricing.optionUnitTotal,
      notes: itemNotes
    }]);
    setSelectedProduct(null);
    setError("");
  }

  function changeCartQuantity(key: string, delta: number) {
    setCart(previous => previous
      .map(item => item.key === key ? { ...item, quantity: Math.max(0, Math.min(99, item.quantity + delta)) } : item)
      .filter(item => item.quantity > 0));
  }

  function changeProductQuantity(productId: string, delta: number) {
    setCart(previous => {
      const matchingIndex = previous.findIndex(item => item.product.id === productId);
      if (matchingIndex < 0) return previous;
      const next = [...previous];
      const item = next[matchingIndex];
      const quantity = Math.max(0, Math.min(99, item.quantity + delta));
      if (quantity === 0) next.splice(matchingIndex, 1);
      else next[matchingIndex] = { ...item, quantity };
      return next;
    });
  }

  function submit(formData: FormData) {
    setError("");
    const payload = {
      slug: menu.company.slug,
      customer_name: String(formData.get("customer_name") || ""),
      customer_phone: String(formData.get("customer_phone") || ""),
      service_type: serviceType,
      delivery_zone_id: serviceType === 'delivery' ? deliveryZoneId : null,
      payment_method: String(formData.get("payment_method") || "pix"),
      coupon_code: String(formData.get("coupon_code") || ""),
      notes: String(formData.get("notes") || ""),
      marketing_consent: formData.get("marketing_consent") === "on",
      delivery_address: {
        cep: String(formData.get("cep") || ""),
        street: String(formData.get("street") || ""),
        number: String(formData.get("number") || ""),
        complement: String(formData.get("complement") || ""),
        neighborhood: selectedZone?.name || String(formData.get("neighborhood") || ""),
        city: String(formData.get("city") || ""),
        reference: String(formData.get("reference") || "")
      },
      items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        notes: item.notes,
        options: item.choices.map(choice => ({ option_id: choice.optionId, quantity: choice.quantity }))
      }))
    };

    startTransition(async () => {
      const result = await submitPublicOrder(payload);
      if (!result.ok) { setError(result.error); return; }
      setSuccess(result.data);
      setCart([]);
      setCheckoutOpen(false);
    });
  }

  if (success) return (
    <main className="min-h-screen bg-[#fffaf5] p-6 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl border border-green-100">
        <div className="text-6xl">✅</div>
        <h1 className="mt-4 text-3xl font-black text-gray-900">Pedido recebido!</h1>
        <p className="mt-2 text-gray-600">Pedido <strong>#{success.order_number}</strong></p>
        <p className="mt-1 text-xl font-bold text-green-700">{money(Number(success.total))}</p>
        <a href={`/acompanhar/${success.public_code}`} className="mt-6 block rounded-xl bg-green-700 px-5 py-3 font-bold text-white">Acompanhar pedido</a>
        <button onClick={() => setSuccess(null)} className="mt-3 text-sm font-semibold text-gray-600">Fazer outro pedido</button>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#fffaf5] pb-28">
      <header className="text-white" style={{ backgroundColor: menu.company.primary_color || "#15803D" }}>
        <div className="mx-auto max-w-6xl p-5 md:p-8">
          <div className="flex items-center gap-5 md:gap-7">
            {menu.company.logo_url ? <img src={menu.company.logo_url} alt={`Logomarca da ${menu.company.name}`} className="h-28 w-28 shrink-0 rounded-3xl border-4 border-white bg-white object-contain p-1 shadow-xl md:h-36 md:w-36" /> : <div className="grid h-28 w-28 shrink-0 place-items-center rounded-3xl border-4 border-white/30 bg-white/20 text-5xl shadow-xl md:h-36 md:w-36">🍔</div>}
            <div><p className="text-sm text-white/80">Cardápio MercadoFood</p><h1 className="text-2xl font-black sm:text-3xl md:text-4xl">{menu.company.name}</h1><p className="mt-1 text-sm">{menu.company.is_open ? "🟢 Aberto agora" : "🔴 Fechado no momento"}</p></div>
          </div>
          {menu.company.menu_message && <p className="mt-4 rounded-xl bg-white/10 p-3">{menu.company.menu_message}</p>}
        </div>
      </header>

      {menu.company.banner_url && <section className="mx-auto max-w-6xl px-4 pt-5 md:px-6">
        <div className="aspect-[16/7] max-h-[420px] overflow-hidden rounded-3xl border-4 border-white bg-white shadow-lg">
          <img src={menu.company.banner_url} alt={`Banner da ${menu.company.name}`} className="h-full w-full object-cover"/>
        </div>
      </section>}

      <section className="mx-auto max-w-6xl p-4 md:p-6">
        {menu.promotions.length > 0 && <div className="mb-5 flex gap-3 overflow-x-auto pb-2">{menu.promotions.map(promotion => <article key={promotion.id} className="min-w-[260px] overflow-hidden rounded-2xl bg-orange-100">{promotion.image_url && <img src={promotion.image_url} alt={promotion.title} className="aspect-[16/7] w-full object-cover"/>}<div className="p-4"><strong>{promotion.title}</strong><p className="text-sm text-gray-700">{promotion.description}</p></div></article>)}</div>}
        {hasCombos && <a href={`/cardapio/${menu.company.slug}/combos`} className="mb-5 flex items-center justify-between rounded-2xl bg-gradient-to-r from-orange-500 to-orange-400 p-5 text-white shadow-sm"><div><p className="text-sm font-bold text-white/80">Monte do seu jeito</p><strong className="text-xl">Ver combos completos</strong></div><span className="rounded-xl bg-white/20 px-4 py-2 font-black">Abrir →</span></a>}
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no cardápio" className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm outline-none focus:ring-2 focus:ring-green-600" />
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setCategoryId("all")} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${categoryId === "all" ? "bg-green-700 text-white" : "bg-white border"}`}>Todos</button>
          {menu.categories.map(category => <button key={category.id} onClick={() => setCategoryId(category.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${categoryId === category.id ? "bg-green-700 text-white" : "bg-white border"}`}>{category.name}</button>)}
        </nav>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map(product => {
            const quantityInCart = productQuantities[product.id] || 0;
            return <article key={product.id} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="aspect-square bg-white p-2">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-contain" style={{ objectPosition: product.image_position || "center" }} /> : <div className="grid h-full place-items-center bg-orange-50 text-6xl">🍽️</div>}</div>
            <div className="p-5"><h2 className="text-lg font-black">{product.name}</h2><p className="mt-1 min-h-10 text-sm text-gray-600">{product.description}</p>
              <div className="mt-4 flex items-center justify-between gap-3"><div>{product.original_price && <span className="mr-2 text-xs text-gray-400 line-through">{money(Number(product.original_price))}</span>}<strong className="text-lg text-green-700">{money(Number(product.price))}</strong></div>
                {quantityInCart > 0 ? <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 p-1" aria-label={`Quantidade de ${product.name}`}>
                  <button type="button" aria-label={`Diminuir ${product.name}`} onClick={() => changeProductQuantity(product.id, -1)} className="grid h-9 w-9 place-items-center rounded-full bg-white text-green-800 shadow-sm"><Minus size={17} /></button>
                  <strong className="min-w-6 text-center text-green-800">{quantityInCart}</strong>
                  <button type="button" aria-label={`Aumentar ${product.name}`} onClick={() => changeProductQuantity(product.id, 1)} className="grid h-9 w-9 place-items-center rounded-full bg-green-700 text-white"><Plus size={17} /></button>
                </div> : <button onClick={() => openProduct(product)} className="rounded-xl bg-orange-500 px-4 py-2 font-bold text-white">Adicionar</button>}
              </div>
              {quantityInCart > 0 && (product.option_groups || []).length > 0 && <button type="button" onClick={() => openProduct(product)} className="mt-3 w-full text-sm font-bold text-orange-600">+ Adicionar outra opção</button>}
            </div>
          </article>})}
        </div>
        {!products.length && <div className="mt-6 rounded-2xl border border-dashed bg-white p-10 text-center text-gray-500">Nenhum produto encontrado nesta seleção.</div>}
      </section>

      {cart.length > 0 && <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white p-3 shadow-2xl md:p-4"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><div><strong>{cart.reduce((sum, item) => sum + item.quantity, 0)} item(ns)</strong><p className="text-sm text-gray-600">Subtotal {money(subtotal)}</p></div><button onClick={() => setCheckoutOpen(true)} className="flex items-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-sm font-black text-white md:px-6 md:text-base"><ShoppingCart size={18} /> Ver carrinho e finalizar</button></div></div>}

      {selectedProduct && <div className="fixed inset-0 z-40 flex items-end bg-black/50 md:items-center md:justify-center"><section className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 md:max-w-xl md:rounded-3xl"><button onClick={() => setSelectedProduct(null)} className="float-right text-2xl">×</button><h2 className="text-2xl font-black">{selectedProduct.name}</h2><p className="mt-2 text-gray-600">{selectedProduct.description}</p>
        {(selectedProduct.option_groups || []).map(group => {
          const count = groupSelectionCount(selectedOptions, group.id);
          return <div key={group.id} className="mt-6"><div className="flex items-start justify-between gap-3"><div><strong>{group.name}</strong>{group.description && <p className="text-sm text-gray-500">{group.description}</p>}</div><span className="text-right text-xs text-gray-500">{group.min_selection > 0 ? "Obrigatório" : "Opcional"}<br />{count}/{group.max_selection} escolhido(s){Number(group.free_selection || 0) > 0 && <> • {group.free_selection} grátis</>}</span></div>
            <div className="mt-2 space-y-2">{group.options.map(option => {
              const quantity = selectedOptions[group.id]?.[option.id] || 0;
              const quantityMode = group.group_type === "quantity" || Number(option.max_quantity || 1) > 1;
              return <div key={option.id} className={`flex items-center justify-between rounded-xl border p-3 ${quantity > 0 ? "border-green-600 bg-green-50" : ""}`}><div><p className="font-medium">{option.name}</p><span className="text-sm text-gray-600">{Number(option.price_delta) > 0 ? `+ ${money(Number(option.price_delta))} por unidade` : "Sem acréscimo"}</span></div>
                {quantityMode ? <div className="flex items-center gap-2"><button type="button" onClick={() => setOptionQuantity(group, option, quantity - 1)} className="rounded-full border bg-white p-2"><Minus size={15} /></button><strong className="w-5 text-center">{quantity}</strong><button type="button" onClick={() => setOptionQuantity(group, option, quantity + 1)} disabled={count >= group.max_selection || quantity >= Number(option.max_quantity || 1)} className="rounded-full bg-green-700 p-2 text-white disabled:bg-gray-300"><Plus size={15} /></button></div>
                  : <input type={group.max_selection === 1 ? "radio" : "checkbox"} name={group.id} checked={quantity > 0} onChange={() => setOptionQuantity(group, option, quantity > 0 ? 0 : 1)} className="h-5 w-5" />}
              </div>})}</div>
          </div>})}
        <textarea value={itemNotes} onChange={event => setItemNotes(event.target.value)} placeholder="Observação do item" className="mt-5 w-full rounded-xl border p-3" />
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 p-4">
          <div><strong>Quantidade</strong><p className="text-sm text-gray-600">Escolha quantas unidades deseja.</p></div>
          <div className="flex items-center gap-3"><button type="button" aria-label="Diminuir quantidade" onClick={() => setSelectedProductQuantity(value => Math.max(1, value - 1))} className="grid h-10 w-10 place-items-center rounded-full bg-white text-green-800 shadow-sm"><Minus size={18} /></button><strong className="min-w-7 text-center text-lg">{selectedProductQuantity}</strong><button type="button" aria-label="Aumentar quantidade" onClick={() => setSelectedProductQuantity(value => Math.min(99, value + 1))} className="grid h-10 w-10 place-items-center rounded-full bg-green-700 text-white"><Plus size={18} /></button></div>
        </div>
        <div className="mt-4 rounded-2xl bg-gray-50 p-4"><div className="flex justify-between"><span>Produto</span><strong>{money(Number(selectedProduct.price))}</strong></div><div className="mt-1 flex justify-between"><span>Complementos cobrados</span><strong>{money(modalPricing.optionUnitTotal)}</strong></div><div className="mt-1 flex justify-between"><span>Quantidade</span><strong>{selectedProductQuantity}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><span>Total</span><strong>{money((Number(selectedProduct.price) + modalPricing.optionUnitTotal) * selectedProductQuantity)}</strong></div>{selectedProduct.option_groups.some(group => Number(group.free_selection || 0) > 0) && <p className="mt-2 text-xs text-gray-500">As unidades grátis são aplicadas automaticamente às opções selecionadas de maior valor.</p>}</div>
        {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}<button onClick={addSelectedProduct} className="mt-5 w-full rounded-xl bg-orange-500 py-3 font-black text-white">Adicionar ao carrinho • {money((Number(selectedProduct.price) + modalPricing.optionUnitTotal) * selectedProductQuantity)}</button></section></div>}

      {checkoutOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3"><section className="mx-auto my-4 max-w-2xl rounded-3xl bg-white p-5 md:p-6"><button onClick={() => setCheckoutOpen(false)} aria-label="Fechar carrinho" className="float-right text-2xl">×</button><p className="text-sm font-bold uppercase tracking-wide text-green-700">Carrinho e checkout</p><h2 className="text-2xl font-black">Revise e finalize seu pedido</h2><p className="mt-1 text-sm text-gray-600">Confira as quantidades e depois informe seus dados.</p>
        <div className="mt-4 space-y-3">{cart.map(item => <div key={item.key} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div><strong>{item.product.name}</strong><p className="text-sm text-gray-500">{money(Number(item.product.price) + item.optionUnitTotal)} por unidade</p></div><button onClick={() => setCart(current => current.filter(entry => entry.key !== item.key))} className="rounded-lg p-2 text-red-600"><Trash2 size={17} /></button></div>
          {item.choices.length > 0 && <ul className="mt-2 space-y-1 text-sm text-gray-600">{item.choices.map(choice => <li key={`${choice.groupId}-${choice.optionId}`}>{choice.quantity}× {choice.optionName}{choice.chargedQuantity === 0 ? " — grátis" : choice.chargedQuantity < choice.quantity ? ` — ${choice.quantity - choice.chargedQuantity} grátis` : choice.totalPrice > 0 ? ` — + ${money(choice.totalPrice)}` : ""}</li>)}</ul>}
          {item.notes && <p className="mt-2 text-sm italic text-gray-500">Obs.: {item.notes}</p>}
          <div className="mt-3 flex items-center justify-between border-t pt-3"><div className="flex items-center gap-2"><button type="button" onClick={() => changeCartQuantity(item.key, -1)} className="rounded-full border p-2"><Minus size={15} /></button><strong>{item.quantity}</strong><button type="button" onClick={() => changeCartQuantity(item.key, 1)} className="rounded-full bg-green-700 p-2 text-white"><Plus size={15} /></button></div><strong>{money((Number(item.product.price) + item.optionUnitTotal) * item.quantity)}</strong></div>
        </div>)}</div>
        <form action={submit} className="mt-6 space-y-4">
          <h3 className="border-b pb-2 text-lg font-black">1. Entrega ou retirada</h3>
          <div className="grid grid-cols-2 gap-2"><button type="button" disabled={!serviceConfig.delivery_enabled} onClick={() => setServiceType("delivery")} className={`rounded-xl border p-3 font-bold disabled:bg-gray-100 disabled:text-gray-400 ${serviceType === "delivery" ? "bg-green-700 text-white" : ""}`}>Entrega</button><button type="button" disabled={!serviceConfig.pickup_enabled} onClick={() => setServiceType("pickup")} className={`rounded-xl border p-3 font-bold disabled:bg-gray-100 disabled:text-gray-400 ${serviceType === "pickup" ? "bg-green-700 text-white" : ""}`}>Retirada</button></div>
          <h3 className="border-b pb-2 pt-2 text-lg font-black">2. Seus dados</h3>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-gray-700">Nome<input name="customer_name" required placeholder="Seu nome completo" className="mt-1 w-full rounded-xl border p-3 font-normal" /></label><label className="text-sm font-bold text-gray-700">Telefone/WhatsApp<input name="customer_phone" required inputMode="tel" placeholder="(79) 99999-9999" className="mt-1 w-full rounded-xl border p-3 font-normal" /></label></div>
          {serviceType === "delivery" && <><h3 className="border-b pb-2 pt-2 text-lg font-black">3. Endereço de entrega</h3><div className="grid gap-3 sm:grid-cols-2"><input name="cep" inputMode="numeric" placeholder="CEP" className="rounded-xl border p-3" /><input name="street" required placeholder="Rua ou avenida" className="rounded-xl border p-3" /><input name="number" required placeholder="Número" className="rounded-xl border p-3" /><input name="complement" placeholder="Complemento (opcional)" className="rounded-xl border p-3" />{deliveryZones.length ? <select name="delivery_zone_id" required value={deliveryZoneId} onChange={event=>setDeliveryZoneId(event.target.value)} className="rounded-xl border p-3"><option value="">Selecione o bairro</option>{deliveryZones.map(zone=><option key={zone.id} value={zone.id}>{zone.name} · {money(Number(zone.delivery_fee))} · {zone.estimated_minutes} min</option>)}</select> : <input name="neighborhood" required placeholder="Bairro" className="rounded-xl border p-3" />}<input name="city" required placeholder="Cidade" className="rounded-xl border p-3" /><input name="reference" placeholder="Ponto de referência" className="rounded-xl border p-3 sm:col-span-2" />{selectedZone && subtotal < Number(selectedZone.minimum_order) && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">Pedido mínimo para {selectedZone.name}: {money(Number(selectedZone.minimum_order))}</p>}</div></>}
          <h3 className="border-b pb-2 pt-2 text-lg font-black">{serviceType === "delivery" ? "4" : "3"}. Pagamento</h3>
          <label className="text-sm font-bold text-gray-700">Como deseja pagar?<select name="payment_method" className="mt-1 w-full rounded-xl border p-3 font-normal"><option value="pix">PIX</option><option value="cash">Dinheiro na entrega/retirada</option><option value="card_on_delivery">Cartão na entrega/retirada</option></select></label>
          <input name="coupon_code" placeholder="Cupom de desconto" className="w-full rounded-xl border p-3 uppercase" /><textarea name="notes" placeholder="Observação geral" className="w-full rounded-xl border p-3" /><label className="flex gap-2 text-sm"><input type="checkbox" name="marketing_consent" /> Quero receber promoções da loja.</label><label className="flex gap-2 text-sm"><input type="checkbox" required /> Confirmo os dados do pedido e aceito os <a href="/termos" target="_blank" className="font-semibold text-green-700 underline">termos de uso</a>.</label>
          <div className="rounded-2xl bg-gray-50 p-4"><div className="flex justify-between"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="mt-1 flex justify-between"><span>Entrega</span><strong>{money(deliveryFee)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><span>Total estimado</span><strong>{money(subtotal + deliveryFee)}</strong></div></div>
          {!menu.company.is_open && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">A loja está fechada no momento. Você pode montar e revisar o carrinho, mas o envio será liberado quando ela abrir.</p>}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={pending || !menu.company.is_open || cart.length === 0} className="w-full rounded-xl bg-green-700 py-4 font-black text-white disabled:bg-gray-300 disabled:text-gray-600">{pending ? "Enviando pedido..." : menu.company.is_open ? `Confirmar pedido • ${money(subtotal + deliveryFee)}` : "Loja fechada"}</button>
        </form></section></div>}
      <PublicFeedback slug={menu.company.slug} companyName={menu.company.name}/>
      <footer className="mx-auto max-w-6xl px-5 pb-6 text-center text-xs text-gray-500"><a href="/termos" className="underline">Termos de uso</a> · <a href="/privacidade" className="underline">Privacidade</a> · Cardápio por MercadoFood</footer>
    </main>
  );
}
