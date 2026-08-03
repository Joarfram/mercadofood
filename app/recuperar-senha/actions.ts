"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) redirect("/recuperar-senha?erro=Informe%20seu%20e-mail");
  const origin = (await headers()).get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/atualizar-senha` });
  redirect("/recuperar-senha?sucesso=Confira%20seu%20e-mail%20para%20criar%20uma%20nova%20senha");
}
