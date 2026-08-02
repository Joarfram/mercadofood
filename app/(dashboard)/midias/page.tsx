import { requireModule } from "@/lib/auth/current-company";
import { MediaManager } from "@/components/media/media-manager";
import type { MediaAsset } from "@/lib/media/types";

type AssetWithKind = MediaAsset & { kind: "gallery" | "logo" | "banner"; entity_id: string };

export default async function MidiasPage() {
  const { supabase, company, role } = await requireModule("products");
  const { data: assets } = await supabase.from("media_assets").select("id,entity_id,kind,storage_path,public_url,alt_text,mime_type,byte_size,sort_order").eq("company_id", company.id).eq("entity_type", "company").order("sort_order");
  const allAssets = (assets || []) as AssetWithKind[];
  const forEntity = (entityId: string, kind = "gallery") =>
    allAssets.filter(asset => asset.entity_id === entityId && asset.kind === kind);
  const canManageBrand = role === "owner" || role === "manager";

  return <main className="space-y-8 pb-16">
    <header>
      <p className="text-sm font-semibold text-emerald-700">Biblioteca visual</p>
      <h1 className="text-3xl font-bold">Fotos e imagens</h1>
      <p className="mt-2 max-w-3xl text-gray-600">Gerencie somente a logomarca e o banner da {company.name}. As fotos dos produtos agora ficam no próprio cadastro de cada produto.</p>
    </header>

    {canManageBrand && <section>
      <h2 className="mb-4 text-xl font-bold">Identidade da loja</h2>
      <div className="grid gap-5 lg:grid-cols-2">
        <MediaManager companyId={company.id} entityType="company" entityId={company.id} kind="logo" initialAssets={forEntity(company.id, "logo")} title="Logomarca" description="Use uma imagem quadrada, centralizada e com pequena margem nas bordas." recommendedSize="800 × 800 px (proporção 1:1)" maxFiles={1}/>
        <MediaManager companyId={company.id} entityType="company" entityId={company.id} kind="banner" initialAssets={forEntity(company.id, "banner")} title="Banner do cardápio" description="Mantenha textos e elementos importantes no centro para não cortar no celular." recommendedSize="1600 × 700 px (proporção 16:7)" maxFiles={1} aspect="wide"/>
      </div>
    </section>}

  </main>;
}
