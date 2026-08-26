"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Replace, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { createCombo } from "./actions";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 8 * 1024 * 1024;

type Category = { id: string; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
    {pending && <Loader2 size={18} className="animate-spin"/>}
    {pending ? "Enviando imagem..." : "Salvar combo"}
  </button>;
}

export function ComboCreateForm({ categories }: { categories: Category[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setMessage("");
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      event.target.value = "";
      setMessage("Formato inválido. Use JPG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      event.target.value = "";
      setMessage("A imagem ultrapassa o limite de 8 MB.");
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  function removeImage() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setMessage("");
  }

  return <form action={createCombo} className="rounded-2xl border bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold">1. Criar combo</h2>
    <label className="mt-4 block text-sm font-semibold">Nome</label>
    <input name="name" required className="mt-1 w-full rounded-xl border px-3 py-3" placeholder="Combo Família" />
    <label className="mt-3 block text-sm font-semibold">Descrição</label>
    <textarea name="description" className="mt-1 min-h-20 w-full rounded-xl border px-3 py-3" placeholder="Escolha os itens da sua refeição" />
    <div className="mt-3">
      <label className="block text-sm font-semibold">Foto do combo</label>
      <input ref={inputRef} name="image" onChange={chooseImage} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden"/>
      {!preview ? <button type="button" onClick={() => inputRef.current?.click()} className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3 text-sm font-semibold text-emerald-800">
        <ImagePlus size={18}/> Selecionar imagem
      </button> : <div className="mt-2 flex items-center gap-3 rounded-xl border bg-gray-50 p-3">
        <img src={preview} alt="Pré-visualização da foto do combo" className="h-28 w-28 shrink-0 rounded-lg bg-white object-cover sm:h-32 sm:w-32"/>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700"><Replace size={16}/> Trocar foto</button>
          <button type="button" onClick={removeImage} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"><Trash2 size={16}/> Remover foto</button>
        </div>
      </div>}
      <p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP ou GIF de até 8 MB.</p>
      {message && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{message}</p>}
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <div><label className="block text-sm font-semibold">Preço base</label><input name="basePrice" type="number" step="0.01" min="0" required className="mt-1 w-full rounded-xl border px-3 py-3" /></div>
      <div><label className="block text-sm font-semibold">Promoção</label><input name="promotionalPrice" type="number" step="0.01" min="0" className="mt-1 w-full rounded-xl border px-3 py-3" /></div>
    </div>
    <label className="mt-3 block text-sm font-semibold">Categoria</label>
    <select name="categoryId" className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Combos</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
    <label className="mt-3 block text-sm font-semibold">Preparo (min)</label>
    <input name="preparationTime" type="number" min="0" className="mt-1 w-full rounded-xl border px-3 py-3" />
    <SubmitButton/>
  </form>;
}

