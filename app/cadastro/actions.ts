"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const companyName = String(formData.get("companyName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { company_name: companyName } }
  });
  if (error) redirect(`/cadastro?erro=${encodeURIComponent(error.message)}`);

  if (data.user) {
    await supabase.from("companies").insert({ name: companyName, owner_id: data.user.id });
  }
  redirect("/dashboard");
}
