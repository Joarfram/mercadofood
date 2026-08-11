"use client";

import { Trash2 } from "lucide-react";
import { deletePrinter } from "./actions";

export function DeletePrinterButton({ id }: { id: string }) {
  return <form action={deletePrinter} onSubmit={(event) => { if (!confirm("Excluir esta impressora?")) event.preventDefault(); }}><input type="hidden" name="id" value={id}/><button className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700"><Trash2 size={16}/>Excluir</button></form>;
}
