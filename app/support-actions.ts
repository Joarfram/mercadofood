"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function endSupportMode() {
  const store = await cookies();
  const sessionId = store.get("mf_support_session")?.value;
  if (sessionId) {
    const supabase = await createClient();
    await supabase.rpc("end_support_session", { target_session: sessionId });
  }
  store.delete("mf_support_session");
  redirect("/master/suporte?encerrado=1");
}
