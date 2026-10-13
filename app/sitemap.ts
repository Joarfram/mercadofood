import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap { const base = (process.env.NEXT_PUBLIC_APP_URL || "https://meumercadofood.com").replace(/\/$/, ""); const pages = ["", "/recursos", "/gestao-delivery-simples", "/seguranca", "/sobre", "/termos", "/privacidade"]; return pages.map(path => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : 0.7 })); }

