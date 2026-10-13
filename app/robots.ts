import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { const base = process.env.NEXT_PUBLIC_APP_URL || "https://meumercadofood.com"; return { rules: { userAgent: "*", allow: ["/", "/recursos", "/gestao-delivery-simples", "/seguranca", "/sobre"], disallow: ["/dashboard", "/master", "/entregador", "/login", "/cadastro"] }, sitemap: `${base}/sitemap.xml` }; }

