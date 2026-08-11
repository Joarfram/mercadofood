"use client";

import { useState } from "react";

export function DisconnectButton() {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return <button type="button" onClick={() => setConfirming(true)} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700">Desconectar</button>;
  return <div className="flex items-center gap-2"><span className="text-sm text-red-700">Confirmar?</span><button type="submit" className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Sim, desconectar</button><button type="button" onClick={() => setConfirming(false)} className="rounded-xl border px-3 py-2 text-sm">Cancelar</button></div>;
}
