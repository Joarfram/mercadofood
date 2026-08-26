"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Replace, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MediaAsset, MediaEntityType, MediaKind } from "@/lib/media/types";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 8 * 1024 * 1024;

type Props = {
  companyId: string;
  entityType: MediaEntityType;
  entityId: string;
  kind?: MediaKind;
  initialAssets?: MediaAsset[];
  title?: string;
  description?: string;
  maxFiles?: number;
  aspect?: "square" | "wide";
  recommendedSize?: string;
  fallbackUrl?: string | null;
};

function extension(file: File) {
  const safe = file.name.split(".").pop()?.toLowerCase();
  return safe && /^[a-z0-9]+$/.test(safe) ? safe : "jpg";
}

function uploadWithProgress(path: string, file: File, token: string, onProgress: (value: number) => void) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !apiKey) return Promise.reject(new Error("Supabase não configurado."));

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/storage/v1/object/company-media/${encodeURI(path)}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apiKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Falha de conexão durante o envio."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        try {
          reject(new Error(JSON.parse(xhr.responseText)?.message || "Não foi possível enviar a imagem."));
        } catch {
          reject(new Error("Não foi possível enviar a imagem."));
        }
      }
    };
    xhr.send(file);
  });
}

export function MediaManager({
  companyId,
  entityType,
  entityId,
  kind = "gallery",
  initialAssets = [],
  title = "Fotos",
  description = "Envie JPG, PNG, WebP ou GIF de até 8 MB.",
  maxFiles = 8,
  aspect = "square",
  recommendedSize,
  fallbackUrl,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceIdRef = useRef<string | null>(null);
  const [assets, setAssets] = useState([...initialAssets].sort((a, b) => a.sort_order - b.sort_order));
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [fallbackImage, setFallbackImage] = useState(fallbackUrl || null);
  const busy = progress !== null;
  const remaining = Math.max(0, maxFiles - assets.length);
  const hasImage = assets.length > 0 || Boolean(fallbackImage);
  const label = useMemo(
    () => maxFiles === 1
      ? (hasImage ? "Trocar imagem" : "Escolher imagem")
      : `Adicionar fotos (${remaining} restantes)`,
    [hasImage, maxFiles, remaining]
  );

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setMessage({ type: "error", text: "Formato inválido. Use JPG, PNG, WebP ou GIF." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ type: "error", text: "A imagem ultrapassa o limite de 8 MB." });
      return;
    }
    if (!replaceIdRef.current && assets.length >= maxFiles) {
      setMessage({ type: "error", text: "O limite de imagens foi atingido." });
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setProgress(0);
    setMessage(null);
    const supabase = createClient();
    let uploadedPath = "";
    try {
      const { data: auth } = await supabase.auth.getSession();
      const token = auth.session?.access_token;
      const userId = auth.session?.user.id;
      if (!token || !userId) throw new Error("Sua sessão expirou. Entre novamente.");

      uploadedPath = `${companyId}/${entityType}/${entityId}/${crypto.randomUUID()}.${extension(file)}`;
      await uploadWithProgress(uploadedPath, file, token, setProgress);
      const { data: urlData } = supabase.storage.from("company-media").getPublicUrl(uploadedPath);
      const replacing = replaceIdRef.current;
      const replaced = replacing ? assets.find(asset => asset.id === replacing) : null;
      const sortOrder = replaced?.sort_order ?? assets.length;

      const values = {
        company_id: companyId,
        entity_type: entityType,
        entity_id: entityId,
        kind,
        storage_path: uploadedPath,
        public_url: urlData.publicUrl,
        alt_text: file.name.replace(/\.[^.]+$/, ""),
        mime_type: file.type,
        byte_size: file.size,
        sort_order: sortOrder,
        created_by: userId,
      };

      const query = replacing
        ? supabase.from("media_assets").update(values).eq("id", replacing).eq("company_id", companyId)
        : supabase.from("media_assets").insert(values);
      const { data: saved, error: saveError } = await query
        .select("id,storage_path,public_url,alt_text,mime_type,byte_size,sort_order")
        .single();
      if (saveError) throw saveError;

      if (replaced) await supabase.storage.from("company-media").remove([replaced.storage_path]);
      setAssets(current => replacing
        ? current.map(asset => asset.id === replacing ? saved as MediaAsset : asset).sort((a, b) => a.sort_order - b.sort_order)
        : [...current, saved as MediaAsset]);
      setFallbackImage(null);
      setMessage({ type: "success", text: replacing ? "Imagem substituída." : "Imagem adicionada." });
      router.refresh();
    } catch (error) {
      if (uploadedPath) await supabase.storage.from("company-media").remove([uploadedPath]);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível salvar a imagem." });
    } finally {
      replaceIdRef.current = null;
      setProgress(null);
      URL.revokeObjectURL(localPreview);
      setPreview(null);
    }
  }

  async function remove(asset: MediaAsset) {
    if (!window.confirm("Remover esta imagem? Essa ação não poderá ser desfeita.")) return;
    setProgress(0);
    setMessage(null);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("media_assets").delete().eq("id", asset.id).eq("company_id", companyId);
      if (error) throw error;
      await supabase.storage.from("company-media").remove([asset.storage_path]);
      const next = assets.filter(item => item.id !== asset.id).map((item, index) => ({ ...item, sort_order: index }));
      setAssets(next);
      await Promise.all(next.map(item => supabase.from("media_assets").update({ sort_order: item.sort_order }).eq("id", item.id)));
      setMessage({ type: "success", text: "Imagem removida." });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível remover a imagem." });
    } finally {
      setProgress(null);
    }
  }

  async function clearFallbackReference() {
    if (entityType !== "combo") return;
    setProgress(0);
    setMessage(null);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("combos").update({ image_url: null, updated_at: new Date().toISOString() }).eq("id", entityId).eq("company_id", companyId);
      if (error) throw error;
      setFallbackImage(null);
      setMessage({ type: "success", text: "Foto removida do combo. O arquivo original não foi apagado." });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível remover a foto do combo." });
    } finally {
      setProgress(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= assets.length || busy) return;
    const next = [...assets];
    [next[index], next[target]] = [next[target], next[index]];
    const reordered = next.map((asset, position) => ({ ...asset, sort_order: position }));
    setAssets(reordered);
    const supabase = createClient();
    const results = await Promise.all(reordered.map(asset =>
      supabase.from("media_assets").update({ sort_order: asset.sort_order }).eq("id", asset.id).eq("company_id", companyId)
    ));
    if (results.some(result => result.error)) {
      setAssets(assets);
      setMessage({ type: "error", text: "Não foi possível alterar a ordem." });
    } else {
      setMessage({ type: "success", text: "Ordem atualizada." });
      router.refresh();
    }
  }

  function openPicker(replaceId: string | null = null) {
    replaceIdRef.current = replaceId;
    inputRef.current?.click();
  }

  return <section className="rounded-2xl border bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-bold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
        {recommendedSize && <p className="mt-2 inline-flex rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">Medida recomendada: {recommendedSize}</p>}
      </div>
      {(remaining > 0 || maxFiles === 1) && <button type="button" disabled={busy} onClick={() => openPicker(maxFiles === 1 && assets[0] ? assets[0].id : null)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{maxFiles === 1 && hasImage ? <Replace size={18}/> : <UploadCloud size={18}/>} {label}</button>}
    </div>
    <input ref={inputRef} onChange={chooseFile} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden"/>

    {progress !== null && <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs font-semibold text-emerald-800"><span className="inline-flex items-center gap-1"><Loader2 size={14} className="animate-spin"/> Enviando</span><span>{progress}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }}/></div>
    </div>}
    {message && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{message.text}</p>}

    <div className={`mt-4 grid gap-3 ${maxFiles === 1 ? "grid-cols-1" : aspect === "wide" ? "sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
      {!assets.length && fallbackImage && !preview && <article className="overflow-hidden rounded-xl border bg-gray-50">
        <div className={`relative bg-gray-100 ${aspect === "wide" ? "aspect-[16/7]" : "aspect-square p-2"}`}><img src={fallbackImage} alt={title} className={`h-full w-full ${aspect === "wide" ? "object-cover" : "object-contain"}`}/><span className="absolute left-2 top-2 rounded-full bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white">Principal</span></div>
        <div className="flex justify-end gap-1 p-2"><button type="button" disabled={busy} onClick={() => openPicker()} className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-2 text-xs font-semibold text-orange-700"><Replace size={15}/>Trocar</button><button type="button" disabled={busy} onClick={clearFallbackReference} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-2 text-xs font-semibold text-red-600"><Trash2 size={15}/>Remover</button></div>
      </article>}
      {!assets.length && !fallbackImage && !preview && <div className={`flex min-h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-gray-50 p-5 text-center text-gray-400 ${maxFiles === 1 ? "" : aspect === "wide" ? "sm:col-span-2" : "col-span-2 sm:col-span-3 lg:col-span-4"}`}><ImagePlus/><p className="mt-2 text-sm">Nenhuma imagem. O sistema exibirá a imagem padrão.</p></div>}
      {assets.map((asset, index) => <article key={asset.id} className="overflow-hidden rounded-xl border bg-gray-50">
        <div className={`relative bg-gray-100 ${aspect === "wide" ? "aspect-[16/7]" : "aspect-square p-2"}`}><img src={asset.public_url} alt={asset.alt_text || title} className={`h-full w-full ${aspect === "wide" ? "object-cover" : "object-contain"}`}/>{index === 0 && <span className="absolute left-2 top-2 rounded-full bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white">Principal</span>}</div>
        <div className="flex items-center justify-between gap-1 p-2">
          <div className="flex gap-1"><button type="button" disabled={index === 0 || busy} onClick={() => move(index, -1)} title="Mover para a esquerda" className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowLeft size={15}/></button><button type="button" disabled={index === assets.length - 1 || busy} onClick={() => move(index, 1)} title="Mover para a direita" className="rounded-lg border bg-white p-2 disabled:opacity-30"><ArrowRight size={15}/></button></div>
          <div className="flex gap-1"><button type="button" disabled={busy} onClick={() => openPicker(asset.id)} title="Trocar imagem" className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-2 text-xs font-semibold text-orange-700"><Replace size={15}/><span>Trocar</span></button><button type="button" disabled={busy} onClick={() => remove(asset)} title="Remover" className="rounded-lg bg-red-50 p-2 text-red-600"><Trash2 size={15}/></button></div>
        </div>
      </article>)}
      {preview && <div className={`overflow-hidden rounded-xl border-2 border-emerald-500 bg-gray-50 ${aspect === "wide" ? "aspect-[16/7]" : "aspect-square p-2"}`}><img src={preview} alt="Pré-visualização do envio" className={`h-full w-full ${aspect === "wide" ? "object-cover" : "object-contain"}`}/></div>}
    </div>
  </section>;
}
