import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://mercadofood.com.br"),
  title: { default: "MercadoFood | Venda mais. Gerencie melhor.", template: "%s | MercadoFood" },
  description: "MercadoFood é uma plataforma para cardápio digital, pedidos, delivery, pagamentos e gestão de negócios de alimentação.",
  keywords: ["cardápio digital", "gestão de delivery", "sistema para restaurante", "pedidos online", "MercadoFood"],
  openGraph: { type: "website", locale: "pt_BR", siteName: "MercadoFood", title: "MercadoFood | Venda mais. Gerencie melhor.", description: "Cardápio digital, pedidos, delivery, pagamentos e gestão em uma única plataforma." }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="mf-app-theme">{children}</body>
    </html>
  );
}

