import assert from "node:assert/strict";
import { isHistoricalOrder, isOperationalOrder } from "../lib/orders/visibility.ts";

const cases = [
  ["novo permanece na fila", { status: "new", payment_status: "pending" }, true],
  ["em preparo permanece na fila", { status: "preparing", payment_status: "paid" }, true],
  ["entregue com pagamento pendente permanece na fila", { status: "delivered", payment_status: "pending" }, true],
  ["entregue com pagamento em analise permanece na fila", { status: "delivered", payment_status: "under_review" }, true],
  ["entregue e pago vai ao historico", { status: "delivered", payment_status: "paid" }, false],
  ["cancelado vai ao historico", { status: "canceled", payment_status: "pending" }, false],
];

for (const [name, order, expectedOperational] of cases) {
  assert.equal(isOperationalOrder(order), expectedOperational, name);
  assert.equal(isHistoricalOrder(order), !expectedOperational, `${name} (historico)`);
}

const yesterday = { status: "delivered", payment_status: "paid", created_at: "2026-09-15T23:59:00-03:00" };
assert.equal(isOperationalOrder(yesterday), false, "pedido concluido do dia anterior nao volta para a fila");
console.log(`Order visibility checks passed (${cases.length + 1} scenarios).`);



