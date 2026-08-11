import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlanModule } from "@/lib/auth/current-company";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeEmbeddedSignupCode, getWhatsAppPhone, subscribeWhatsAppAccount } from "@/lib/whatsapp/cloud-api";
import { encryptWhatsAppToken } from "@/lib/whatsapp/token-crypto";

const schema = z.object({ code: z.string().min(10).max(4000), wabaId: z.string().regex(/^\d+$/), phoneNumberId: z.string().regex(/^\d+$/) });

export async function POST(request: Request) {
  const { company, role } = await requirePlanModule("messages");
  if (!['owner','manager'].includes(role)) return NextResponse.json({ error: "Sem permissão para conectar o WhatsApp." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A autorização recebida da Meta é inválida." }, { status: 400 });

  try {
    const accessToken = await exchangeEmbeddedSignupCode(parsed.data.code);
    await subscribeWhatsAppAccount(parsed.data.wabaId, accessToken);
    const phone = await getWhatsAppPhone(parsed.data.phoneNumberId, accessToken);
    const encrypted = encryptWhatsAppToken(accessToken);
    const admin = createAdminClient();
    const { error } = await admin.from("whatsapp_integrations").upsert({
      company_id: company.id,
      status: "connected",
      waba_id: parsed.data.wabaId,
      phone_number_id: parsed.data.phoneNumberId,
      display_phone_number: phone.displayPhoneNumber,
      encrypted_access_token: encrypted.encryptedAccessToken,
      token_iv: encrypted.tokenIv,
      token_tag: encrypted.tokenTag,
      last_error: null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true, phone: phone.displayPhoneNumber });
  } catch (error) {
    console.error("WhatsApp embedded signup failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível conectar o WhatsApp." }, { status: 502 });
  }
}
