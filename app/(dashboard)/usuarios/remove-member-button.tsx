"use client";
import { removeMember } from "./actions";
export function RemoveMemberButton({memberId,name}:{memberId:string;name:string}){return <form action={removeMember} onSubmit={event=>{if(!window.confirm(`Remover o acesso de ${name}? O histórico será preservado.`))event.preventDefault()}}><input type="hidden" name="memberId" value={memberId}/><button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Remover acesso</button></form>}
