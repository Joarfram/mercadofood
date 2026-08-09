import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [orders, kitchen, finance, securityMigration, transactionMigration] = await Promise.all([
  read("app/(dashboard)/pedidos/actions.ts"),
  read("app/(dashboard)/cozinha/actions.ts"),
  read("app/(dashboard)/financeiro/actions.ts"),
  read("supabase/migrations/0037_security_permissions_hardening.sql"),
  read("supabase/migrations/0038_staff_order_transaction.sql"),
]);

assert.match(orders, /requirePlanModule\("orders"\)/, "Pedidos deve validar o módulo no servidor.");
assert.match(orders, /create_staff_order/, "Pedido interno deve usar a função transacional.");
assert.match(kitchen, /requirePlanModule\("kitchen"\)/, "Cozinha deve validar o módulo no servidor.");
assert.match(finance, /requirePlanModule\("finance"\)/, "Financeiro deve validar o módulo no servidor.");
assert.match(securityMigration, /revoke all on function %s from public/i, "Funções privilegiadas devem revogar PUBLIC.");
assert.match(securityMigration, /authorized roles create orders/i, "RLS de pedidos deve exigir função autorizada.");
assert.match(transactionMigration, /pg_advisory_xact_lock/i, "Pedido deve serializar a chave de idempotência.");
assert.match(transactionMigration, /orders_company_idempotency_unique/i, "Pedido deve ter unicidade por empresa e chave.");

console.log("Security regression checks passed.");
