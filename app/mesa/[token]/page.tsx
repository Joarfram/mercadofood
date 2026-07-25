import { createClient } from "@/lib/supabase/server";
import TableMenuClient from "./table-menu-client";
export default async function PublicTablePage({ params, searchParams }:{params:Promise<{token:string}>;searchParams:Promise<{erro?:string}>}) {
  const { token } = await params; const query = await searchParams; const supabase = await createClient();
  const { data:context,error } = await supabase.rpc("get_public_table_context",{p_token:token});
  if(error || !context) return <main className="grid min-h-screen place-items-center p-6"><div className="rounded-2xl border bg-white p-8 text-center"><h1 className="text-2xl font-bold">Mesa indisponível</h1><p className="mt-2 text-gray-500">Confira o QR Code ou peça ajuda à equipe.</p></div></main>;
  return <main className="min-h-screen bg-gray-50">{query.erro&&<div className="mx-auto max-w-4xl p-4"><div className="rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</div></div>}<TableMenuClient token={token} context={context}/></main>;
}
