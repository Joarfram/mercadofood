import { MapPin, Navigation, Store, Bike } from "lucide-react";

export function MockMap({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-emerald-100 bg-[#eef5ef] ${compact ? "h-64" : "h-[420px]"}`}>
      <div className="absolute inset-0 opacity-70" style={{backgroundImage: "linear-gradient(35deg, transparent 46%, #d6e4d8 47%, #d6e4d8 51%, transparent 52%), linear-gradient(120deg, transparent 46%, #dfe8e1 47%, #dfe8e1 50%, transparent 51%)", backgroundSize: "76px 76px, 110px 110px"}} />
      <div className="absolute left-[12%] top-[20%] h-2 w-[72%] rotate-6 rounded-full bg-blue-400/80" />
      <div className="absolute left-[48%] top-[16%] h-[62%] w-2 -rotate-12 rounded-full bg-emerald-500/80" />
      <div className="absolute left-[44%] top-[12%] rounded-full bg-slate-900 p-3 text-white shadow-lg"><Store size={20}/></div>
      <div className="absolute left-[25%] top-[58%] rounded-full bg-emerald-600 p-3 text-white shadow-lg"><Bike size={20}/></div>
      <div className="absolute right-[18%] top-[36%] rounded-full bg-emerald-600 p-3 text-white shadow-lg"><Bike size={20}/></div>
      <div className="absolute right-[12%] bottom-[14%] rounded-full bg-orange-500 p-3 text-white shadow-lg"><MapPin size={20}/></div>
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-xs font-medium shadow"><Navigation size={15} className="text-emerald-700"/>Localização atualizada agora</div>
    </div>
  );
}
