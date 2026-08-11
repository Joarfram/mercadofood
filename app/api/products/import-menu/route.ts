import { NextResponse } from "next/server";
import { requirePlanModule } from "@/lib/auth/current-company";

export const runtime = "nodejs";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 8 * 1024 * 1024;

const menuSchema = {
  type: "object",
  additionalProperties: false,
  required: ["products", "warnings"],
  properties: {
    products: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "name", "description", "price", "confidence"],
        properties: {
          category: { type: "string", maxLength: 80 },
          name: { type: "string", maxLength: 120 },
          description: { type: "string", maxLength: 500 },
          price: { type: "number", minimum: 0, maximum: 1000000 },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    warnings: {
      type: "array",
      maxItems: 20,
      items: { type: "string", maxLength: 300 },
    },
  },
} as const;

function getOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text;
  return response.output
    ?.flatMap(item => item.content || [])
    .find(item => item.type === "output_text")?.text || "";
}

export async function POST(request: Request) {
  await requirePlanModule("products");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "A leitura por IA ainda não foi configurada. Cadastre a chave da OpenAI no ambiente do MercadoFood." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "Escolha uma foto do cardápio." }, { status: 400 });
  }
  if (!allowedTypes.has(image.type) || image.size > maxImageSize) {
    return NextResponse.json({ error: "Envie uma imagem JPG, PNG ou WEBP com até 8 MB." }, { status: 400 });
  }

  const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MENU_IMPORT_MODEL || "gpt-5.6-luna",
      store: false,
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Extraia somente os produtos realmente legíveis deste cardápio. Preserve os nomes, categorias, descrições e preços em reais. Não invente informações. Se uma descrição não existir, use string vazia. Se preço, nome ou categoria estiverem duvidosos, marque confiança baixa e explique em warnings. Ignore telefones, endereços, taxas, horários, títulos promocionais e textos que não sejam produtos.",
          },
          {
            type: "input_image",
            image_url: `data:${image.type};base64,${imageBase64}`,
            detail: "high",
          },
        ],
      }],
      text: {
        format: {
          type: "json_schema",
          name: "mercadofood_menu_import",
          strict: true,
          schema: menuSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    console.error("OpenAI menu import failed", { status: response.status, requestId });
    return NextResponse.json(
      { error: response.status === 429 ? "O limite de leituras foi atingido. Tente novamente em alguns minutos." : "Não foi possível ler esta foto agora. Tente outra imagem mais nítida." },
      { status: response.status === 429 ? 429 : 502 },
    );
  }

  const payload = await response.json();
  const outputText = getOutputText(payload);
  try {
    return NextResponse.json(JSON.parse(outputText));
  } catch {
    console.error("OpenAI menu import returned invalid structured output");
    return NextResponse.json({ error: "A leitura não retornou produtos válidos. Tente uma foto mais nítida." }, { status: 502 });
  }
}
