import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;
  const cleanCode = decodeURIComponent(codigo || "").trim();

  if (!cleanCode || cleanCode.length > 80) {
    return NextResponse.json({ error: "Código de rastreamento inválido." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_order_tracking", {
      p_code: cleanCode,
    });

    if (error) {
      return NextResponse.json({ error: "Não foi possível consultar o pedido." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Rastreamento indisponível. Verifique a configuração do Supabase." },
      { status: 503 }
    );
  }
}
