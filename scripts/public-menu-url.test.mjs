import assert from "node:assert/strict";
import { buildPublicMenuUrl, OFFICIAL_APP_ORIGIN } from "../lib/public-menu-url.ts";

assert.equal(OFFICIAL_APP_ORIGIN, "https://www.meumercadofood.com");
assert.equal(
  buildPublicMenuUrl("acaraje-da-kelly"),
  "https://www.meumercadofood.com/cardapio/acaraje-da-kelly",
);
assert.equal(
  buildPublicMenuUrl("pizzaria-central"),
  "https://www.meumercadofood.com/cardapio/pizzaria-central",
);
assert.equal(
  buildPublicMenuUrl("  slug-atualizado  "),
  "https://www.meumercadofood.com/cardapio/slug-atualizado",
);
assert.throws(() => buildPublicMenuUrl(""), /slug da loja é obrigatório/i);

console.log("public-menu-url: 4 cenários aprovados");
