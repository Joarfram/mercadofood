"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendStoreOrderNotification } from "@/lib/whatsapp/order-notifications";

export async function submitPublicComboOrder(payload: unknown) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data, error } = await supabase.rpc("delivery_simple_create_public_combo_order", { p_payload: payload });
  if (error) return { ok: false as const, error: error.message };
  if (!data?.order_id || !data?.public_code) {
    return { ok: false as const, error: "O pedido do combo foi criado sem uma identificação válida." };
  }

  // Combo e pedido normal passam pela mesma fila operacional.
  // Se WhatsApp ou impressão falharem, o pedido continua válido e pode ser reprocessado.
  const { error: outputError } = await supabase.rpc("delivery_simple_queue_public_order_outputs", {
    p_order_id: data.order_id,
    p_public_code: data.public_code,
  });

  if (outputError) {
    console.error("[delivery-simple] falha ao enfileirar saídas do combo", outputError.message);
  } else {
    const whatsAppResult = await sendStoreOrderNotification(data.order_id);
    if (!whatsAppResult.ok && !whatsAppResult.skipped) {
      console.error("[delivery-simple] falha ao enviar aviso do combo pelo WhatsApp", whatsAppResult.error);
    }
  }

  return { ok: true as const, data };
}
