"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Wifi, WifiOff } from "lucide-react";

export function DriverAppStatus({ deliveryId }: { deliveryId?: string }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    const refreshConnection = () => setOnline(navigator.onLine);
    refreshConnection();
    window.addEventListener("online", refreshConnection);
    window.addEventListener("offline", refreshConnection);
    return () => {
      window.removeEventListener("online", refreshConnection);
      window.removeEventListener("offline", refreshConnection);
    };
  }, []);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (!deliveryId || !("Notification" in window)) return;
    const previous = window.localStorage.getItem("mercadofood:last-driver-delivery");
    if (previous && previous !== deliveryId && Notification.permission === "granted") {
      new Notification("Nova corrida MercadoFood", { body: "Abra o aplicativo para conferir e responder.", icon: "/mercadofood-icon.svg" });
    }
    window.localStorage.setItem("mercadofood:last-driver-delivery", deliveryId);
  }, [deliveryId]);

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  }

  return <div className="flex flex-wrap items-center gap-2 text-xs">
    <span className={`flex items-center gap-1 rounded-full px-3 py-1.5 ${online ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-200"}`}>
      {online ? <Wifi size={14}/> : <WifiOff size={14}/>} {online ? "Conectado" : "Sem internet"}
    </span>
    {notificationPermission !== "unsupported" && notificationPermission !== "granted" && <button type="button" onClick={enableNotifications} className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-slate-200"><Bell size={14}/>Ativar alertas</button>}
    {notificationPermission === "granted" && <span className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-slate-300"><BellRing size={14}/>Alertas ativos</span>}
  </div>;
}
