import { requireModule } from "@/lib/auth/current-company";
import { MediaManager } from "@/components/media/media-manager";
import type { MediaAsset } from "@/lib/media/types";

type AssetWithKind = MediaAsset & { kind: "gallery" | "logo" | "banner"; entity_id: string };

export default async function MidiasPage() {
  const { supabase, company, role } = await requireModule("products");
  const [{ data: products }, { data: combos }, { data: promotions }, { data: assets }] = await Promise.all([
    supabase.from("products").select("id,name").eq("company_id", company.id).order("name"),
    supabase.from("combos").select("id,name").eq("company_id", company.id).order("name"),
    supabase.from("promotions").select("id,title").eq("company_id", company.id).order("created_at", { ascending: false }),
    supabase.from("media_assets").select("id,entity_id,kind,storage_path,public_url,alt_text,mime_type,byte_size,sort_order").eq("company_id", company.id).order("sort_order"),
  ]);
  const allAssets = (assets || []) as AssetWithKind[];
  const forEntity = (entityId: string, kind = "gallery") =>
    allAssets.filter(asset => asset.entity_id === entityId && asset.kind === kind);
  const canManageBrand = role === "owner" || role === "manager";

  return <main className="space-y-8 pb-16">
    <header>
      <p className="text-sm font-semibold text-emerald-700">Biblioteca visual</p>
      <h1 className="text-3xl font-bold">Fotos e imagens</h1>
      <p className="mt-2 max-w-3xl text-gray-600">Adicione, substitua, organize e remova as imagens da {company.name}. A primeira foto de cada galeria aparece como principal no cardápio.</p>
    </header>

    {canManageBrand && <section>
      <h2 className="mb-4 text-xl font-bold">Identidade da loja</h2>
      <div className="grid gap-5 lg:grid-cols-2">
        <MediaManager companyId={company.id} entityType="company" entityId={company.id} kind="logo" initialAssets={forEntity(company.id, "logo")} title="Logomarca" description="Use uma imagem quadrada, centralizada e com pequena margem nas bordas." recommendedSize="800 × 800 px (proporção 1:1)" maxFiles={1}/>
        <MediaManager companyId={company.id} entityType="company" entityId={company.id} kind="banner" initialAssets={forEntity(company.id, "banner")} title="Banner do cardápio" description="Mantenha textos e elementos importantes no centro para não cortar no celular." recommendedSize="1600 × 700 px (proporção 16:7)" maxFiles={1} aspect="wide"/>
      </div>
    </section>}

    <section>
      <h2 className="mb-4 text-xl font-bold">Produtos</h2>
      <div className="grid gap-5 xl:grid-cols-2">
        {(products || []).map(product => <MediaManager key={product.id} companyId={company.id} entityType="product" entityId={product.id} initialAssets={forEntity(product.id)} title={product.name} description="Até 8 fotos. A primeira será a capa do produto e aparecerá inteira no cardápio." recommendedSize="1000 × 1000 px (proporção 1:1)"/> )}
        {!products?.length && <Empty text="Cadastre um produto para adicionar fotos."/>}
      </div>
    </section>

    <section>
      <h2 className="mb-4 text-xl font-bold">Combos</h2>
      <div className="grid gap-5 xl:grid-cols-2">
        {(combos || []).map(combo => <MediaManager key={combo.id} companyId={company.id} entityType="combo" entityId={combo.id} initialAssets={forEntity(combo.id)} title={combo.name} description="Fotos do combo exibidas no cardápio público." recommendedSize="1200 × 600 px (proporção 2:1)"/> )}
        {!combos?.length && <Empty text="Cadastre um combo para adicionar fotos."/>}
      </div>
    </section>

    {canManageBrand && <section>
      <h2 className="mb-4 text-xl font-bold">Promoções</h2>
      <div className="grid gap-5 xl:grid-cols-2">
        {(promotions || []).map(promotion => <MediaManager key={promotion.id} companyId={company.id} entityType="promotion" entityId={promotion.id} initialAssets={forEntity(promotion.id)} title={promotion.title} description="Imagens promocionais horizontais para campanhas e banners." maxFiles={5} aspect="wide"/> )}
        {!promotions?.length && <Empty text="Crie uma promoção para adicionar imagens."/>}
      </div>
    </section>}
  </main>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border-2 border-dashed bg-white p-8 text-center text-gray-500">{text}</p>;
}
