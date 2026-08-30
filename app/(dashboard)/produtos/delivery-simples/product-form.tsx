"use client";

import { useMemo, useState } from "react";
import { Package, Plus, Trash2, Weight } from "lucide-react";
import { createDeliverySimpleProduct } from "./actions";

type Category = { id: string; name: string };
type FixedOption = { quantity: number; unit: "g" | "kg"; price: number };

type Props = {
  categories: Category[];
};

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(value) ? value : 0);

export function DeliverySimpleProductForm({ categories }: Props) {
  const [mode, setMode] = useState<"unit" | "weight" | "fixed_weight">("unit");
  const [basePrice, setBasePrice] = useState(0);
  const [referenceQuantity, setReferenceQuantity] = useState(1000);
  const [referenceUnit, setReferenceUnit] = useState<"g" | "kg">("g");
  const [minimumSaleQuantity, setMinimumSaleQuantity] = useState(100);
  const [saleIncrement, setSaleIncrement] = useState(100);
  const [previewQuantity, setPreviewQuantity] = useState(250);
  const [fixedOptions, setFixedOptions] = useState<FixedOption[]>([{ quantity: 100, unit: "g", price: 0 }]);

  const referenceInGrams = useMemo(() => referenceUnit === "kg" ? referenceQuantity * 1000 : referenceQuantity, [referenceQuantity, referenceUnit]);
  const previewValue = useMemo(() => {
    if (mode !== "weight" || referenceInGrams <= 0) return basePrice;
    return (previewQuantity / referenceInGrams) * basePrice;
  }, [mode, previewQuantity, referenceInGrams, basePrice]);

  return <form action={createDeliverySimpleProduct} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
    <input type="hidden" name="fixedWeightOptions" value={JSON.stringify(fixedOptions)}/>

    <section className="space-y-5 rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Gestão Delivery Simples</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Cadastrar produto</h2>
        <p className="mt-1 text-sm text-slate-500">A forma de venda controla apenas os campos necessários. Produtos comuns continuam simples.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Nome do produto
          <input name="name" required minLength={2} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Ex.: Queijo coalho"/>
        </label>
        <label className="text-sm font-semibold text-slate-700">Categoria
          <select name="categoryId" className="mt-1 w-full rounded-xl border p-3 font-normal"><option value="">Sem categoria</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        </label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Descrição
          <textarea name="description" maxLength={500} rows={3} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Gramatura informativa, sabor, marca e detalhes do produto"/>
        </label>
      </div>

      <fieldset className="rounded-2xl border p-4">
        <legend className="px-2 font-bold text-emerald-800">Como você vende este produto?</legend>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {[
            ["unit", "Unidade", "Garrafa, pacote, lata ou pote"],
            ["weight", "Por peso", "Queijo, frios, castanhas e granel"],
            ["fixed_weight", "Pesos prontos", "100 g, 250 g, 500 g..."],
          ].map(([value, title, text]) => <label key={value} className={`cursor-pointer rounded-2xl border p-4 ${mode === value ? "border-emerald-500 bg-emerald-50" : "bg-white"}`}>
            <input type="radio" name="sellingMode" value={value} checked={mode === value} onChange={() => setMode(value as typeof mode)} className="sr-only"/>
            <strong className="block text-slate-900">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{text}</span>
          </label>)}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">{mode === "weight" ? "Preço de referência" : "Preço de venda"}
          <input name="basePrice" type="number" min="0.01" step="0.01" required value={basePrice || ""} onChange={event => setBasePrice(Number(event.target.value))} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="0,00"/>
        </label>
        <label className="text-sm font-semibold text-slate-700">Unidade do estoque
          <select name="stockUnit" defaultValue="unit" className="mt-1 w-full rounded-xl border p-3 font-normal"><option value="unit">Unidade</option><option value="g">Gramas</option><option value="kg">Quilos</option></select>
        </label>
      </div>

      {mode === "weight" && <fieldset className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
        <legend className="px-2 font-bold text-emerald-800">Venda por peso</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">Preço referente a
            <input name="referenceQuantity" type="number" min="0.001" step="0.001" value={referenceQuantity} onChange={e => setReferenceQuantity(Number(e.target.value))} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal"/>
          </label>
          <label className="text-sm font-semibold">Unidade
            <select name="referenceUnit" value={referenceUnit} onChange={e => setReferenceUnit(e.target.value as "g" | "kg")} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal"><option value="g">g</option><option value="kg">kg</option></select>
          </label>
          <label className="text-sm font-semibold">Quantidade mínima (g)
            <input name="minimumSaleQuantity" type="number" min="1" step="1" value={minimumSaleQuantity} onChange={e => setMinimumSaleQuantity(Number(e.target.value))} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal"/>
          </label>
          <label className="text-sm font-semibold">Incremento (g)
            <input name="saleIncrement" type="number" min="1" step="1" value={saleIncrement} onChange={e => setSaleIncrement(Number(e.target.value))} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal"/>
          </label>
        </div>
        <div className="rounded-xl bg-white p-4 text-sm text-slate-600">
          <div className="flex flex-wrap items-center gap-3"><span>Simular:</span><input type="number" min="1" value={previewQuantity} onChange={e => setPreviewQuantity(Number(e.target.value))} className="w-28 rounded-lg border p-2"/><span>g = <strong className="text-emerald-800">{money(previewValue)}</strong></span></div>
          <p className="mt-2 text-xs text-slate-500">Exemplo: R$ 24,00 por 1.000 g → 250 g = R$ 6,00.</p>
        </div>
      </fieldset>}

      {mode === "fixed_weight" && <fieldset className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
        <legend className="px-2 font-bold text-orange-700">Opções de peso prontas</legend>
        {fixedOptions.map((option, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_110px_1fr_auto]">
          <input aria-label="Quantidade" type="number" min="0.001" step="0.001" value={option.quantity} onChange={e => setFixedOptions(items => items.map((item,i) => i === index ? {...item, quantity:Number(e.target.value)} : item))} className="rounded-xl border bg-white p-3" placeholder="Quantidade"/>
          <select aria-label="Unidade" value={option.unit} onChange={e => setFixedOptions(items => items.map((item,i) => i === index ? {...item, unit:e.target.value as "g" | "kg"} : item))} className="rounded-xl border bg-white p-3"><option value="g">g</option><option value="kg">kg</option></select>
          <input aria-label="Preço" type="number" min="0.01" step="0.01" value={option.price || ""} onChange={e => setFixedOptions(items => items.map((item,i) => i === index ? {...item, price:Number(e.target.value)} : item))} className="rounded-xl border bg-white p-3" placeholder="Preço R$"/>
          <button type="button" onClick={() => setFixedOptions(items => items.filter((_,i) => i !== index))} className="rounded-xl border border-red-200 p-3 text-red-600" aria-label="Excluir opção"><Trash2 size={18}/></button>
        </div>)}
        <button type="button" onClick={() => setFixedOptions(items => [...items,{quantity:250,unit:"g",price:0}])} className="flex items-center gap-2 rounded-xl border border-orange-300 bg-white px-4 py-2 text-sm font-bold text-orange-700"><Plus size={16}/>Adicionar peso</button>
      </fieldset>}

      <fieldset className="space-y-3 rounded-2xl border p-4">
        <legend className="px-2 font-bold text-emerald-800">Estoque</legend>
        <label className="flex items-center gap-2 font-semibold"><input name="trackStock" type="checkbox" defaultChecked className="accent-emerald-700"/>Controlar estoque deste produto</label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Quantidade atual<input name="stockQuantity" type="number" min="0" step="0.001" defaultValue="0" className="mt-1 w-full rounded-xl border p-3 font-normal"/></label><label className="text-sm font-semibold">Estoque mínimo<input name="minimumStock" type="number" min="0" step="0.001" defaultValue="0" className="mt-1 w-full rounded-xl border p-3 font-normal"/></label></div>
      </fieldset>

      <div className="flex justify-end"><button className="rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white hover:bg-emerald-800">Salvar produto</button></div>
    </section>

    <aside className="self-start rounded-3xl border bg-white p-5 shadow-sm xl:sticky xl:top-5">
      <div className="flex items-center gap-2 text-emerald-800"><Package size={20}/><strong>Prévia da venda</strong></div>
      <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
        <div className="flex h-24 items-center justify-center rounded-xl bg-white text-slate-300"><Weight size={34}/></div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Como aparecerá o preço</p>
        {mode === "unit" && <><h3 className="mt-1 font-bold text-slate-900">Produto por unidade</h3><p className="mt-2 text-lg font-bold text-emerald-800">{money(basePrice)}</p></>}
        {mode === "weight" && <><h3 className="mt-1 font-bold text-slate-900">Produto vendido por peso</h3><p className="mt-2 text-lg font-bold text-emerald-800">{money(basePrice)} / {referenceQuantity}{referenceUnit}</p><p className="mt-1 text-sm text-slate-500">A partir de {minimumSaleQuantity} g</p><div className="mt-3 rounded-xl bg-white p-3 text-sm">{previewQuantity} g → <strong>{money(previewValue)}</strong></div></>}
        {mode === "fixed_weight" && <><h3 className="mt-1 font-bold text-slate-900">Pesos disponíveis</h3><div className="mt-3 space-y-2">{fixedOptions.map((option,index) => <div key={index} className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm"><span>{option.quantity} {option.unit}</span><strong>{money(option.price)}</strong></div>)}</div></>}
      </div>
    </aside>
  </form>;
}
