"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, Check, Loader2, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { importReviewedMenu } from "./actions";

type Confidence = "high" | "medium" | "low";
type ExtractedProduct = {
  category: string;
  name: string;
  description: string;
  price: number;
  confidence: Confidence;
  selected: boolean;
};

const confidenceLabel: Record<Confidence, string> = { high: "Leitura clara", medium: "Revisar", low: "Leitura duvidosa" };

export function MenuPhotoImporter() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [products, setProducts] = useState<ExtractedProduct[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [isImporting, startImport] = useTransition();

  const selectedCount = products.filter(product => product.selected).length;

  function reset() {
    setImage(null);
    setProducts([]);
    setWarnings([]);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (analyzing || isImporting) return;
    reset();
    setOpen(false);
  }

  async function analyze() {
    if (!image) return setError("Escolha uma foto do cardápio.");
    setAnalyzing(true);
    setError("");
    const body = new FormData();
    body.set("image", image);
    try {
      const response = await fetch("/api/products/import-menu", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível ler esta foto.");
      const extracted = Array.isArray(data.products) ? data.products : [];
      if (!extracted.length) throw new Error("Nenhum produto legível foi encontrado. Tente uma foto mais próxima e bem iluminada.");
      setProducts(extracted.map((product: Omit<ExtractedProduct, "selected">) => ({
        ...product,
        selected: product.confidence !== "low",
      })));
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível ler esta foto.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateProduct(index: number, field: keyof ExtractedProduct, value: string | number | boolean) {
    setProducts(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  function confirmImport() {
    const selected = products.filter(product => product.selected).map(product => ({
      category: product.category,
      name: product.name,
      description: product.description,
      price: product.price,
    }));
    if (!selected.length) return setError("Selecione ao menos um produto para importar.");
    setError("");
    startImport(async () => {
      const result = await importReviewedMenu(selected);
      if (!result.ok) return setError(result.message);
      reset();
      setOpen(false);
      router.refresh();
      router.push(`/produtos?sucesso=${encodeURIComponent(result.message)}`);
    });
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex items-center justify-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 font-bold text-orange-700 hover:bg-orange-100">
      <Camera size={18}/>Importar foto
    </button>

    {open && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Importar cardápio por foto">
      <section className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-center justify-between border-b px-5 py-4 sm:px-7">
          <div><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Cadastro inteligente</p><h2 className="text-xl font-bold text-slate-900">Importar cardápio por foto</h2></div>
          <button type="button" onClick={close} disabled={analyzing || isImporting} className="rounded-full p-2 hover:bg-slate-100 disabled:opacity-40" aria-label="Fechar"><X/></button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-7">
          {!products.length ? <div className="mx-auto max-w-2xl">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              Envie uma foto nítida. A IA separará categoria, nome, descrição e preço. Você revisará tudo antes de salvar.
            </div>
            <label className="mt-5 flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-orange-300 bg-orange-50/50 p-6 text-center hover:bg-orange-50">
              <Upload className="mb-3 text-orange-600" size={38}/>
              <strong className="text-lg text-slate-900">{image ? image.name : "Clique para escolher a foto"}</strong>
              <span className="mt-1 text-sm text-slate-500">JPG, PNG ou WEBP com até 8 MB</span>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { setImage(event.target.files?.[0] || null); setError(""); }}/>
            </label>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600"><strong>Dica:</strong> fotografe de frente, com boa luz e sem cortar nomes ou preços. Fotos muito distantes podem gerar itens para revisão manual.</div>
          </div> : <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><strong className="text-emerald-900">{products.length} itens encontrados</strong><p className="text-sm text-emerald-800">Revise os campos e desmarque o que não quiser importar.</p></div>
              <button type="button" onClick={reset} className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800">Trocar foto</button>
            </div>
            {warnings.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex items-center gap-2 font-bold"><AlertTriangle size={17}/>Pontos para conferir</div><ul className="mt-2 list-disc space-y-1 pl-5">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
            <div className="space-y-3">
              {products.map((product, index) => <article key={index} className={`rounded-2xl border p-4 ${product.selected ? "bg-white" : "bg-slate-50 opacity-70"}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 font-bold text-slate-900"><input type="checkbox" checked={product.selected} onChange={event => updateProduct(index, "selected", event.target.checked)} className="h-5 w-5 accent-emerald-700"/>Importar este produto</label>
                  <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${product.confidence === "high" ? "bg-emerald-50 text-emerald-700" : product.confidence === "medium" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{confidenceLabel[product.confidence]}</span><button type="button" onClick={() => setProducts(items => items.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Remover item"><Trash2 size={17}/></button></div>
                </div>
                <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr_130px]">
                  <label className="text-sm font-semibold">Categoria<input value={product.category} onChange={event => updateProduct(index, "category", event.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
                  <label className="text-sm font-semibold">Produto<input value={product.name} onChange={event => updateProduct(index, "name", event.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
                  <label className="text-sm font-semibold">Preço<input value={product.price} onChange={event => updateProduct(index, "price", Number(event.target.value))} type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-xl border p-3 font-normal"/></label>
                  <label className="text-sm font-semibold md:col-span-3">Descrição<textarea value={product.description} onChange={event => updateProduct(index, "description", event.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-xl border p-3 font-normal" placeholder="Descrição opcional"/></label>
                </div>
              </article>)}
            </div>
          </div>}
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">Os produtos serão salvos <strong className="text-slate-700">pausados</strong> até você conferir e ativar.</p>
          <div className="flex gap-3"><button type="button" onClick={close} disabled={analyzing || isImporting} className="rounded-xl border px-5 py-3 font-semibold disabled:opacity-40">Cancelar</button>{products.length ? <button type="button" onClick={confirmImport} disabled={isImporting || selectedCount === 0} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{isImporting ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>}Importar {selectedCount}</button> : <button type="button" onClick={analyze} disabled={!image || analyzing} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{analyzing ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>}Ler cardápio</button>}</div>
        </footer>
      </section>
    </div>}
  </>;
}
