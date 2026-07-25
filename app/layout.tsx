import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MercadoFood",
  description: "Venda mais. Gerencie melhor."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
