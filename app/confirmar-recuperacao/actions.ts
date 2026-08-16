"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function confirmPasswordRecovery(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") || "");
  if (!tokenHash) redirect("/recuperar-senha?erro=Link%20de%20recuperação%20inválido");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (error) redirect("/recuperar-senha?erro=Este%20link%20expirou.%20Solicite%20um%20novo%20e-mail");

  redirect("/atualizar-senha");
}
