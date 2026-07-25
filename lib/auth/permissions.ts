export const companyRoles = [
  "owner", "manager", "attendant", "kitchen", "cashier", "stock", "driver", "viewer"
] as const;

export type CompanyRole = (typeof companyRoles)[number];
export type ModuleKey =
  | "dashboard" | "orders" | "products" | "kitchen" | "delivery"
  | "payments" | "finance" | "reports" | "stock" | "customers"
  | "promotions" | "tables" | "settings" | "team";

export const roleLabels: Record<CompanyRole, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  attendant: "Atendente",
  kitchen: "Cozinha",
  cashier: "Caixa",
  stock: "Estoque",
  driver: "Motoboy",
  viewer: "Somente relatórios"
};

const all: ModuleKey[] = ["dashboard","orders","products","kitchen","delivery","payments","finance","reports","stock","customers","promotions","tables","settings","team"];

export const roleModules: Record<CompanyRole, ModuleKey[]> = {
  owner: all,
  manager: all,
  attendant: ["dashboard","orders","kitchen","delivery","payments","customers","tables"],
  kitchen: ["dashboard","orders","kitchen"],
  cashier: ["dashboard","orders","payments","finance","reports"],
  stock: ["dashboard","products","stock"],
  driver: ["delivery"],
  viewer: ["dashboard","reports"]
};

export function canAccess(role: CompanyRole, module: ModuleKey) {
  return roleModules[role]?.includes(module) ?? false;
}
