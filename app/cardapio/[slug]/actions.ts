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

  const input = payload as { slug?: string; service_type?: string; delivery_zone_id?: string };
  const [{ data: serviceConfig }, { data: zones }] = await Promise.all([
    supabase.rpc('get_public_service_config',{p_slug:input.slug || ''}),
    supabase.rpc('get_public_delivery_zones',{p_slug:input.slug || ''}),
  ]);
  if (input.service_type === 'delivery' && !serviceConfig?.delivery_enabled) return { ok:false as const,error:'A loja não está recebendo pedidos para entrega.' };
  if (input.service_type === 'pickup' && !serviceConfig?.pickup_enabled) return { ok:false as const,error:'A loja não está recebendo pedidos para retirada.' };
  if (input.service_type === 'delivery' && Array.isArray(zones) && zones.length && !input.delivery_zone_id) return { ok:false as const,error:'Selecione um bairro atendido pela loja.' };
  const { data, error } = await supabase.rpc("create_public_order", { p_payload: payload });
  if (error) return { ok: false as const, error: error.message };
  if (input.service_type === 'delivery' && input.delivery_zone_id) {
    const { data: adjusted, error: zoneError } = await supabase.rpc('apply_public_order_delivery_zone',{p_order_id:data.order_id,p_zone_id:input.delivery_zone_id});
    if (zoneError) return { ok:false as const,error:zoneError.message };
    return { ok:true as const,data:adjusted };
  }
  return { ok: true as const, data };
}
