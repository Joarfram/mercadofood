"use client";

import { deleteProduct } from "./actions";

export function DeleteProductForm({ productId, productName }: { productId: string; productName: string }) {
  return <form
    action={deleteProduct}
    onSubmit={event => {
      if (!window.confirm(`Excluir permanentemente o produto "${productName}"? A descrição, fotos, complementos e ficha técnica também serão removidos.`)) {
        event.preventDefault();
      }
    }}
    className="mt-4 border-t pt-4"
  >
    <input type="hidden" name="productId" value={productId}/>
    <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Excluir produto permanentemente</button>
  </form>;
}
