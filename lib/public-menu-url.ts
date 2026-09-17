export const OFFICIAL_APP_ORIGIN = "https://www.meumercadofood.com";

export function buildPublicMenuUrl(slug: string) {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    throw new Error("O slug da loja é obrigatório para gerar o link público do cardápio.");
  }

  return new URL(`/cardapio/${encodeURIComponent(normalizedSlug)}`, OFFICIAL_APP_ORIGIN).toString();
}
