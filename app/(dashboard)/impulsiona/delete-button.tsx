"use client";
import { Trash2 } from "lucide-react";
export function DeleteCampaignButton() { return <button onClick={event => { if (!confirm('Excluir esta campanha e seu histórico?')) event.preventDefault(); }} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"><Trash2 size={15}/>Excluir</button>; }
