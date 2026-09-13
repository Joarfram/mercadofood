"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { CheckCircle2, Clock3, Minus, Plus, Search, ShoppingCart, Trash2, UserRound } from "lucide-react";
import { closePublicCustomerOrder, getPublicCustomerState, lookupPublicCustomer, previewPublicCoupon, registerPublicCustomer, submitPublicOrder } from "./actions";
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
    menu_theme?: string;
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
type CouponPreview = { code: string; name?: string; description?: string; subtotal: number; discount: number; total_after_discount: number };
type CustomerAddress = { cep?:string|null; street?:string|null; number?:string|null; complement?:string|null; neighborhood?:string|null; city?:string|null; reference?:string|null };
type Customer = { name: string; phone: string; address?: CustomerAddress | null };
type ActiveOrder = {
  id: string; order_number: string | number; public_code: string; total: number; status: string; service_type: string;
  created_at: string; estimated_preparation_minutes?: number | null; estimated_ready_at?: string | null;
  ready_at?: string | null; delivered_at?: string | null; canceled_at?: string | null;
};

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
  const [pending, startTransition] = useTransition();
  const [couponPending, startCouponTransition] = useTransition();
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [registrationPending, startRegistration] = useTransition();
  const [lookupPending, startLookup] = useTransition();
  const [closingOrder, startClosingOrder] = useTransition();
  const [registrationName, setRegistrationName] = useState("");
  const [registrationPhone, setRegistrationPhone] = useState("");
  const [lookupHint, setLookupHint] = useState("");

  useEffect(() => {
    let mounted = true;
    const loadCustomer = () => getPublicCustomerState(menu.company.slug).then(state => {
      if (!mounted) return;
      setCustomer(state.customer as Customer | null);
      setActiveOrder(state.order as ActiveOrder | null);
      setCustomerLoading(false);
    }).catch(() => mounted && setCustomerLoading(false));
    loadCustomer();
    const timer = window.setInterval(loadCustomer, 10000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [menu.company.slug]);

  useEffect(() => {
    const neighborhood = customer?.address?.neighborhood?.trim().toLocaleLowerCase("pt-BR");
    if (!neighborhood || !deliveryZones.length) return;
    const matchingZone = deliveryZones.find(zone => zone.name.trim().toLocaleLowerCase("pt-BR") === neighborhood);
    if (matchingZone) setDeliveryZoneId(matchingZone.id);
  }, [customer, deliveryZones]);

  const products = useMemo(() => menu.categories
    .flatMap(category => category.products.map(product => ({ ...product, categoryId: category.id })))
    .filter(product => (categoryId === "all" || product.categoryId === categoryId)
      && `${product.name} ${product.description || ""}`.toLowerCase().includes(query.toLowerCase())), [menu, categoryId, query]);

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.product.price) + item.optionUnitTotal) * item.quantity, 0);
  const selectedZone = deliveryZones.find(zone => zone.id === deliveryZoneId);
  const deliveryFee = serviceType === "delivery" ? Number(selectedZone?.delivery_fee ?? menu.company.default_delivery_fee ?? 0) : 0;
  const modalPricing = selectedProduct ? calculateChoices(selectedProduct, selectedOptions) : { choices: [], optionUnitTotal: 0 };
  const validCouponPreview = couponPreview && Number(couponPreview.subtotal) === Number(subtotal) ? couponPreview : null;
  const couponDiscount = Number(validCouponPreview?.discount || 0);
  const promotionSavings = cart.reduce((sum, item) => {
    const originalPrice = Number(item.product.original_price || 0);
    const currentPrice = Number(item.product.price || 0);
    return sum + (originalPrice > currentPrice ? (originalPrice - currentPrice) * item.quantity : 0);
  }, 0);
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
      coupon_code: validCouponPreview?.code || "",
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
      const estimatedMinutes = serviceType === "delivery" ? Number(selectedZone?.estimated_minutes || serviceConfig.average_delivery_minutes) : Number(serviceConfig.average_delivery_minutes);
      setActiveOrder({
        id: result.data.order_id, order_number: result.data.order_number, public_code: result.data.public_code,
        total: Number(result.data.total), status: "new", service_type: serviceType, created_at: new Date().toISOString(),
        estimated_preparation_minutes: estimatedMinutes,
        estimated_ready_at: new Date(Date.now() + estimatedMinutes * 60000).toISOString(),
      });
      setCart([]);
      setCheckoutOpen(false);
    });
  }

  function applyCoupon() {
    setCouponError("");
    startCouponTransition(async () => {
      const result = await previewPublicCoupon({ slug: menu.company.slug, code: couponCode, subtotal });
      if (!result.ok) {
        setCouponPreview(null);
        setCouponError(result.error);
        return;
      }
      setCouponPreview(result.data as CouponPreview);
      setCouponCode(String(result.data.code || couponCode).toUpperCase());
    });
  }

  function checkExistingCustomer() {
    const name = registrationName.trim();
    if (name.length < 2) { setLookupHint(""); return; }
    startLookup(async () => {
      const result = await lookupPublicCustomer({ slug: menu.company.slug, name });
      if (!result.ok || !result.found) { setLookupHint(""); return; }
      setRegistrationName(result.name);
      setLookupHint(`Cadastro encontrado. Confirme com o WhatsApp final ${result.maskedPhone}.`);
    });
  }

  function registerCustomer() {
    setError("");
    startRegistration(async () => {
      const result = await registerPublicCustomer({ slug: menu.company.slug, name: registrationName, phone: registrationPhone });
      if (!result.ok) { setError(result.error); return; }
      const state = await getPublicCustomerState(menu.company.slug);
      setCustomer((state.customer || result.customer) as Customer);
      setLookupHint("");
    });
  }

  function closeOrder() {
    if (!activeOrder) return;
    startClosingOrder(async () => {
      const result = await closePublicCustomerOrder({ slug: menu.company.slug, orderId: activeOrder.id });
      if (!result.ok) { setError(result.error); return; }
      setActiveOrder(null);
    });
  }

  const surface = "border-[var(--menu-border)] bg-[var(--menu-surface)] text-[var(--menu-text)]";
  const mutedText = "text-[var(--menu-muted)]";
  const darkTheme = false;
  const menuStyle = {
    "--menu-primary": "var(--mf-primary)",
    "--menu-accent": "var(--mf-accent)",
    "--menu-bg": "var(--mf-background)",
    "--menu-surface": "var(--mf-surface)",
    "--menu-text": "var(--mf-text)",
    "--menu-muted": "var(--mf-text-secondary)",
    "--menu-border": "#d1d5db",
  } as CSSProperties;

  return (
    <main style={menuStyle} className="mf-public-menu min-h-screen bg-[var(--menu-bg)] pb-28 text-[var(--menu-text)] transition-colors">
      <header className="sticky top-0 z-20 border-b border-[var(--menu-border)] bg-[var(--menu-surface)]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <strong className="text-lg">Mercado<span className="text-[var(--menu-accent)]">Food</span></strong>
          <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-xl border border-[var(--menu-border)] bg-[var(--menu-bg)] px-3 md:flex"><Search size={18} className={mutedText}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no cardápio" className="w-full bg-transparent py-2.5 outline-none"/></div>
          <button type="button" onClick={() => cart.length && setCheckoutOpen(true)} aria-label="Abrir carrinho" className="relative grid h-10 w-10 place-items-center rounded-xl bg-[var(--menu-primary)] text-white"><ShoppingCart size={20}/>{cart.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-xs font-black">{cart.reduce((sum,item)=>sum+item.quantity,0)}</span>}</button>
        </div>
      </header>

      <section className="mf-dark-overlay relative overflow-hidden border-b border-white/10 bg-[#171719] text-white">
        {menu.company.banner_url && <img src={menu.company.banner_url} alt={`Banner da ${menu.company.name}`} className="absolute inset-0 h-full w-full object-cover opacity-40"/>}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25"/>
        <div className="relative mx-auto flex min-h-52 max-w-7xl items-center gap-4 px-4 py-8 md:min-h-64 md:gap-7 md:px-6">
          {menu.company.logo_url ? <img src={menu.company.logo_url} alt={`Logomarca da ${menu.company.name}`} className="h-20 w-20 shrink-0 rounded-2xl border-2 border-white bg-white object-contain p-1 shadow-2xl md:h-28 md:w-28"/> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-2 border-white/30 bg-white/10 text-4xl md:h-28 md:w-28">🍔</div>}
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-white/70">Cardápio digital</p><h1 className="mt-1 text-2xl font-black sm:text-3xl md:text-4xl">{menu.company.name}</h1><div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-3 py-1 font-bold ${menu.company.is_open ? "bg-green-600" : "bg-red-600"}`}>{menu.company.is_open ? "Aberto" : "Fechado"}</span><span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1"><Clock3 size={15}/>{serviceConfig.average_delivery_minutes} min</span></div>{menu.company.menu_message && <p className="mt-3 max-w-2xl text-sm text-white/80">{menu.company.menu_message}</p>}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl p-4 md:p-6">
        <div className={`flex items-center gap-2 rounded-2xl border px-4 md:hidden ${surface}`}><Search size={19} className={mutedText}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no cardápio" className="w-full bg-transparent py-3.5 outline-none"/></div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          <button onClick={() => setCategoryId("all")} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold ${categoryId === "all" ? "bg-[var(--menu-primary)] text-white" : surface}`}>Mais pedidos</button>
          {menu.categories.map(category => <button key={category.id} onClick={() => setCategoryId(category.id)} className={`whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-bold ${categoryId === category.id ? "border-transparent bg-[var(--menu-primary)] text-white" : surface}`}>{category.name}</button>)}
        </nav>

        {menu.promotions.length > 0 && <div className="mt-5 flex gap-3 overflow-x-auto pb-2">{menu.promotions.map(promotion => <article key={promotion.id} className={`min-w-[260px] overflow-hidden rounded-2xl border ${surface}`}>{promotion.image_url && <img src={promotion.image_url} alt={promotion.title} className="aspect-[16/7] w-full object-cover"/>}<div className="p-4"><strong>{promotion.title}</strong><p className={`text-sm ${mutedText}`}>{promotion.description}</p></div></article>)}</div>}
        {hasCombos && <a href={`/cardapio/${menu.company.slug}/combos`} className="mf-accent-panel mt-5 flex items-center justify-between rounded-2xl p-5 shadow-sm"><div><p className="text-sm font-bold">Monte do seu jeito</p><strong className="text-xl">Ver combos completos</strong></div><span className="rounded-xl bg-white/60 px-4 py-2 font-black">Abrir →</span></a>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid content-start gap-3 md:grid-cols-2">
            {products.map(product => { const quantityInCart = productQuantities[product.id] || 0; return <article key={product.id} className={`grid min-h-40 grid-cols-[minmax(120px,38%)_1fr] overflow-hidden rounded-2xl border shadow-sm ${surface}`}>
              <div className="bg-[var(--menu-bg)]">{product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" className={`h-full min-h-40 w-full ${product.image_fit === "contain" ? "object-contain p-2" : "object-cover"}`} style={{objectPosition:product.image_position||"center"}}/> : <div className="grid h-full min-h-40 place-items-center text-5xl">🍽️</div>}</div>
              <div className="flex min-w-0 flex-col p-4"><h2 className="text-base font-black leading-tight sm:text-lg">{product.name}</h2>{product.description && <><p className={`mt-2 line-clamp-3 text-sm ${mutedText}`}>{product.description}</p><button type="button" onClick={()=>openProduct(product)} className="mt-1 w-fit text-left text-xs font-bold text-[var(--menu-primary)] underline-offset-2 hover:underline">Ver descrição completa</button></>}<div className="mt-auto flex items-end justify-between gap-2 pt-4"><div>{product.original_price && <span className={`block text-xs line-through ${mutedText}`}>{money(Number(product.original_price))}</span>}<strong className="text-lg text-[var(--menu-primary)]">{money(Number(product.price))}</strong></div>{quantityInCart > 0 ? <div className="flex items-center gap-1 rounded-xl border border-green-700 p-1"><button type="button" aria-label={`Diminuir ${product.name}`} onClick={()=>changeProductQuantity(product.id,-1)} className="grid h-8 w-8 place-items-center rounded-lg"><Minus size={16}/></button><strong>{quantityInCart}</strong><button type="button" aria-label={`Aumentar ${product.name}`} onClick={()=>changeProductQuantity(product.id,1)} className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--menu-primary)] text-white"><Plus size={16}/></button></div> : <button type="button" aria-label={`Adicionar ${product.name}`} onClick={()=>openProduct(product)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--menu-primary)] text-white shadow"><Plus size={21}/></button>}</div>{quantityInCart > 0 && product.option_groups.length > 0 && <button type="button" onClick={()=>openProduct(product)} className="mt-2 text-left text-xs font-bold text-[var(--menu-accent)]">+ Outra opção</button>}</div>
            </article>})}
            {!products.length && <div className={`rounded-2xl border border-dashed p-10 text-center md:col-span-2 ${surface} ${mutedText}`}>Nenhum produto encontrado nesta seleção.</div>}
          </div>
          <aside className={`hidden h-fit rounded-2xl border p-5 shadow-sm lg:sticky lg:top-20 lg:block ${surface}`}><h2 className="flex items-center gap-2 text-xl font-black"><ShoppingCart size={20}/> Seu pedido</h2>{cart.length === 0 ? <p className={`mt-5 text-sm ${mutedText}`}>Seu carrinho está vazio. Escolha um produto para começar.</p> : <><div className="mt-4 max-h-[48vh] space-y-3 overflow-y-auto">{cart.map(item=><div key={item.key} className={`border-b pb-3 ${darkTheme?"border-slate-700":"border-slate-200"}`}><div className="flex justify-between gap-2"><strong className="text-sm">{item.quantity}× {item.product.name}</strong><span className="text-sm">{money((Number(item.product.price)+item.optionUnitTotal)*item.quantity)}</span></div><div className="mt-2 flex items-center gap-2"><button onClick={()=>changeCartQuantity(item.key,-1)} className="rounded-lg border p-1"><Minus size={14}/></button><span className="text-sm font-bold">{item.quantity}</span><button onClick={()=>changeCartQuantity(item.key,1)} className="rounded-lg bg-[var(--menu-primary)] p-1 text-white"><Plus size={14}/></button></div></div>)}</div><div className="mt-4 flex justify-between border-t pt-4 text-lg"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><button onClick={()=>setCheckoutOpen(true)} className="mt-4 w-full rounded-xl bg-[var(--menu-primary)] py-3 font-black text-white">Finalizar pedido</button></>}</aside>
        </div>
      </section>

      {cart.length > 0 && <div className={`fixed bottom-0 left-0 right-0 z-30 border-t p-3 shadow-2xl lg:hidden ${darkTheme ? "border-slate-700 bg-[#171719]" : "border-slate-200 bg-white"}`}><button onClick={()=>setCheckoutOpen(true)} className="mx-auto flex w-full max-w-lg items-center justify-between rounded-2xl bg-[var(--menu-primary)] px-5 py-4 font-black text-white"><span className="flex items-center gap-2"><ShoppingCart size={20}/> Ver carrinho</span><span>{money(subtotal)}</span></button></div>}

      {selectedProduct && <div className="fixed inset-0 z-40 flex items-end bg-black/50 md:items-center md:justify-center"><section className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 md:max-w-xl md:rounded-3xl"><button onClick={() => setSelectedProduct(null)} className="float-right text-2xl">×</button><h2 className="text-2xl font-black">{selectedProduct.name}</h2><p className="mt-2 text-gray-600">{selectedProduct.description}</p>
        {(selectedProduct.option_groups || []).map(group => {
          const count = groupSelectionCount(selectedOptions, group.id);
          return <div key={group.id} className="mt-6"><div className="flex items-start justify-between gap-3"><div><strong>{group.name}</strong>{group.description && <p className="text-sm text-gray-500">{group.description}</p>}</div><span className="text-right text-xs text-gray-500">{group.min_selection > 0 ? "Obrigatório" : "Opcional"}<br />{count}/{group.max_selection} escolhido(s){Number(group.free_selection || 0) > 0 && <> • {group.free_selection} grátis</>}</span></div>
            <div className="mt-2 space-y-2">{group.options.map(option => {
              const optionQuantity = selectedOptions[group.id]?.[option.id] || 0;
              const quantityMode = group.group_type === "quantity" || Number(option.max_quantity || 1) > 1;
              return <div key={option.id} className={`flex items-center justify-between rounded-xl border p-3 ${optionQuantity > 0 ? "border-green-600 bg-green-50" : ""}`}><div><p className="font-medium">{option.name}</p><span className="text-sm text-gray-600">{Number(option.price_delta) > 0 ? `+ ${money(Number(option.price_delta))} por unidade` : "Sem acréscimo"}</span></div>
                {quantityMode ? <div className="flex items-center gap-2"><button type="button" onClick={() => setOptionQuantity(group, option, optionQuantity - 1)} className="rounded-full border bg-white p-2"><Minus size={15} /></button><strong className="w-5 text-center">{optionQuantity}</strong><button type="button" onClick={() => setOptionQuantity(group, option, optionQuantity + 1)} disabled={count >= group.max_selection || optionQuantity >= Number(option.max_quantity || 1)} className="rounded-full bg-green-700 p-2 text-white disabled:bg-gray-300"><Plus size={15} /></button></div>
                  : <input type={group.max_selection === 1 ? "radio" : "checkbox"} name={group.id} checked={optionQuantity > 0} onChange={() => setOptionQuantity(group, option, optionQuantity > 0 ? 0 : 1)} className="h-5 w-5" />}
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
        <section className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-gray-900">Tem cupom de desconto?</h3><p className="text-sm text-gray-600">Digite o código e veja o desconto antes de continuar.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-orange-700">Cupom</span></div>
          <div className="mt-3 flex gap-2"><input value={couponCode} onChange={event => { setCouponCode(event.target.value.toUpperCase()); setCouponError(""); }} placeholder="EX.: BEMVINDO10" className="min-w-0 flex-1 rounded-xl border border-orange-200 bg-white p-3 uppercase outline-none focus:ring-2 focus:ring-orange-400" /><button type="button" onClick={applyCoupon} disabled={couponPending || !couponCode.trim()} className="rounded-xl bg-orange-500 px-5 font-black text-white disabled:bg-gray-300">{couponPending ? "Verificando..." : "Aplicar"}</button></div>
          {couponError && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{couponError}</p>}
          {couponPreview && !validCouponPreview && <p className="mt-2 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-800">O carrinho mudou. Clique em Aplicar para recalcular o cupom.</p>}
          {validCouponPreview && <div className="mt-3 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-3"><div><strong className="text-green-800">Cupom {validCouponPreview.code} aplicado!</strong><p className="text-sm text-green-700">Você ganhou {money(couponDiscount)} de desconto.</p></div><button type="button" onClick={() => { setCouponPreview(null); setCouponCode(""); }} className="text-sm font-bold text-red-600">Remover</button></div>}
        </section>
        <form action={submit} className="mt-6 space-y-4">
          <h3 className="border-b pb-2 text-lg font-black">1. Entrega ou retirada</h3>
          <div className="grid grid-cols-2 gap-2"><button type="button" disabled={!serviceConfig.delivery_enabled} onClick={() => setServiceType("delivery")} className={`rounded-xl border p-3 font-bold disabled:bg-gray-100 disabled:text-gray-400 ${serviceType === "delivery" ? "bg-green-700 text-white" : ""}`}>Entrega</button><button type="button" disabled={!serviceConfig.pickup_enabled} onClick={() => setServiceType("pickup")} className={`rounded-xl border p-3 font-bold disabled:bg-gray-100 disabled:text-gray-400 ${serviceType === "pickup" ? "bg-green-700 text-white" : ""}`}>Retirada</button></div>
          <h3 className="border-b pb-2 pt-2 text-lg font-black">2. Seu cadastro</h3>
          {customerLoading ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">Verificando seu cadastro...</p> : customer ? <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-green-700 text-white"><CheckCircle2 size={22}/></span><div><strong>{customer.name}</strong><p className="text-sm text-green-800">WhatsApp {customer.phone} · Cadastro reconhecido</p></div></div> : <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4"><div className="flex items-center gap-2 font-black text-orange-900"><UserRound size={20}/> Informe seus dados</div><p className="mt-1 text-sm text-orange-800">Se você já é cliente, digite seu nome como foi cadastrado. Por segurança, confirmaremos o WhatsApp antes de carregar seus dados.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><input value={registrationName} onChange={event=>{setRegistrationName(event.target.value);setLookupHint("")}} onBlur={checkExistingCustomer} placeholder="Seu nome completo" className="rounded-xl border bg-white p-3"/><input value={registrationPhone} onChange={event=>setRegistrationPhone(event.target.value)} inputMode="tel" placeholder="WhatsApp com DDD" className="rounded-xl border bg-white p-3"/></div>{lookupPending&&<p className="mt-2 text-sm text-orange-800">Procurando seu cadastro...</p>}{lookupHint&&<p className="mt-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">{lookupHint}</p>}<button type="button" onClick={registerCustomer} disabled={registrationPending} className="mt-3 w-full rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:opacity-60">{registrationPending ? "Confirmando..." : lookupHint ? "Confirmar WhatsApp e continuar" : "Cadastrar e continuar"}</button></div>}
          {serviceType === "delivery" && <><h3 className="border-b pb-2 pt-2 text-lg font-black">3. Endereço de entrega</h3><div key={customer?.phone || "novo-cliente"} className="grid gap-3 sm:grid-cols-2"><input name="cep" inputMode="numeric" defaultValue={customer?.address?.cep||""} placeholder="CEP" className="rounded-xl border p-3" /><input name="street" required defaultValue={customer?.address?.street||""} placeholder="Rua ou avenida" className="rounded-xl border p-3" /><input name="number" required defaultValue={customer?.address?.number||""} placeholder="Número" className="rounded-xl border p-3" /><input name="complement" defaultValue={customer?.address?.complement||""} placeholder="Complemento (opcional)" className="rounded-xl border p-3" />{deliveryZones.length ? <select name="delivery_zone_id" required value={deliveryZoneId} onChange={event=>setDeliveryZoneId(event.target.value)} className="rounded-xl border p-3"><option value="">Selecione o bairro</option>{deliveryZones.map(zone=><option key={zone.id} value={zone.id}>{zone.name} · {money(Number(zone.delivery_fee))} · {zone.estimated_minutes} min</option>)}</select> : <input name="neighborhood" required defaultValue={customer?.address?.neighborhood||""} placeholder="Bairro" className="rounded-xl border p-3" />}<input name="city" required defaultValue={customer?.address?.city||""} placeholder="Cidade" className="rounded-xl border p-3" /><input name="reference" defaultValue={customer?.address?.reference||""} placeholder="Ponto de referência" className="rounded-xl border p-3 sm:col-span-2" />{customer?.address&&<p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 sm:col-span-2">Endereço preenchido pelo cadastro. Você pode alterar somente para este pedido sem mudar seus dados permanentes.</p>}{selectedZone && subtotal < Number(selectedZone.minimum_order) && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">Pedido mínimo para {selectedZone.name}: {money(Number(selectedZone.minimum_order))}</p>}</div></>}
          <h3 className="border-b pb-2 pt-2 text-lg font-black">{serviceType === "delivery" ? "4" : "3"}. Pagamento</h3>
          <label className="text-sm font-bold text-gray-700">Como deseja pagar?<select name="payment_method" className="mt-1 w-full rounded-xl border p-3 font-normal"><option value="pix">PIX</option><option value="cash">Dinheiro na entrega/retirada</option><option value="card_on_delivery">Cartão na entrega/retirada</option></select></label>
          <textarea name="notes" placeholder="Observação geral" className="w-full rounded-xl border p-3" /><label className="flex gap-2 text-sm"><input type="checkbox" name="marketing_consent" /> Quero receber promoções da loja.</label><label className="flex gap-2 text-sm"><input type="checkbox" required /> Confirmo os dados do pedido e aceito os <a href="/termos" target="_blank" className="font-semibold text-green-700 underline">termos de uso</a>.</label>
          <div className="rounded-2xl bg-gray-50 p-4"><div className="flex justify-between"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{promotionSavings > 0 && <div className="mt-1 flex justify-between text-green-700"><span>Economia nas promoções</span><strong>- {money(promotionSavings)}</strong></div>}{couponDiscount > 0 && <div className="mt-1 flex justify-between text-green-700"><span>Desconto do cupom</span><strong>- {money(couponDiscount)}</strong></div>}<div className="mt-1 flex justify-between"><span>Entrega</span><strong>{money(deliveryFee)}</strong></div><div className="mt-3 flex justify-between border-t pt-3 text-lg"><span>Total estimado</span><strong>{money(Math.max(0, subtotal - couponDiscount + deliveryFee))}</strong></div>{promotionSavings + couponDiscount > 0 && <p className="mt-3 rounded-xl bg-green-100 p-2 text-center text-sm font-black text-green-800">Você está economizando {money(promotionSavings + couponDiscount)} neste pedido.</p>}</div>
          {!menu.company.is_open && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">A loja está fechada no momento. Você pode montar e revisar o carrinho, mas o envio será liberado quando ela abrir.</p>}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button disabled={pending || customerLoading || !customer || !menu.company.is_open || cart.length === 0} className="w-full rounded-xl bg-green-700 py-4 font-black text-white disabled:bg-gray-300 disabled:text-gray-600">{pending ? "Enviando pedido..." : !customer ? "Confirme seus dados para continuar" : menu.company.is_open ? `Confirmar pedido • ${money(Math.max(0, subtotal - couponDiscount + deliveryFee))}` : "Loja fechada"}</button>
        </form></section></div>}
      {activeOrder && <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="active-order-title"><section className="w-full max-w-lg rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700"><Clock3 size={32}/></div><p className="mt-4 text-sm font-bold uppercase tracking-[.18em] text-green-700">Pedido em acompanhamento</p><h1 id="active-order-title" className="mt-1 text-3xl font-black text-gray-950">Pedido #{activeOrder.order_number}</h1><p className="mt-3 text-3xl font-black text-green-700">{money(Number(activeOrder.total))}</p><div className="mt-5 grid grid-cols-2 gap-3 text-left"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Situação</p><p className="mt-1 font-black text-slate-900">{{new:"Recebido",accepted:"Confirmado",preparing:"Em preparação",ready:"Pronto",out_for_delivery:"Saiu para entrega",delivered:"Entregue",canceled:"Cancelado"}[activeOrder.status] || activeOrder.status}</p></div><div className="rounded-2xl bg-orange-50 p-4"><p className="text-xs font-bold uppercase text-orange-700">Previsão</p><p className="mt-1 font-black text-orange-950">{activeOrder.estimated_preparation_minutes || serviceConfig.average_delivery_minutes} min</p>{activeOrder.estimated_ready_at && <p className="text-xs text-orange-800">aprox. {new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit"}).format(new Date(activeOrder.estimated_ready_at))}</p>}</div></div><p className="mt-4 text-sm text-slate-600">O andamento atualiza automaticamente. Esta tela só será dispensada quando você fechar o pedido.</p><button type="button" onClick={closeOrder} disabled={closingOrder} className="mt-5 w-full rounded-xl bg-green-700 px-5 py-3 font-black text-white disabled:opacity-60">{closingOrder ? "Fechando..." : "Fechar pedido"}</button>{error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}</section></div>}
      <PublicFeedback slug={menu.company.slug} companyName={menu.company.name}/>
      <footer className="mx-auto max-w-6xl px-5 pb-6 text-center text-xs text-gray-500"><a href="/termos" className="underline">Termos de uso</a> · <a href="/privacidade" className="underline">Privacidade</a> · Cardápio por MercadoFood</footer>
    </main>
  );
}
