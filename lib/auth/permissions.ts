export const companyRoles = [
  "owner", "manager", "attendant", "kitchen", "cashier", "stock", "driver", "viewer"
] as const;

export type CompanyRole = (typeof companyRoles)[number];
export type ModuleKey =
  | "dashboard" | "orders" | "products" | "kitchen" | "delivery" | "drivers"
  | "payments" | "finance" | "reports" | "stock" | "stock_basic" | "stock_advanced"
  | "recipes" | "costs" | "multiunit_reports" | "customers"
  | "promotions" | "marketing" | "messages" | "tables" | "settings" | "team";

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

const all: ModuleKey[] = [
  "dashboard","orders","products","kitchen","delivery","drivers","payments","finance","reports",
  "stock","stock_basic","stock_advanced","recipes","costs","multiunit_reports","customers",
  "promotions","marketing","messages","tables","settings","team"
];

export const roleModules: Record<CompanyRole, ModuleKey[]> = {
  owner: all,
  manager: all,
  attendant: ["dashboard","orders","kitchen","delivery","payments","customers","messages","tables"],
  kitchen: ["dashboard","orders","kitchen"],
  cashier: ["dashboard","orders","payments","finance","reports"],
  stock: ["dashboard","products","stock","stock_basic","stock_advanced","recipes","costs"],
  driver: ["drivers"],
  viewer: ["dashboard","reports","multiunit_reports"]
};

export function canAccess(role: CompanyRole, module: ModuleKey) {
  return roleModules[role]?.includes(module) ?? false;
}
