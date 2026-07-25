"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
    if (error) redirect(`/convite/${token}?erro=${encodeURIComponent(error.message)}`);
  }

  const refreshed = await supabase.auth.getUser();
  if (!refreshed.data.user) redirect(`/login?next=${encodeURIComponent(`/convite/${token}`)}&aviso=Confirme%20seu%20e-mail%20para%20aceitar%20o%20convite`);

  const { error } = await supabase.rpc("accept_company_invite", { invite_token: token, member_name: name, member_phone: phone });
  if (error) redirect(`/convite/${token}?erro=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}
