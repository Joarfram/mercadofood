export type MediaEntityType = "product" | "company" | "promotion" | "combo";
export type MediaKind = "gallery" | "logo" | "banner";

export type MediaAsset = {
  id: string;
  storage_path: string;
  public_url: string;
  alt_text: string | null;
  mime_type: string;
  byte_size: number;
  sort_order: number;
};
