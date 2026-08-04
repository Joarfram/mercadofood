import type { Metadata, Viewport } from "next";
import { DriverPwaRuntime } from "@/components/delivery/driver-pwa-runtime";

export const metadata: Metadata = {
  title: "MercadoFood Entrega",
  description: "Aplicativo do motoboy para receber, acompanhar e concluir entregas.",
  manifest: "/entregador/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MF Entrega",
  },
  icons: {
    icon: [
      { url: "/mercadofood-entrega-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: "/mercadofood-entrega-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#063D2F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function DriverLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><DriverPwaRuntime />{children}</>;
}
