"use client";
import { useState } from "react";
import { Field } from "./forms";
import { money, qty, remainingQuantity, type Action, type Item, type Order } from "./model";

export function ReorderForm({ item, orders, save, close, busy }: { item: Item; orders: Order[]; save: (action: Action) => Promise<boolean>; close: () => void; busy: boolean }) {
  const pending = orders.filter(order => order.status === "ordered").flatMap(order => order.lines.filter(line => line.itemId === item.id).map(line => remainingQuantity(order, line))).reduce((sum, n) => sum + n, 0);
  const drafts = orders.filter(order => order.status === "draft" && order.lines.some(line => line.itemId === item.id));
  const [quantity, setQuantity] = useState(String(Math.max(1, Math.round((item.target - item.stock - pending) * 1000) / 1000)));
  const [cost, setCost] = useState(item.cost === null ? "" : String(item.cost / 100));
  const [vendor, setVendor] = useState(item.vendor);
  return <form onSubmit={async e => { e.preventDefault(); const values = new FormData(e.currentTarget); await save({ type: "order.reorder", labId: item.labId, itemId: item.id, quantity, vendor, cost: cost === "" ? null : Math.round(Number(cost) * 100), deliveryAddress: values.get("deliveryAddress"), notes: values.get("notes") }); }}><fieldset disabled={busy}>
    <div className="reorder-item"><h3>{item.name}</h3><p>{[item.vendor, item.sku].filter(Boolean).join(" · ") || "Vendor details needed"}</p><p>{qty(item.stock)} {item.units} on hand · Target {qty(item.target)}{pending > 0 ? ` · ${qty(pending)} on order` : ""}</p></div>
    {drafts.length > 0 && <p className="callout">{drafts.length} existing {drafts.length === 1 ? "draft PO already includes" : "draft POs already include"} this item. Check Orders before creating another.</p>}
    <Field label={`Quantity to reorder (${item.units})`} hint="Adjust the quantity before creating your PO."><input type="number" min="0.001" max="100000000" step="0.001" required autoFocus value={quantity} onChange={e => setQuantity(e.target.value)}/></Field>
    {!item.vendor && <Field label="Vendor" hint="Needed for the purchase order; this does not change the inventory item."><input value={vendor} onChange={e => setVendor(e.target.value)} required maxLength={180}/></Field>}
    <details className="reorder-details"><summary>PO details & pricing</summary>
      {item.vendor && <Field label="Vendor"><input value={vendor} onChange={e => setVendor(e.target.value)} required maxLength={180}/></Field>}
      <Field label="Unit price (USD)" hint="Leave blank if a vendor quote is needed."><input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="Quote required"/></Field>
      <Field label="Deliver to" hint="Optional delivery address or instructions."><textarea name="deliveryAddress" maxLength={1000} rows={3}/></Field>
      <Field label="PO notes"><textarea name="notes" maxLength={2000} rows={2}/></Field>
    </details>
    <div className="reorder-subtotal"><span>Item subtotal</span><strong>{cost === "" ? "Quote required" : money(Math.round(Number(quantity || 0) * Math.round(Number(cost) * 100)))}</strong></div>
    <p className="muted">USD · excludes tax and shipping. A numbered draft will be saved with a PDF download. Nothing is sent to the vendor and stock stays unchanged.</p>
    <div className="form-footer"><button type="button" className="button" disabled={busy} onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Creating PO…" : "Create PO"}</button></div>
  </fieldset></form>;
}
