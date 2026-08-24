import Link from "next/link";

export default async function NoPermissionPage({searchParams}:{searchParams:Promise<{recurso?:string}>}) {
  const {recurso}=await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#f7faf8] p-6">
    <div className="max-w-md rounded-3xl border bg-white p-8 text-center">
      <div className="text-5xl">🔒</div>
      <h1 className="mt-4 text-2xl font-bold">{recurso?"Recurso indisponível":"Acesso não autorizado"}</h1>
      <p className="mt-2 text-gray-600">{recurso?"Este recurso não está disponível no seu plano atual.":"Seu perfil não possui permissão para abrir este módulo. Fale com o proprietário ou gerente da empresa."}</p>
      {recurso&&<Link href="/assinatura" className="mt-4 block font-bold text-emerald-700">Ver meu plano</Link>}
      <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Voltar ao painel</Link>
    </div>
  </main>;
}
