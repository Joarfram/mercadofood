"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendStoreOrderNotification } from "@/lib/whatsapp/order-notifications";

async function createPublicSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* Cardápio público não depende de sessão. */ }
      }
    }
  );
}

export async function previewPublicCoupon(input: { slug: string; code: string; subtotal: number }) {
  const supabase = await createPublicSupabaseClient();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { ok: false as const, error: "Informe o código do cupom." };
  if (!Number.isFinite(input.subtotal) || input.subtotal <= 0) return { ok: false as const, error: "Adicione produtos antes de aplicar o cupom." };

  const { data, error } = await supabase.rpc("preview_public_coupon", {
    p_slug: input.slug,
    p_code: code,
    p_subtotal: input.subtotal
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, data };
}

export async function submitPublicOrder(payload: unknown) {
  const supabase = await createPublicSupabaseClient();

  const input = payload as {
    slug?: string;
    service_type?: string;
    delivery_zone_id?: string;
    items?: unknown[];
  };

  const [{ data: serviceConfig }, { data: zones }] = await Promise.all([
    supabase.rpc("get_public_service_config", { p_slug: input.slug || "" }),
    supabase.rpc("get_public_delivery_zones", { p_slug: input.slug || "" }),
  ]);

  if (input.service_type === "delivery" && !serviceConfig?.delivery_enabled) {
    return { ok: false as const, error: "A loja não está recebendo pedidos para entrega." };
  }
  if (input.service_type === "pickup" && !serviceConfig?.pickup_enabled) {
    return { ok: false as const, error: "A loja não está recebendo pedidos para retirada." };
  }
  if (input.service_type === "delivery" && Array.isArray(zones) && zones.length && !input.delivery_zone_id) {
    return { ok: false as const, error: "Selecione um bairro atendido pela loja." };
  }

  const { data: created, error } = await supabase.rpc("create_public_order", { p_payload: payload });
  if (error) return { ok: false as const, error: error.message };
  if (!created?.order_id || !created?.public_code) {
    return { ok: false as const, error: "O pedido foi criado, mas não pôde ser finalizado corretamente." };
  }

  const { error: finalizeError } = await supabase.rpc(
    "delivery_simple_finalize_public_order",
    {
      p_order_id: created.order_id,
      p_public_code: created.public_code,
      p_items: Array.isArray(input.items) ? input.items : [],
    }
  );
  if (finalizeError) return { ok: false as const, error: finalizeError.message };

  if (input.service_type === "delivery" && input.delivery_zone_id) {
    const { error: zoneError } = await supabase.rpc("apply_public_order_delivery_zone", {
      p_order_id: created.order_id,
      p_zone_id: input.delivery_zone_id,
    });
    if (zoneError) return { ok: false as const, error: zoneError.message };
  }

  // Última conferência do servidor: peso/complementos + cupom + taxa de entrega + pagamento.
  // Isso garante que o valor exibido após o pedido seja o mesmo valor persistido/cobrado.
  const { data: reconciled, error: reconcileError } = await supabase.rpc(
    "delivery_simple_reconcile_public_order_totals",
    {
      p_order_id: created.order_id,
      p_public_code: created.public_code,
    }
  );
  if (reconcileError) return { ok: false as const, error: reconcileError.message };

  // Só depois do total definitivo criamos os documentos de saída.
  // Assim WhatsApp e impressão recebem exatamente o mesmo valor salvo no pedido.
  const { error: outputError } = await supabase.rpc("delivery_simple_queue_public_order_outputs", {
    p_order_id: created.order_id,
    p_public_code: created.public_code,
  });
  if (outputError) {
    console.error("[delivery-simple] falha ao enfileirar saídas do pedido", outputError.message);
  } else {
    const whatsAppResult = await sendStoreOrderNotification(created.order_id);
    if (!whatsAppResult.ok && !whatsAppResult.skipped) {
      console.error("[delivery-simple] falha ao enviar aviso do pedido pelo WhatsApp", whatsAppResult.error);
    }
  }

  return { ok: true as const, data: reconciled || created };
}