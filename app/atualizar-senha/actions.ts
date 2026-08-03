"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 8) redirect("/atualizar-senha?erro=A%20senha%20deve%20ter%20ao%20menos%208%20caracteres");
  if (password !== confirm) redirect("/atualizar-senha?erro=As%20senhas%20não%20coincidem");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/atualizar-senha?erro=${encodeURIComponent(error.message)}`);
  redirect("/login?sucesso=Senha%20atualizada");
}
