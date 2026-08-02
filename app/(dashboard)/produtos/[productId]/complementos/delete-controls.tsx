"use client";

import { deleteOption, deleteOptionGroup } from "./actions";

export function DeleteGroupForm({ productId, groupId, groupName }: { productId: string; groupId: string; groupName: string }) {
  return <form action={deleteOptionGroup} onSubmit={event => {
    if (!window.confirm(`Excluir o grupo "${groupName}" e todas as opções cadastradas nele?`)) event.preventDefault();
  }}>
    <input type="hidden" name="productId" value={productId}/><input type="hidden" name="groupId" value={groupId}/>
    <button className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">Excluir grupo</button>
  </form>;
}

export function DeleteOptionForm({ productId, optionId, optionName }: { productId: string; optionId: string; optionName: string }) {
  return <form action={deleteOption} onSubmit={event => {
    if (!window.confirm(`Excluir a opção "${optionName}"?`)) event.preventDefault();
  }}>
    <input type="hidden" name="productId" value={productId}/><input type="hidden" name="optionId" value={optionId}/>
    <button className="text-sm font-semibold text-red-600">Excluir</button>
  </form>;
}
