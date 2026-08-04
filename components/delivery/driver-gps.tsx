"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DriverGps({ driverId, deliveryId, enabled }: { driverId: string; deliveryId?: string; enabled: boolean }) {
  const [message, setMessage] = useState(enabled ? "Aguardando GPS..." : "GPS pausado");
  useEffect(() => {
    if (!enabled || !deliveryId || !navigator.geolocation) {
      setMessage("GPS desligado");
      return;
    }
    const supabase = createClient();
    let lastSent = 0;
    const watch = navigator.geolocation.watchPosition(async (position) => {
      const moving = Number(position.coords.speed || 0) > 0.5;
      const minimumInterval = moving ? 20000 : 45000;
      if (Date.now() - lastSent < minimumInterval) return;
      lastSent = Date.now();
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      const { error } = await supabase.from("driver_locations").insert({ delivery_id: deliveryId, driver_id: driverId, latitude, longitude, accuracy_meters: accuracy, heading, speed_mps: speed });
      setMessage(error ? "Não foi possível enviar a localização" : "GPS ativo • localização atualizada");
    }, () => setMessage("Ative a permissão de localização"), { enableHighAccuracy: true, maximumAge: 20000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [deliveryId, driverId, enabled]);
  return <p className={`text-xs ${enabled ? "text-emerald-300" : "text-slate-500"}`}>{message}</p>;
}
