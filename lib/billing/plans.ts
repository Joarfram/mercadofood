import type { ModuleKey } from "@/lib/auth/permissions";

export type PlanCode = "basic" | "professional" | "premium";

export type PlanDefinition = {
  code: PlanCode;
  name: string;
  promise: string;
  description: string;
  userLimit: number;
  branchLimit: number;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  modules: ModuleKey[];
  highlights: string[];
};

export const plans: Record<PlanCode, PlanDefinition> = {
  basic: {
    code: "basic",
    name: "Básico",
    promise: "Vender",
    description: "Para colocar o cardápio online e começar a receber pedidos.",
    userLimit: 2,
    branchLimit: 1,
    monthlyPrice: 75,
    annualMonthlyPrice: 49.90,
    modules: ["dashboard", "orders", "products", "promotions", "marketing", "messages", "settings"],
    highlights: ["Cardápio digital e QR Code", "Produtos, fotos, categorias e combos", "Pedidos para delivery e retirada", "Complementos, cupons e PIX manual"],
  },
  professional: {
    code: "professional",
    name: "Profissional",
    promise: "Operar",
    description: "Para organizar equipe, cozinha, salão e entregas.",
    userLimit: 6,
    branchLimit: 1,
    monthlyPrice: 150,
    annualMonthlyPrice: 99.90,
    modules: ["dashboard", "orders", "products", "kitchen", "delivery", "payments", "finance", "reports", "customers", "promotions", "marketing", "messages", "tables", "settings", "team"],
    highlights: ["Tudo do Básico", "Painel da cozinha, mesas e comandas", "Caixa, clientes e fidelidade", "Entregadores, rastreamento e relatórios"],
  },
  premium: {
    code: "premium",
    name: "Premium",
    promise: "Crescer",
    description: "Para controlar custos, estoque, unidades e decisões de crescimento.",
    userLimit: 15,
    branchLimit: 3,
    monthlyPrice: 225,
    annualMonthlyPrice: 149.90,
    modules: ["dashboard", "orders", "products", "kitchen", "delivery", "payments", "finance", "reports", "stock", "customers", "promotions", "marketing", "messages", "tables", "settings", "team"],
    highlights: ["Tudo do Profissional", "Estoque e ficha técnica", "Custos, margens e relatórios avançados", "Até 3 unidades e suporte Premium"],
  },
};

export const moduleLabels: Record<ModuleKey, string> = {
  dashboard: "Dashboard", orders: "Pedidos", products: "Cardápio e produtos", kitchen: "Painel da cozinha",
  delivery: "Entregadores e rastreamento", payments: "Pagamentos", finance: "Caixa", reports: "Relatórios",
  stock: "Estoque e ficha técnica", customers: "Clientes e fidelidade", promotions: "Promoções e cupons",
  marketing: "MercadoFood Impulsiona", messages: "Mensagens e avaliações", tables: "Mesas e comandas", settings: "Configurações", team: "Usuários e permissões",
};

export const paidAddons = [
  { code: "online_payments", name: "Pagamento online", description: "Cartão, PIX dinâmico e confirmação automática." },
  { code: "whatsapp_automation", name: "WhatsApp automatizado", description: "Mensagens automáticas sobre pedidos e entregas." },
  { code: "impulsiona", name: "MercadoFood Impulsiona", description: "Campanhas e divulgação dos produtos." },
  { code: "creative_ai", name: "Criação com IA", description: "Artes e textos promocionais gerados por IA." },
  { code: "extra_branch", name: "Unidade adicional", description: "Amplia o número de unidades da empresa." },
  { code: "extra_users", name: "Usuários adicionais", description: "Amplia o limite de colaboradores." },
] as const;

export function isPlanCode(value: unknown): value is PlanCode {
  return value === "basic" || value === "professional" || value === "premium";
}

export function planAllows(planCode: PlanCode, module: ModuleKey) {
  return plans[planCode].modules.includes(module);
}
