"use client";

import { useEffect } from "react";

export function DriverPwaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/driver-sw.js", { scope: "/entregador/" }).catch(() => {
      // O aplicativo continua funcionando pela internet caso o navegador não aceite o registro.
    });
  }, []);

  return null;
}
