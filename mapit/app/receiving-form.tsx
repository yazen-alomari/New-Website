"use client";
import { useState } from "react";
import { Field } from "./forms";
import { qty, remainingQuantity, today, type Action, type Order } from "./model";

export function ReceivingForm({ order, save, close, busy }: { order: Order; save: (action: Action) => Promise<boolean>; close: () => void; busy: boolean }) {
  const pending = order.lines.filter(line => remainingQuantity(order, line) > 0);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  return <form onSubmit={async event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const lines = pending.map(line => ({ itemId: line.itemId, quantity: Number(amounts[line.itemId] || 0) })).filter(line => line.quantity > 0);
    if (await save({ type: "order.receive", id: order.id, lines, date: fields.get("date"), note: fields.get("note") })) close();
  }}><fieldset disabled={busy}>
    <p className="callout"><strong>{order.reference} · {order.vendor}</strong><br/>Enter only what arrived in this delivery. Leave an item at zero if it has not arrived. Remaining quantities stay open.</p>
    <div className="receive-lines">{pending.map(line => <Field key={line.itemId} label={line.name} hint={`${qty(remainingQuantity(order, line))} ${line.units} outstanding of ${qty(line.quantity)} ordered`}><input aria-label={`Receive ${line.name}`} type="number" min="0" max={remainingQuantity(order, line)} step="0.001" value={amounts[line.itemId] ?? ""} placeholder="0" onChange={event => setAmounts(current => ({ ...current, [line.itemId]: event.target.value }))}/></Field>)}</div>
    <button type="button" className="button small" onClick={() => setAmounts(Object.fromEntries(pending.map(line => [line.itemId, String(remainingQuantity(order, line))])))}>Fill all remaining quantities</button>
    <Field label="Delivery received date (UTC)"><input type="date" name="date" min={order.date} max={today()} defaultValue={today()} required/></Field>
    <Field label="Packing slip / receipt note"><textarea name="note" maxLength={1000} rows={2}/></Field>
    <p className="muted">Saving adds these quantities to stock and records the order’s unit costs. It does not submit or pay for an order.</p>
    <div className="form-footer"><button type="button" className="button" disabled={busy} onClick={close}>Cancel</button><button className="button primary" disabled={busy || !pending.some(line => Number(amounts[line.itemId]) > 0)}>{busy ? "Saving…" : "Save delivery"}</button></div>
  </fieldset></form>;
}
