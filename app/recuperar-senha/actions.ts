"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) redirect("/recuperar-senha?erro=Informe%20seu%20e-mail");
  const origin = (await headers()).get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/atualizar-senha` });
  if (error) {
    console.error("password_reset_request_failed", { code: error.code, status: error.status });
    const message = error.status === 429
      ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
      : "Não foi possível enviar o e-mail. Verifique a configuração do serviço de e-mail.";
    redirect(`/recuperar-senha?erro=${encodeURIComponent(message)}`);
  }
  redirect("/recuperar-senha?sucesso=Confira%20seu%20e-mail%20para%20criar%20uma%20nova%20senha");
}
