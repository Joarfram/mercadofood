export type SellingMode = "unit" | "weight" | "fixed_weight";

export type WeightOption = {
  quantity: number;
  unit: "g" | "kg";
  price: number;
};

export type WeightedProductPricing = {
  selling_mode?: SellingMode;
  price: number;
  reference_quantity?: number | null;
  reference_unit?: "g" | "kg" | null;
  minimum_sale_quantity?: number | null;
  sale_increment?: number | null;
  fixed_weight_options?: WeightOption[] | null;
};

export function toGrams(quantity: number, unit: "g" | "kg") {
  return unit === "kg" ? quantity * 1000 : quantity;
}

export function fromGrams(quantityInGrams: number, unit: "g" | "kg") {
  return unit === "kg" ? quantityInGrams / 1000 : quantityInGrams;
}

export function calculateWeightedPrice(product: WeightedProductPricing, chosenQuantity: number, chosenUnit: "g" | "kg" = "g") {
  if (product.selling_mode !== "weight") return Number(product.price || 0);
  const referenceQuantity = Number(product.reference_quantity || 0);
  const referenceUnit = product.reference_unit || "g";
  if (referenceQuantity <= 0) return 0;

  const chosenInGrams = toGrams(Number(chosenQuantity || 0), chosenUnit);
  const referenceInGrams = toGrams(referenceQuantity, referenceUnit);
  return Number(((chosenInGrams / referenceInGrams) * Number(product.price || 0)).toFixed(2));
}

export function normalizeWeightSelection(product: WeightedProductPricing, requestedQuantity: number, unit: "g" | "kg" = "g") {
  const requestedInGrams = toGrams(Math.max(0, Number(requestedQuantity || 0)), unit);
  // No Gestão Delivery Simples, mínimo e incremento são sempre persistidos em gramas,
  // independentemente da unidade usada como referência do preço (ex.: R$ 24/kg).
  const minimum = Math.max(0, Number(product.minimum_sale_quantity || 0));
  const increment = Math.max(0, Number(product.sale_increment || 0));

  const base = Math.max(requestedInGrams, minimum || requestedInGrams);
  if (!increment) return base;
  const steps = Math.max(0, Math.ceil((base - minimum) / increment));
  return minimum + steps * increment;
}

export function formatWeight(quantityInGrams: number) {
  if (quantityInGrams >= 1000 && quantityInGrams % 1000 === 0) return `${quantityInGrams / 1000} kg`;
  return `${quantityInGrams} g`;
}
