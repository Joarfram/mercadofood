"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DriverGps({ driverId, enabled }: { driverId: string; enabled: boolean }) {
  const [message, setMessage] = useState(enabled ? "Aguardando GPS..." : "GPS pausado");
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    const supabase = createClient();
    const watch = navigator.geolocation.watchPosition(async (position) => {
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      const { error } = await supabase.from("driver_locations").insert({ driver_id: driverId, latitude, longitude, accuracy_meters: accuracy, heading, speed_mps: speed });
      setMessage(error ? "Não foi possível enviar a localização" : "GPS ativo • localização atualizada");
    }, () => setMessage("Ative a permissão de localização"), { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [driverId, enabled]);
  return <p className={`text-xs ${enabled ? "text-emerald-300" : "text-slate-500"}`}>{message}</p>;
}
