"use client";

import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { submitPublicOrder } from "./actions";

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
  original_price?: number | null;
  preparation_time?: number;
  is_featured?: boolean;
  option_groups: Group[];
};
type Category = { id: string; name: string; description?: string; products: Product[] };
type MenuData = {
  company: {
    name: string;
    slug: string;
    logo_url?: string;
    primary_color?: string;
    accent_color?: string;
    menu_message?: string;
    delivery_minimum: number;
    default_delivery_fee: number;
    is_open: boolean;
  };
  categories: Category[];
  promotions: { id: string; title: string; description?: string }[];
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

export default function MenuClient({ menu }: { menu: MenuData }) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Selection>({});
  const [itemNotes, setItemNotes] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [serviceType, setServiceType] = useState("delivery");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);
  const [pending, startTransition] = useTransition();

  const products = useMemo(() => menu.categories
    .flatMap(category => category.products.map(product => ({ ...product, categoryId: category.id })))
    .filter(product => (categoryId === "all" || product.categoryId === categoryId)
      && `${product.name} ${product.description || ""}`.toLowerCase().includes(query.toLowerCase())), [menu, categoryId, query]);

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.product.price) + item.optionUnitTotal) * item.quantity, 0);
  const deliveryFee = serviceType === "delivery" ? Number(menu.company.default_delivery_fee || 0) : 0;
  const modalPricing = selectedProduct ? calculateChoices(selectedProduct, selectedOptions) : { choices: [], optionUnitTotal: 0 };

  function openProduct(product: Product) {
    setSelectedProduct(product);
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
      quantity: 1,
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

  function submit(formData: FormData) {
    setError("");
    const payload = {
      slug: menu.company.slug,
      customer_name: String(formData.get("customer_name") || ""),
      customer_phone: String(formData.get("customer_phone") || ""),
      service_type: serviceType,
      payment_method: String(formData.get("payment_method") || "pix"),
      coupon_code: String(formData.get("coupon_code") || ""),
      notes: String(formData.get("notes") || ""),
      marketing_consent: formData.get("marketing_consent") === "on",
      delivery_address: {
        street: String(formData.get("street") || ""),
        number: String(formData.get("number") || ""),
        neighborhood: String(formData.get("neighborhood") || ""),
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

      <section className="mx-auto max-w-6xl p-4 md:p-6">
        {menu.promotions.length > 0 && <div className="mb-5 flex gap-3 overflow-x-auto pb-2">{menu.promotions.map(promotion => <article key={promotion.id} className="min-w-[260px] rounded-2xl bg-orange-100 p-4"><strong>{promotion.title}</strong><p className="text-sm text-gray-700">{promotion.description}</p></article>)}</div>}
        <a href={`/cardapio/${menu.company.slug}/combos`} className="mb-5 flex items-center justify-between rounded-2xl bg-gradient-to-r from-orange-500 to-orange-400 p-5 text-white shadow-sm"><div><p className="text-sm font-bold text-white/80">Monte do seu jeito</p><strong className="text-xl">Ver combos completos</strong></div><span className="rounded-xl bg-white/20 px-4 py-2 font-black">Abrir →</span></a>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no cardápio" className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm outline-none focus:ring-2 focus:ring-green-600" />
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setCategoryId("all")} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${categoryId === "all" ? "bg-green-700 text-white" : "bg-white border"}`}>Todos</button>
          {menu.categories.map(category => <button key={category.id} onClick={() => setCategoryId(category.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${categoryId === category.id ? "bg-green-700 text-white" : "bg-white border"}`}>{category.name}</button>)}
        </nav>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map(product => <article key={product.id} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="h-44 bg-orange-50">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-6xl">🍽️</div>}</div>
            <div className="p-5"><h2 className="text-lg font-black">{product.name}</h2><p className="mt-1 min-h-10 text-sm text-gray-600">{product.description}</p>
              <div className="mt-4 flex items-center justify-between"><div>{product.original_price && <span className="mr-2 text-xs text-gray-400 line-through">{money(Number(product.original_price))}</span>}<strong className="text-lg text-green-700">{money(Number(product.price))}</strong></div><button disabled={!menu.company.is_open} onClick={() => openProduct(product)} className="rounded-xl bg-orange-500 px-4 py-2 font-bold text-white disabled:bg-gray-300">Adicionar</button></div>
            </div>
          </article>)}
        </div>
      </section>

      {cart.length > 0 && <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4 shadow-2xl"><div className="mx-auto flex max-w-6xl items-center justify-between"><div><strong>{cart.reduce((sum, item) => sum + item.quantity, 0)} item(ns)</strong><p className="text-sm text-gray-600">Subtotal {money(subtotal)}</p></div><button onClick={() => setCheckoutOpen(true)} className="flex items-center gap-2 rounded-xl bg-green-700 px-6 py-3 font-black text-white"><ShoppingCart size={18} /> Ver carrinho</button></div></div>}

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
        <div className="mt-4 rounded-2xl bg-gray-50 p-4"><div className="flex justify-between"><span>Produto</span><strong>{money(Number(selectedProduct.price))}</strong></div><div className="mt-1 flex justify-between"><span>Complementos cobrados</span><strong>{money(modalPricing.optionUnitTotal)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><span>Total do item</span><strong>{money(Number(selectedProduct.price) + modalPricing.optionUnitTotal)}</strong></div>{selectedProduct.option_groups.some(group => Number(group.free_selection || 0) > 0) && <p className="mt-2 text-xs text-gray-500">As unidades grátis são aplicadas automaticamente às opções selecionadas de maior valor.</p>}</div>
        {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}<button onClick={addSelectedProduct} className="mt-5 w-full rounded-xl bg-orange-500 py-3 font-black text-white">Adicionar ao carrinho • {money(Number(selectedProduct.price) + modalPricing.optionUnitTotal)}</button></section></div>}

      {checkoutOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3"><section className="mx-auto my-4 max-w-2xl rounded-3xl bg-white p-6"><button onClick={() => setCheckoutOpen(false)} className="float-right text-2xl">×</button><h2 className="text-2xl font-black">Seu pedido</h2>
        <div className="mt-4 space-y-3">{cart.map(item => <div key={item.key} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div><strong>{item.product.name}</strong><p className="text-sm text-gray-500">{money(Number(item.product.price) + item.optionUnitTotal)} por unidade</p></div><button onClick={() => setCart(current => current.filter(entry => entry.key !== item.key))} className="rounded-lg p-2 text-red-600"><Trash2 size={17} /></button></div>
          {item.choices.length > 0 && <ul className="mt-2 space-y-1 text-sm text-gray-600">{item.choices.map(choice => <li key={`${choice.groupId}-${choice.optionId}`}>{choice.quantity}× {choice.optionName}{choice.chargedQuantity === 0 ? " — grátis" : choice.chargedQuantity < choice.quantity ? ` — ${choice.quantity - choice.chargedQuantity} grátis` : choice.totalPrice > 0 ? ` — + ${money(choice.totalPrice)}` : ""}</li>)}</ul>}
          {item.notes && <p className="mt-2 text-sm italic text-gray-500">Obs.: {item.notes}</p>}
          <div className="mt-3 flex items-center justify-between border-t pt-3"><div className="flex items-center gap-2"><button type="button" onClick={() => changeCartQuantity(item.key, -1)} className="rounded-full border p-2"><Minus size={15} /></button><strong>{item.quantity}</strong><button type="button" onClick={() => changeCartQuantity(item.key, 1)} className="rounded-full bg-green-700 p-2 text-white"><Plus size={15} /></button></div><strong>{money((Number(item.product.price) + item.optionUnitTotal) * item.quantity)}</strong></div>
        </div>)}</div>
        <form action={submit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setServiceType("delivery")} className={`rounded-xl border p-3 font-bold ${serviceType === "delivery" ? "bg-green-700 text-white" : ""}`}>Entrega</button><button type="button" onClick={() => setServiceType("pickup")} className={`rounded-xl border p-3 font-bold ${serviceType === "pickup" ? "bg-green-700 text-white" : ""}`}>Retirada</button></div>
          <input name="customer_name" required placeholder="Seu nome" className="w-full rounded-xl border p-3" /><input name="customer_phone" required placeholder="WhatsApp com DDD" className="w-full rounded-xl border p-3" />
          {serviceType === "delivery" && <div className="grid gap-3 sm:grid-cols-2"><input name="street" required placeholder="Rua" className="rounded-xl border p-3" /><input name="number" required placeholder="Número" className="rounded-xl border p-3" /><input name="neighborhood" required placeholder="Bairro" className="rounded-xl border p-3" /><input name="reference" placeholder="Referência" className="rounded-xl border p-3" /></div>}
          <select name="payment_method" className="w-full rounded-xl border p-3"><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="card_on_delivery">Cartão na entrega</option></select>
          <input name="coupon_code" placeholder="Cupom de desconto" className="w-full rounded-xl border p-3 uppercase" /><textarea name="notes" placeholder="Observação geral" className="w-full rounded-xl border p-3" /><label className="flex gap-2 text-sm"><input type="checkbox" name="marketing_consent" /> Quero receber promoções da loja.</label>
          <div className="rounded-2xl bg-gray-50 p-4"><div className="flex justify-between"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="mt-1 flex justify-between"><span>Entrega</span><strong>{money(deliveryFee)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><span>Total estimado</span><strong>{money(subtotal + deliveryFee)}</strong></div></div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={pending} className="w-full rounded-xl bg-green-700 py-4 font-black text-white disabled:opacity-60">{pending ? "Enviando pedido..." : "Confirmar pedido"}</button>
        </form></section></div>}
    </main>
  );
}
