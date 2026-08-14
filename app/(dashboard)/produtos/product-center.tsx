"use client";

import { Fragment, useMemo, useState } from "react";
import { ImagePlus, Package, Pencil, Plus, Search, Store, Trash2, X } from "lucide-react";
import { createIntegratedProduct, deleteProduct, toggleProduct, updateIntegratedProduct } from "./actions";
import { MenuPhotoImporter } from "./menu-photo-importer";

type Category = { id: string; name: string; is_active: boolean; sort_order: number };
type Product = { id: string; name: string; description: string | null; image_url?: string | null; base_price: number | string; promotional_price: number | string | null; preparation_time?: number | null; availability_status: string; category_id: string | null; sku?: string | null; stock_quantity?: number | string; minimum_stock?: number | string; track_stock?: boolean; available_delivery?: boolean; available_pickup?: boolean; available_dine_in?: boolean; addons?: Addon[]; categories: { name: string } | { name: string }[] | null };
type Addon = { name: string; description: string; required: boolean; min: number; max: number; options: { name: string; price: number; image_url?: string | null }[] };
type Variant = { name: string; price: number; stock: number };

const money = (value: number | string | null) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

export function ProductCenter({ categories, products }: { categories: Category[]; products: Product[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editAddons, setEditAddons] = useState<Addon[]>([]);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [addons, setAddons] = useState<Addon[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const filtered = useMemo(() => products.filter(product => {
    const matchesText = `${product.name} ${product.description || ""} ${product.sku || ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (category === "all" || product.category_id === category);
  }).sort((a, b) => {
    const categoryA = categories.find(item => item.id === a.category_id)?.sort_order ?? Number.MAX_SAFE_INTEGER;
    const categoryB = categories.find(item => item.id === b.category_id)?.sort_order ?? Number.MAX_SAFE_INTEGER;
    return categoryA - categoryB || a.name.localeCompare(b.name, "pt-BR");
  }), [products, categories, search, category]);
  const active = products.filter(product => product.availability_status === "available").length;
  const lowStock = products.filter(product => product.track_stock && Number(product.stock_quantity || 0) <= 5).length;

  function close() { setOpen(false); setAddons([]); setVariants([]); setImagePreview(null); setImageName(""); }

  function previewImage(file?: File) {
    setImageName(file?.name || "");
    if (!file) { setImagePreview(null); return; }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }
  function addAddon() { setAddons(items => [...items, { name: "", description: "", required: false, min: 0, max: 1, options: [{ name: "", price: 0 }] }]); }
  function beginEdit(product: Product) { setEditAddons(product.addons || []); setImagePreview(null); setImageName(""); setEditing(product); }

  return <>
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Produtos cadastrados</p><strong className="mt-1 block text-2xl text-slate-900">{products.length}</strong></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Disponíveis para venda</p><strong className="mt-1 block text-2xl text-emerald-700">{active}</strong></div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Estoque baixo</p><strong className="mt-1 block text-2xl text-orange-600">{lowStock}</strong></div>
    </section>

    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-3.5 text-slate-400" size={18}/><input value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border py-3 pl-10 pr-3" placeholder="Buscar produto, descrição ou SKU"/></div>
        <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-xl border px-3 py-3"><option value="all">Todas as categorias</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <MenuPhotoImporter/>
        <button onClick={() => setOpen(true)} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white shadow-sm hover:bg-emerald-800"><Plus size={18}/>Novo produto</button>
      </div>
      <div className="divide-y">
        {!filtered.length && <div className="p-10 text-center text-slate-500"><Package className="mx-auto mb-3"/><p>Nenhum produto encontrado.</p></div>}
        {filtered.map((product, index) => {
          const cat = Array.isArray(product.categories) ? product.categories[0] : product.categories;
          const available = product.availability_status === "available";
          const previousCategoryId = index > 0 ? filtered[index - 1]?.category_id : undefined;
          const startsCategory = index === 0 || previousCategoryId !== product.category_id;
          return <Fragment key={product.id}>
          {startsCategory && <div className="flex items-center justify-between border-y border-emerald-100 bg-emerald-50/70 px-4 py-3 first:border-t-0"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Categoria</p><h2 className="font-bold text-slate-900">{cat?.name || "Sem categoria"}</h2></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">{filtered.filter(item => item.category_id === product.category_id).length} {filtered.filter(item => item.category_id === product.category_id).length === 1 ? "produto" : "produtos"}</span></div>}
          <article className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 text-emerald-700">{product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-cover"/> : <Store size={24}/>}</div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{product.name}</h3><span className={`rounded-full px-2 py-1 text-xs font-semibold ${available ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{available ? "Disponível" : "Pausado"}</span></div><p className="truncate text-sm text-slate-500">{cat?.name || "Sem categoria"}{product.sku ? ` • SKU ${product.sku}` : ""}</p></div>
            <strong className="text-slate-900">{money(product.promotional_price || product.base_price)}</strong>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => beginEdit(product)} className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"><Pencil size={15}/>Editar</button><button type="button" onClick={() => setDeleting(product)} className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"><Trash2 size={15}/>Excluir</button><form action={toggleProduct}><input type="hidden" name="productId" value={product.id}/><input type="hidden" name="nextStatus" value={available ? "unavailable" : "available"}/><button className="rounded-xl border px-3 py-2 text-sm font-semibold">{available ? "Pausar" : "Ativar"}</button></form></div>
          </article></Fragment>;
        })}
      </div>
    </section>

    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Novo produto">
      <form action={createIntegratedProduct} className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <input type="hidden" name="addonsJson" value={JSON.stringify(addons)}/><input type="hidden" name="variantsJson" value={JSON.stringify(variants)}/>
        <header className="flex items-center justify-between border-b px-5 py-4 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Cadastro integrado</p><h2 className="text-xl font-bold text-slate-900">Novo produto</h2></div><button type="button" onClick={close} className="rounded-full p-2 hover:bg-slate-100" aria-label="Fechar"><X/></button></header>
        <div className="overflow-y-auto p-5 sm:p-7">
          <div className="grid gap-5 lg:grid-cols-2">
            <fieldset className="space-y-4 rounded-2xl border p-4"><legend className="px-2 font-bold text-emerald-800">1. Informações principais</legend>
              <label className="block text-sm font-semibold">Categoria<select name="categoryId" className="mt-1 w-full rounded-xl border p-3"><option value="">Sem categoria</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="block text-sm font-semibold">Ou crie uma categoria<input name="newCategory" className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Ex.: Hambúrgueres"/></label>
              <label className="block text-sm font-semibold">Nome do produto<input name="name" required minLength={2} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Ex.: Acarajé completo"/></label>
              <label className="block text-sm font-semibold">Código interno (SKU)<div className="mt-1 flex gap-2"><input name="sku" className="min-w-0 flex-1 rounded-xl border p-3 font-normal" placeholder="Ex.: ACA-001"/><button type="button" onClick={e => { const input = e.currentTarget.previousElementSibling as HTMLInputElement; input.value = `MF-${Date.now().toString().slice(-6)}`; }} className="rounded-xl border border-orange-300 px-3 text-sm text-orange-700">Gerar</button></div></label>
              <label className="block text-sm font-semibold">Descrição<textarea name="description" maxLength={500} rows={4} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Ingredientes, tamanho e detalhes"/></label>
            </fieldset>
            <fieldset className="space-y-4 rounded-2xl border p-4"><legend className="px-2 font-bold text-emerald-800">2. Foto, preço e preparo</legend>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-3 text-center">{imagePreview ? <img src={imagePreview} alt="Pré-visualização do produto" className="h-32 w-full rounded-xl object-contain"/> : <><ImagePlus className="mb-2 text-emerald-700"/><span className="font-semibold">Escolher foto do produto</span></>}<small className="mt-1 break-all text-slate-500">{imageName || "JPG, PNG, WEBP ou GIF até 8 MB"}</small><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={event => previewImage(event.currentTarget.files?.[0])}/></label>
              <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Preço de venda<input name="basePrice" type="number" min="0.01" step="0.01" required className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="0,00"/></label><label className="text-sm font-semibold">Preço promocional<input name="promotionalPrice" type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Opcional"/></label></div>
              <label className="block text-sm font-semibold">Tempo de preparo (minutos)<input name="preparationTime" type="number" min="0" max="240" defaultValue="20" className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
            </fieldset>
            <fieldset className="space-y-4 rounded-2xl border p-4"><legend className="px-2 font-bold text-emerald-800">3. Estoque e disponibilidade</legend>
              <label className="flex items-center gap-2 font-semibold"><input name="trackStock" type="checkbox" className="h-4 w-4 accent-emerald-700"/>Controlar estoque deste produto</label>
              <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Quantidade<input name="stockQuantity" type="number" min="0" step="0.001" defaultValue="0" className="mt-1 w-full rounded-xl border p-3 font-normal"/></label><label className="text-sm font-semibold">Avisar quando restarem<input name="minimumStock" type="number" min="0" step="0.001" defaultValue="0" className="mt-1 w-full rounded-xl border p-3 font-normal"/></label></div>
              <label className="flex items-center gap-2 font-semibold"><input name="available" type="checkbox" defaultChecked className="h-4 w-4 accent-emerald-700"/>Produto disponível para venda</label>
              <div className="grid gap-2 sm:grid-cols-3"><label className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold"><input name="availableDelivery" type="checkbox" defaultChecked className="mr-2 accent-emerald-700"/>Delivery</label><label className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold"><input name="availablePickup" type="checkbox" defaultChecked className="mr-2 accent-emerald-700"/>Retirada</label><label className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold"><input name="availableDineIn" type="checkbox" defaultChecked className="mr-2 accent-emerald-700"/>No local</label></div>
            </fieldset>
            <fieldset className="space-y-4 rounded-2xl border p-4"><legend className="px-2 font-bold text-emerald-800">4. Variações (opcional)</legend>
              {variants.map((variant, index) => <div key={index} className="grid grid-cols-[1fr_100px_90px_auto] gap-2"><input value={variant.name} onChange={e => setVariants(items => items.map((v,i) => i === index ? {...v,name:e.target.value} : v))} className="rounded-xl border p-2" placeholder="Ex.: Grande"/><input value={variant.price} type="number" step="0.01" onChange={e => setVariants(items => items.map((v,i) => i === index ? {...v,price:Number(e.target.value)} : v))} className="rounded-xl border p-2" title="Acréscimo"/><input value={variant.stock} type="number" min="0" onChange={e => setVariants(items => items.map((v,i) => i === index ? {...v,stock:Number(e.target.value)} : v))} className="rounded-xl border p-2" title="Estoque"/><button type="button" onClick={() => setVariants(items => items.filter((_,i) => i !== index))}><Trash2 size={17} className="text-red-600"/></button></div>)}
              <button type="button" onClick={() => setVariants(items => [...items,{name:"",price:0,stock:0}])} className="rounded-xl border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700">+ Adicionar variação</button>
            </fieldset>
            <fieldset className="space-y-4 rounded-2xl border p-4 lg:col-span-2"><legend className="px-2 font-bold text-emerald-800">5. Adicionais e complementos (opcional)</legend>
              {addons.map((group, groupIndex) => <div key={groupIndex} className="rounded-xl bg-slate-50 p-3"><div className="flex gap-2"><input value={group.name} onChange={e => setAddons(items => items.map((g,i) => i === groupIndex ? {...g,name:e.target.value} : g))} className="flex-1 rounded-xl border p-2" placeholder="Nome do grupo: Molhos"/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={group.required} onChange={e => setAddons(items => items.map((g,i) => i === groupIndex ? {...g,required:e.target.checked} : g))}/>Obrigatório</label><button type="button" onClick={() => setAddons(items => items.filter((_,i) => i !== groupIndex))}><Trash2 size={17} className="text-red-600"/></button></div><input value={group.description} onChange={e => setAddons(items => items.map((g,i) => i === groupIndex ? {...g,description:e.target.value} : g))} className="mt-2 w-full rounded-xl border p-2" placeholder="Descrição do grupo (opcional)"/>{group.options.map((option, optionIndex) => <div key={optionIndex} className="mt-2 flex gap-2 pl-3"><input value={option.name} onChange={e => setAddons(items => items.map((g,i) => i === groupIndex ? {...g,options:g.options.map((o,j) => j === optionIndex ? {...o,name:e.target.value} : o)} : g))} className="flex-1 rounded-xl border p-2" placeholder="Complemento: Molho especial"/><input value={option.price} onChange={e => setAddons(items => items.map((g,i) => i === groupIndex ? {...g,options:g.options.map((o,j) => j === optionIndex ? {...o,price:Number(e.target.value)} : o)} : g))} type="number" step="0.01" min="0" className="w-28 rounded-xl border p-2" placeholder="Valor"/></div>)}<button type="button" onClick={() => setAddons(items => items.map((g,i) => i === groupIndex ? {...g,options:[...g.options,{name:"",price:0}],max:g.max+1} : g))} className="mt-2 text-sm font-semibold text-emerald-700">+ Complemento</button></div>)}
              <button type="button" onClick={addAddon} className="rounded-xl border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700">+ Criar grupo de adicionais</button>
            </fieldset>
          </div>
        </div>
        <footer className="flex justify-end gap-3 border-t bg-white px-5 py-4"><button type="button" onClick={close} className="rounded-xl border px-5 py-3 font-semibold">Cancelar</button><button className="rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white hover:bg-emerald-800">Salvar produto</button></footer>
      </form>
    </div>}

    {editing && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Editar ${editing.name}`}>
      <form action={updateIntegratedProduct} className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <input type="hidden" name="productId" value={editing.id}/>
        <input type="hidden" name="addonsJson" value={JSON.stringify(editAddons)}/>
        <header className="flex items-center justify-between border-b px-5 py-4 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Editar produto</p><h2 className="text-xl font-bold text-slate-900">{editing.name}</h2></div><button type="button" onClick={() => setEditing(null)} className="rounded-full p-2 hover:bg-slate-100" aria-label="Fechar"><X/></button></header>
        <div className="overflow-y-auto p-5 sm:p-7"><div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Nome<input name="name" required minLength={2} defaultValue={editing.name} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
          <label className="text-sm font-semibold">Categoria<select name="categoryId" defaultValue={editing.category_id || ""} className="mt-1 w-full rounded-xl border p-3 font-normal"><option value="">Sem categoria</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Código interno (SKU)<input name="sku" defaultValue={editing.sku || ""} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Ex.: ACA-001"/></label>
          <label className="text-sm font-semibold">Tempo de preparo<input name="preparationTime" type="number" min="0" max="240" defaultValue={editing.preparation_time || 0} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Descrição<textarea name="description" maxLength={500} rows={3} defaultValue={editing.description || ""} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
          <label className="text-sm font-semibold">Preço normal<input name="basePrice" type="number" min="0.01" step="0.01" required defaultValue={Number(editing.base_price)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
          <label className="text-sm font-semibold">Preço promocional<input name="promotionalPrice" type="number" min="0.01" step="0.01" defaultValue={editing.promotional_price ? Number(editing.promotional_price) : ""} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Opcional"/></label>
          <label className="text-sm font-semibold">Quantidade em estoque<input name="stockQuantity" type="number" min="0" step="0.001" defaultValue={Number(editing.stock_quantity || 0)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
          <label className="text-sm font-semibold">Alerta de estoque baixo<input name="minimumStock" type="number" min="0" step="0.001" defaultValue={Number(editing.minimum_stock || 0)} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-3 text-center sm:col-span-2">{imagePreview ? <img src={imagePreview} alt="Pré-visualização da nova foto" className="h-28 w-full rounded-xl object-contain"/> : <><ImagePlus className="mb-1 text-emerald-700"/><span className="text-sm font-semibold">Adicionar uma nova foto (opcional)</span></>}<small className="mt-1 break-all text-slate-500">{imageName}</small><input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={event => previewImage(event.currentTarget.files?.[0])}/></label>
          <div className="space-y-3 rounded-xl bg-slate-50 p-4 sm:col-span-2"><label className="flex items-center gap-2 font-semibold"><input name="trackStock" type="checkbox" defaultChecked={Boolean(editing.track_stock)} className="accent-emerald-700"/>Controlar estoque</label><label className="flex items-center gap-2 font-semibold"><input name="available" type="checkbox" defaultChecked={editing.availability_status === "available"} className="accent-emerald-700"/>Disponível para venda</label><div className="grid gap-2 sm:grid-cols-3"><label><input name="availableDelivery" type="checkbox" defaultChecked={editing.available_delivery !== false} className="mr-2 accent-emerald-700"/>Delivery</label><label><input name="availablePickup" type="checkbox" defaultChecked={editing.available_pickup !== false} className="mr-2 accent-emerald-700"/>Retirada</label><label><input name="availableDineIn" type="checkbox" defaultChecked={editing.available_dine_in !== false} className="mr-2 accent-emerald-700"/>No local</label></div></div>
          <fieldset className="space-y-3 rounded-2xl border border-orange-200 p-4 sm:col-span-2"><legend className="px-2 font-bold text-orange-700">Complementos</legend><p className="text-sm text-slate-500">Adicione nome, descrição e valor sem sair deste produto.</p>
            {editAddons.map((group, groupIndex) => <div key={groupIndex} className="rounded-xl bg-orange-50/60 p-3"><div className="flex flex-col gap-2 sm:flex-row"><input value={group.name} onChange={e => setEditAddons(items => items.map((g,i) => i === groupIndex ? {...g,name:e.target.value} : g))} className="min-w-0 flex-1 rounded-xl border p-2" placeholder="Grupo: Molhos, Bebidas..."/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={group.required} onChange={e => setEditAddons(items => items.map((g,i) => i === groupIndex ? {...g,required:e.target.checked} : g))}/>Obrigatório</label><button type="button" onClick={() => setEditAddons(items => items.filter((_,i) => i !== groupIndex))} className="self-end rounded-lg p-2 text-red-600"><Trash2 size={17}/></button></div><input value={group.description} onChange={e => setEditAddons(items => items.map((g,i) => i === groupIndex ? {...g,description:e.target.value} : g))} className="mt-2 w-full rounded-xl border p-2" placeholder="Descrição do grupo (opcional)"/>{group.options.map((option, optionIndex) => <div key={optionIndex} className="mt-2 grid grid-cols-[1fr_110px_auto] gap-2"><input value={option.name} onChange={e => setEditAddons(items => items.map((g,i) => i === groupIndex ? {...g,options:g.options.map((o,j) => j === optionIndex ? {...o,name:e.target.value} : o)} : g))} className="min-w-0 rounded-xl border p-2" placeholder="Nome do complemento"/><input value={option.price} onChange={e => setEditAddons(items => items.map((g,i) => i === groupIndex ? {...g,options:g.options.map((o,j) => j === optionIndex ? {...o,price:Number(e.target.value)} : o)} : g))} type="number" min="0" step="0.01" className="rounded-xl border p-2" placeholder="Valor"/><button type="button" onClick={() => setEditAddons(items => items.map((g,i) => i === groupIndex ? {...g,options:g.options.filter((_,j) => j !== optionIndex),max:Math.max(1,g.max-1)} : g))} className="text-red-600"><Trash2 size={16}/></button></div>)}<button type="button" onClick={() => setEditAddons(items => items.map((g,i) => i === groupIndex ? {...g,options:[...g.options,{name:"",price:0}],max:g.max+1} : g))} className="mt-2 text-sm font-bold text-emerald-700">+ Adicionar complemento</button></div>)}
            <button type="button" onClick={() => setEditAddons(items => [...items,{name:"",description:"",required:false,min:0,max:1,options:[{name:"",price:0}]}])} className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700">+ Criar grupo de complementos</button>
          </fieldset>
        </div></div>
        <footer className="flex justify-end gap-3 border-t px-5 py-4"><button type="button" onClick={() => setEditing(null)} className="rounded-xl border px-5 py-3 font-semibold">Cancelar</button><button className="rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white">Salvar alterações</button></footer>
      </form>
    </div>}

    {deleting && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Excluir ${deleting.name}`}>
      <form action={deleteProduct} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><input type="hidden" name="productId" value={deleting.id}/><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-700"><Trash2/></div><h2 className="mt-4 text-center text-xl font-bold text-slate-900">Excluir produto?</h2><p className="mt-2 text-center text-sm leading-6 text-slate-600">Você está prestes a excluir <strong>{deleting.name}</strong>, suas fotos e configurações. O histórico dos pedidos já realizados será preservado.</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setDeleting(null)} className="rounded-xl border px-4 py-3 font-semibold">Cancelar</button><button className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700">Confirmar exclusão</button></div></form>
    </div>}
  </>;
}
