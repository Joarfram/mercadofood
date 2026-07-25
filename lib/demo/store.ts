export type OrderStage = "novo" | "preparando" | "pronto" | "aguardando_motoboy" | "em_entrega" | "entregue";

export type Product = { id: string; name: string; price: number; active: boolean };
export type Driver = { id: string; name: string; phone: string; status: "available" | "busy" | "offline"; distance: string };
export type Order = {
  id: string;
  customer: string;
  address: string;
  total: number;
  payment: string;
  items: string[];
  stage: OrderStage;
  driverId?: string;
  updatedAt: string;
};

export type DemoState = { products: Product[]; drivers: Driver[]; orders: Order[] };

export const initialState: DemoState = {
  products: [
    { id: "p1", name: "X-Burger Especial", price: 22.9, active: true },
    { id: "p2", name: "Batata Crocante", price: 12.0, active: true },
    { id: "p3", name: "Refrigerante Lata", price: 6.0, active: true },
  ],
  drivers: [
    { id: "d1", name: "Carlos Silva", phone: "(79) 9 9000-1111", status: "available", distance: "1,8 km" },
    { id: "d2", name: "Marcos Santos", phone: "(79) 9 9000-2222", status: "busy", distance: "Em entrega" },
    { id: "d3", name: "João Paulo", phone: "(79) 9 9000-3333", status: "offline", distance: "—" },
  ],
  orders: [
    {
      id: "452",
      customer: "Maria Silva",
      address: "Rua José Avelino, 456 • Farolândia",
      total: 40.9,
      payment: "PIX",
      items: ["1x X-Burger Especial", "1x Batata Crocante", "1x Refrigerante Lata"],
      stage: "novo",
      updatedAt: new Date().toISOString(),
    },
  ],
};

const KEY = "mercadofood-demo-v03";

export function loadState(): DemoState {
  if (typeof window === "undefined") return initialState;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return initialState;
  try { return JSON.parse(raw) as DemoState; } catch { return initialState; }
}

export function saveState(state: DemoState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("mercadofood-state"));
}

export function resetState() {
  saveState(initialState);
}

export const stageLabel: Record<OrderStage, string> = {
  novo: "Novo",
  preparando: "Preparando",
  pronto: "Pronto",
  aguardando_motoboy: "Aguardando motoboy",
  em_entrega: "Em entrega",
  entregue: "Entregue",
};
