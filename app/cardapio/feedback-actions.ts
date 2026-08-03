"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function submitPublicFeedback(payload: unknown) {
  const input = payload as { slug?:string; name?:string; contact?:string; category?:string; rating?:number; message?:string; website?:string };
  if (input.website) return { ok:true as const };
  const category = String(input.category || "feedback");
  const rating = Number(input.rating || 0);
  const message = String(input.message || "").trim();
  if (!input.slug) return { ok:false as const,error:"Estabelecimento inválido." };
  if (!["feedback","suggestion","complaint","praise"].includes(category)) return { ok:false as const,error:"Escolha o tipo da mensagem." };
  if (rating < 1 || rating > 5) return { ok:false as const,error:"Escolha de 1 a 5 estrelas." };
  if (message.length < 5 || message.length > 2000) return { ok:false as const,error:"A mensagem deve ter entre 5 e 2.000 caracteres." };

  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
    cookies:{ getAll(){return cookieStore.getAll();},setAll(){} }
  });
  const { error } = await supabase.rpc("submit_public_feedback",{
    p_slug:String(input.slug),p_customer_name:String(input.name||"").trim(),p_customer_contact:String(input.contact||"").trim(),
    p_category:category,p_rating:rating,p_message:message
  });
  if (error) return { ok:false as const,error:error.message };
  return { ok:true as const };
}
