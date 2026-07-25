"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function submitPublicOrder(payload: unknown) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* Cardápio público não depende de sessão. */ }
      }
    }
  );

  const { data, error } = await supabase.rpc("create_public_order", { p_payload: payload });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, data };
}
