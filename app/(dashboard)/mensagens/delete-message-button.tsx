"use client";

import { Trash2 } from "lucide-react";
import { deleteMessage } from "./actions";

export function DeleteMessageButton({ id }: { id: string }) {
  return <form action={deleteMessage} onSubmit={event => { if (!window.confirm("Excluir esta mensagem e todas as informações dela? Esta ação não poderá ser desfeita.")) event.preventDefault(); }}><input type="hidden" name="id" value={id}/><button className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"><Trash2 size={16}/>Excluir</button></form>;
}
