"use client";
import { useEffect, useId, useRef, useState, type ReactNode, type FormEvent } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { iconKeys, flowColors, money, qty, today, type Flow, type Action, type Item, type Lab, type Order, type Stage } from "./model";

type Save = (action: Action) => Promise<boolean>;
export function Modal({ title, children, close, busy }: { title: string; children: ReactNode; close: () => void; busy: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => { const el = ref.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog className="modal" ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!busy) close(); }} onClick={e => { if (e.target === e.currentTarget && !busy) close(); }}><div className="modal-body"><div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={close}><X size={21}/></button></div>{children}</div></dialog>;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function Footer({ busy, close, text = "Save changes" }: { busy: boolean; close: () => void; text?: string }) { return <div className="form-footer"><button type="button" className="button" disabled={busy} onClick={close}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : text}</button></div>; }
const formValues = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)); };
const toCents = (v: unknown) => v === "" ? null : Math.round(Number(v) * 100);
const dollars = (v?: number | null) => v == null ? "" : v / 100;

export function LabForm({ lab, save, close, busy }: { lab?: Lab; save: Save; close: () => void; busy: boolean }) {
  return <form onSubmit={async e => { const v = formValues(e); if (await save({ type: "lab.save", value: { ...v, id: lab?.id, budget: toCents(v.budget), template: v.template === "on" } })) close(); }}><fieldset disabled={busy}>
    <Field label="Laboratory name"><input name="name" defaultValue={lab?.name} required maxLength={180} autoFocus/></Field>
    <Field label="Location"><input name="location" defaultValue={lab?.location} maxLength={180} placeholder="Building, city or department"/></Field>
    <Field label="Monthly purchasing budget (USD)" hint="Optional. Leave blank if you do not track a budget."><input name="budget" type="number" min="0" step="0.01" defaultValue={dollars(lab?.budget)} placeholder="Not set"/></Field>
    {!lab && <label className="check-row"><input type="checkbox" name="template" defaultChecked/>Include infectious disease and PGx checkpoint templates</label>}
    <Footer busy={busy} close={close} text={lab ? "Save laboratory" : "Create laboratory"}/>
  </fieldset></form>;
}
export function FlowForm({ flow, labId, save, close, busy }: { flow?: Flow; labId: string; save: Save; close: () => void; busy: boolean }) {
  return <form onSubmit={async e => { const value = formValues(e); if (await save({ type: "flow.save", value: { ...value, id: flow?.id, labId } })) close(); }}><fieldset disabled={busy}>
    <p className="callout">Create a separate map lane for any process, such as Toxicology, Histology, NGS or general lab operations. Add and arrange its checkpoints next.</p>
    <Field label="Workflow name"><input name="name" defaultValue={flow?.name} required maxLength={80} autoFocus placeholder="e.g. Toxicology"/></Field>
    <div className="form-grid"><Field label="Short label" hint="Up to 12 characters for map labels."><input name="code" defaultValue={flow?.code} required maxLength={12} placeholder="e.g. TOX"/></Field><Field label="Map color"><select name="color" defaultValue={flow?.color ?? "blue"}>{flowColors.map(color => <option key={color} value={color}>{color[0].toUpperCase() + color.slice(1)}</option>)}</select></Field></div>
    <Footer busy={busy} close={close} text={flow ? "Save workflow" : "Create workflow"}/>
  </fieldset></form>;
}
export function StageForm({ stage, labId, flows, workflowId, save, close, busy }: { stage?: Stage; labId: string; flows: Flow[]; workflowId?: string; save: Save; close: () => void; busy: boolean }) {
  const [selectedWorkflow, setSelectedWorkflow] = useState(stage?.workflow ?? workflowId ?? flows[0]?.id ?? "");
  const colorHintId = useId(), inheritedColor = flows.find(flow => flow.id === selectedWorkflow)?.color ?? "teal";
  return <form onSubmit={async e => { const v = formValues(e); if (await save({ type: "stage.save", value: { ...v, id: stage?.id, labId } })) close(); }}><fieldset disabled={busy}>
    <Field label="Checkpoint name"><input name="name" defaultValue={stage?.name} maxLength={80} required autoFocus/></Field>
    <Field label="Description"><input name="detail" defaultValue={stage?.detail} maxLength={180}/></Field>
    <div className="form-grid"><Field label="Workflow"><select name="workflow" value={selectedWorkflow} onChange={e => setSelectedWorkflow(e.target.value)} required>{flows.map(flow => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select></Field><Field label="Icon"><select name="icon" defaultValue={stage?.icon ?? "beaker"}>{iconKeys.map(key => <option key={key} value={key}>{key[0].toUpperCase() + key.slice(1)}</option>)}</select></Field></div>
    <fieldset className="checkpoint-colors" aria-describedby={colorHintId}>
      <legend>Card color</legend>
      <div className="checkpoint-color-grid">{["", ...flowColors].map(color => <label className="checkpoint-color-option" data-card-color={color || inheritedColor} key={color}>
        <input type="radio" name="color" value={color} defaultChecked={(stage?.color ?? "") === color}/>
        <span className="checkpoint-color-swatch" aria-hidden="true"/>
        <span>{color ? color[0].toUpperCase() + color.slice(1) : "Workflow default"}</span>
      </label>)}</div>
      <p id={colorHintId}>Saved for this checkpoint in both themes. Stock gauges and alerts keep their status colors.</p>
    </fieldset>
    <Footer busy={busy} close={close} text={stage ? "Save checkpoint" : "Add checkpoint"}/>
  </fieldset></form>;
}
export function ItemForm({ item, labId, stages, flows, stageId, save, close, busy }: { item?: Item; labId: string; stages: Stage[]; flows: Flow[]; stageId?: string; save: Save; close: () => void; busy: boolean }) {
  return <form onSubmit={async e => { e.preventDefault(); const fd = new FormData(e.currentTarget); const v = Object.fromEntries(fd); if (await save({ type: "item.save", value: { ...v, id: item?.id, labId, cost: toCents(v.cost), stageIds: fd.getAll("stageIds") } })) close(); }}><fieldset disabled={busy}>
    <div className="form-grid"><Field label="Item name"><input name="name" defaultValue={item?.name} required maxLength={180} autoFocus/></Field><Field label="Stock unit" hint="Use one consistent unit, e.g. boxes, kits or reactions."><input name="units" defaultValue={item?.units ?? "units"} required maxLength={40}/></Field></div>
    <div className="form-grid three"><Field label="On-hand stock" hint={item ? "Changes create a counted-stock adjustment." : undefined}><input name="stock" type="number" min="0" step="0.001" defaultValue={item?.stock ?? 0} required/></Field><Field label="Reorder at or below"><input name="threshold" type="number" min="0" step="0.001" defaultValue={item?.threshold ?? 0} required/></Field><Field label="Target stock" hint="Must be above the reorder threshold."><input name="target" type="number" min="0.001" step="0.001" defaultValue={item?.target ?? ""} required/></Field></div>
    <div className="form-grid three"><Field label="Cost per stock unit (USD)" hint="Blank means unpriced, not free."><input name="cost" type="number" min="0" step="0.01" defaultValue={dollars(item?.cost)} placeholder="Unpriced"/></Field><Field label="Lead time (days)"><input name="leadDays" type="number" min="0" max="3650" step="0.001" defaultValue={item?.leadDays ?? 0} required/></Field><Field label="Estimated daily usage" hint="Planning input; does not create usage history."><input name="dailyUse" type="number" min="0" step="0.001" defaultValue={item?.dailyUse ?? 0} required/></Field></div>
    <div className="form-grid"><Field label="Vendor"><input name="vendor" defaultValue={item?.vendor} maxLength={180}/></Field><Field label="Catalog / SKU"><input name="sku" defaultValue={item?.sku} maxLength={180}/></Field></div>
    <Field label="Vendor order link"><input name="url" type="url" pattern="https://.*" defaultValue={item?.url} placeholder="https://vendor.com/product" maxLength={2000}/></Field>
    <Field label="Storage location"><input name="location" defaultValue={item?.location} maxLength={180}/></Field>
    <div className="field"><span>Used at checkpoints</span><div className="check-grid">{stages.map(s => <label className="check-row" key={s.id}><input type="checkbox" name="stageIds" value={s.id} defaultChecked={item ? item.stageIds.includes(s.id) : s.id === stageId}/><span><small>{flows.find(f => f.id === s.workflow)?.code ?? "Workflow"}</small> {s.name}</span></label>)}</div>{!stages.length && <small>No checkpoints yet. The item will remain unassigned.</small>}</div>
    <Field label="Notes"><textarea name="notes" defaultValue={item?.notes} maxLength={2000} rows={2}/></Field>
    <Footer busy={busy} close={close} text={item ? "Save inventory item" : "Add inventory item"}/>
  </fieldset></form>;
}
export function StockForm({ item, save, close, busy }: { item: Item; save: Save; close: () => void; busy: boolean }) {
  return <form onSubmit={async e => { const v = formValues(e); if (await save({ type: "stock.record", value: { ...v, itemId: item.id, cost: toCents(v.cost) } })) close(); }}><fieldset disabled={busy}>
    <p className="callout">{item.name}<br/><strong>{qty(item.stock)} {item.units}</strong> on hand</p>
    <Field label="Transaction type"><select name="kind"><option value="usage">Record consumption — subtract stock</option><option value="receipt">Direct receipt — add stock</option></select></Field>
    <div className="form-grid"><Field label={`Quantity (${item.units})`}><input type="number" name="quantity" min="0.001" step="0.001" required autoFocus/></Field><Field label="Record date"><input type="date" name="date" defaultValue={today()} max={today()} required/></Field></div>
    <Field label="Note / reference"><textarea name="note" rows={2} maxLength={1000}/></Field>
    <Field label="Cost per stock unit (USD)" hint="Captured for this transaction. Blank means unpriced."><input name="cost" type="number" min="0" step="0.01" defaultValue={dollars(item.cost)} placeholder="Unpriced"/></Field>
    <p className="muted">For a tracked purchase order, use Receive in Orders instead.</p>
    <Footer busy={busy} close={close} text="Record transaction"/>
  </fieldset></form>;
}
export function OrderForm({ order, suggested, items, labId, save, close, busy }: { order?: Order; suggested?: Item; items: Item[]; labId: string; save: Save; close: () => void; busy: boolean }) {
  const [lines, setLines] = useState(() => order?.lines.map(l => ({ itemId: l.itemId, quantity: String(l.quantity), cost: String(dollars(l.cost)) })) ?? (suggested ? [{ itemId: suggested.id, quantity: String(Math.max(.001, Math.round((suggested.target - suggested.stock) * 1000) / 1000)), cost: String(dollars(suggested.cost)) }] : [{ itemId: "", quantity: "1", cost: "" }]));
  const total = lines.reduce((sum, l) => sum + Math.round(Number(l.quantity || 0) * Math.round(Number(l.cost || 0) * 100)), 0);
  const change = (index: number, field: string, value: string) => setLines(rows => rows.map((l, i) => i === index ? { ...l, [field]: value, ...(field === "itemId" ? { cost: String(dollars(items.find(item => item.id === value)?.cost)) } : {}) } : l));
  return <form onSubmit={async e => { const v = formValues(e); if (await save({ type: "order.save", value: { ...v, id: order?.id, labId, lines: lines.map(l => ({ ...l, cost: toCents(l.cost) })) } })) close(); }}><fieldset disabled={busy}>
    <p className="muted">Track purchasing here. Place the actual order with your vendor, then mark it as placed. Record each delivery, including partial quantities, after it arrives.</p>
    <div className="form-grid"><Field label="Order / PO reference"><input name="reference" defaultValue={order?.reference} required maxLength={180} autoFocus/></Field><Field label="Vendor"><input name="vendor" defaultValue={order?.vendor ?? suggested?.vendor} required maxLength={180}/></Field></div>
    <div className="form-grid three"><Field label="Status"><select name="status" defaultValue={order?.status ?? "draft"}><option value="draft">Draft</option><option value="ordered">Placed with vendor</option><option value="cancelled">Cancelled</option></select></Field><Field label="Order date"><input name="date" type="date" defaultValue={order?.date ?? today()} required/></Field><Field label="Expected delivery"><input name="expected" type="date" defaultValue={order?.expected}/></Field></div>
    <div className="order-lines">{lines.map((line, index) => <div className="order-line" key={index}><Field label={`Item ${index + 1}`}><select aria-label={`Order item ${index + 1}`} value={line.itemId} required onChange={e => change(index, "itemId", e.target.value)}><option value="">Select inventory item</option>{items.map(i => <option value={i.id} key={i.id}>{i.name} ({i.units})</option>)}</select></Field><Field label="Quantity"><input aria-label={`Quantity for line ${index + 1}`} type="number" min="0.001" step="0.001" value={line.quantity} required onChange={e => change(index, "quantity", e.target.value)}/></Field><Field label="Unit cost (USD)"><input aria-label={`Unit cost for line ${index + 1}`} type="number" min="0" step="0.01" value={line.cost} placeholder="Unpriced" onChange={e => change(index, "cost", e.target.value)}/></Field><button type="button" className="icon-button" aria-label={`Remove line ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines(rows => rows.filter((_, i) => i !== index))}><Trash2 size={18}/></button></div>)}</div>
    <div className="split"><button type="button" className="button" disabled={lines.length >= 100} onClick={() => setLines(rows => [...rows, { itemId: "", quantity: "1", cost: "" }])}><Plus size={17}/>Add line</button><span>Known line total <strong>{money(lines.every(l => l.cost === "") ? null : Math.round(total))}</strong>{lines.some(l => l.cost === "") && <small className="muted"> · excludes unpriced lines</small>}</span></div>
    <Field label="Deliver to"><textarea name="deliveryAddress" defaultValue={order?.deliveryAddress} rows={3} maxLength={1000}/></Field>
    <Field label="Notes"><textarea name="notes" defaultValue={order?.notes} rows={2} maxLength={2000}/></Field>
    <Footer busy={busy} close={close} text={order ? "Save order" : "Create order"}/>
  </fieldset></form>;
}
