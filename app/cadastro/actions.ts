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
    const slugBase = companyName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "empresa";
    const slug = `${slugBase}-${data.user.id.slice(0, 8)}`;
    const { error: companyError } = await supabase
      .from("companies")
      .insert({ name: companyName, owner_id: data.user.id, slug });
    if (companyError) {
      redirect(`/cadastro?erro=${encodeURIComponent(companyError.message)}`);
    }
  }
  redirect("/dashboard");
}
