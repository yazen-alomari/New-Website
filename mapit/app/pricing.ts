import { receivedQuantity, type Order } from "./model.ts";

export function pricedTotal(lines: { quantity: number; cost: number | null }[]) {
  const relevant = lines.filter(line => line.quantity > 0);
  const unpriced = relevant.filter(line => line.cost === null).length;
  const known = relevant.reduce((sum, line) => sum + Math.round(line.quantity * (line.cost ?? 0)), 0);
  return { value: relevant.length > 0 && unpriced === relevant.length ? null : known, known, unpriced, count: relevant.length };
}

export function purchasingSummary(orders: Order[], month: string) {
  const rows = orders.filter(order => order.date.startsWith(month) && order.status !== "draft");
  const lines = rows.flatMap(order => order.lines.map(line => ({ quantity: order.status === "cancelled" ? receivedQuantity(order, line) : line.quantity, cost: line.cost })));
  return pricedTotal(lines);
}
