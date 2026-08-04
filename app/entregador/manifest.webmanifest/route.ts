import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    id: "/entregador/",
    name: "MercadoFood Entregador",
    short_name: "MF Entregador",
    description: "Receba corridas, abra rotas e atualize entregas com segurança.",
    start_url: "/entregador",
    scope: "/entregador/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#063D2F",
    lang: "pt-BR",
    categories: ["business", "navigation", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: "/mercadofood-icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
      { src: "/mercadofood-icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" },
    ],
    shortcuts: [
      {
        name: "Minhas corridas",
        short_name: "Corridas",
        url: "/entregador",
        icons: [{ src: "/mercadofood-icon.svg", sizes: "192x192", type: "image/svg+xml" }],
      },
    ],
  }, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
