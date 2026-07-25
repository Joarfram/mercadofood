"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function submitPublicComboOrder(payload: unknown) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data, error } = await supabase.rpc("create_public_combo_order", { p_payload: payload });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, data };
}
