export type OrderVisibilityInput = { status: string; payment_status?: string | null };

const settledPaymentStatuses = new Set(["paid", "canceled", "refunded"]);

export function isOperationalOrder(order: OrderVisibilityInput) {
  if (order.status === "canceled") return false;
  if (order.status !== "delivered") return true;
  return !settledPaymentStatuses.has(order.payment_status || "pending");
}

export function isHistoricalOrder(order: OrderVisibilityInput) {
  return !isOperationalOrder(order);
}



