export type Workflow = string;
export const flowColors = ["teal", "purple", "blue", "amber", "rose"] as const;
export type FlowColor = (typeof flowColors)[number];
export type Flow = { id: string; labId: string; name: string; code: string; color: FlowColor };
export type Lab = { id: string; name: string; location: string; budget: number | null };
export type Stage = { id: string; labId: string; workflow: Workflow; name: string; detail: string; icon: string; color?: FlowColor };
export type Item = { id: string; labId: string; stageIds: string[]; name: string; vendor: string; sku: string; url: string; units: string; stock: number; threshold: number; target: number; cost: number | null; leadDays: number; dailyUse: number; location: string; notes: string };
export type Line = { itemId: string; name: string; units: string; quantity: number; cost: number | null; sku?: string; receivedQuantity?: number };
export type Order = { id: string; labId: string; reference: string; vendor: string; status: "draft" | "ordered" | "received" | "cancelled"; date: string; expected: string; notes: string; lines: Line[]; labName?: string; labLocation?: string; deliveryAddress?: string; receivedAt?: string; lastReceivedAt?: string; cancelledAt?: string; cancellationNote?: string };
export type Movement = { id: string; labId: string; itemId: string; itemName: string; units: string; quantity: number; cost: number | null; kind: "opening" | "adjustment" | "usage" | "receipt" | "reversal"; date: string; note: string; actor: string; reversedBy?: string };
export type Data = { labs: Lab[]; flows: Flow[]; stages: Stage[]; items: Item[]; orders: Order[]; movements: Movement[] };
export type LegacyData = Omit<Data, "flows"> & { flows?: Flow[] };
export type Action = { type: string; [key: string]: unknown };
export const workflows = { id: "Infectious disease", pgx: "Pharmacogenomics" };
export const iconKeys = ["receive", "beaker", "flask", "pcr", "dna", "tube", "instrument", "check"];
export const today = () => new Date().toISOString().slice(0, 10);
export const qty = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
// Monetary inputs and snapshots are stored as integer cents.
export const money = (cents: number | null) => cents === null ? "Unpriced" : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export function defaultFlows(labId: string): Flow[] {
  return [
    { id: `${labId}-flow-id`, labId, name: "Infectious disease", code: "ID", color: "teal" },
    { id: `${labId}-flow-pgx`, labId, name: "Pharmacogenomics", code: "PGx", color: "purple" },
  ];
}
// Old saved records used global lane names; give them stable laboratory-owned IDs.
// This is intentionally non-mutating so persistence can compare against raw records.
export function normalizeData(source: Data | LegacyData): Data {
  const data: Data = { ...structuredClone(source), flows: structuredClone(source.flows ?? []) };
  for (const lab of data.labs) {
    const stages = data.stages.filter(s => s.labId === lab.id);
    const legacy = stages.some(s => s.workflow === "id" || s.workflow === "pgx");
    if (legacy || (!source.flows && stages.length > 0)) {
      for (const flow of defaultFlows(lab.id)) {
        if (!data.flows.some(f => f.id === flow.id)) data.flows.push(flow);
      }
    }
    for (const stage of stages) {
      if (stage.workflow === "id" || stage.workflow === "pgx") stage.workflow = `${lab.id}-flow-${stage.workflow}`;
    }
  }
  return data;
}
export function template(labId: string): Stage[] {
  return ([
    ["id", "Sample receiving", "Accession & preparation", "receive"],
    ["id", "Extraction", "Nucleic acid isolation", "beaker"],
    ["id", "Master mix", "Reaction preparation", "flask"],
    ["id", "Real-time PCR", "Amplification & detection", "pcr"],
    ["pgx", "Sample receiving", "Accession & preparation", "receive"],
    ["pgx", "Extraction", "DNA isolation", "dna"],
    ["pgx", "PCR · stage 1", "First amplification", "pcr"],
    ["pgx", "PCR · stage 2", "Second reaction", "tube"],
    ["pgx", "Agena MassARRAY", "Instrument analysis", "instrument"],
  ] as const).map(([workflow, name, detail, icon], i) => ({ id: `${labId}-stage-${i}`, labId, workflow: `${labId}-flow-${workflow}`, name, detail, icon }));
}
export function initialData(): Data {
  return { labs: [{ id: "cg", name: "Consultative Genomics PLLC", location: "", budget: null }], flows: defaultFlows("cg"), stages: template("cg"), items: [], orders: [], movements: [] };
}
export class InputError extends Error {}
function fail(message: string): never { throw new InputError(message); }
function str(v: unknown, label: string, required = false, max = 180): string {
  if (v != null && typeof v !== "string") fail(`${label} must be text.`);
  const s = String(v ?? "").trim();
  if (required && !s) fail(`${label} is required.`);
  if (s.length > max) fail(`${label} must be ${max} characters or fewer.`);
  return s;
}
function num(v: unknown, label: string, max = 1e8): number {
  if (v == null || !["string", "number"].includes(typeof v) || String(v).trim() === "") fail(`${label} is required.`);
  const text = String(v).trim();
  if (!/^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/.test(text)) fail(`${label} must be a nonnegative decimal with at most 3 decimal places.`);
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > max) fail(`${label} must be between 0 and ${max}.`);
  return n;
}
function cents(v: unknown, label = "Unit cost"): number | null {
  if (v == null || v === "") return null;
  if (!["string", "number"].includes(typeof v) || !/^\d+$/.test(String(v).trim())) fail(`${label} must be whole cents.`);
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n > 1e10) fail(`${label} must be whole cents between 0 and 10000000000.`);
  return n;
}
function date(v: unknown, label: string, optional = false): string {
  const d = str(v, label, !optional, 10);
  if (!d && optional) return "";
  const t = new Date(d);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(t.getTime()) || t.toISOString().slice(0, 10) !== d) fail(`${label} must be a valid date.`);
  return d;
}
function row(v: unknown): Record<string, unknown> { if (!v || typeof v !== "object" || Array.isArray(v)) fail("Invalid record."); return v as Record<string, unknown>; }
function byId<T extends { id: string }>(rows: T[], id: unknown, label: string): T { return rows.find(r => r.id === id) ?? fail(`${label} was not found. Refresh and try again.`); }
function upsert<T extends { id: string }>(rows: T[], entry: T) { const i = rows.findIndex(r => r.id === entry.id); if (i < 0) rows.push(entry); else rows[i] = entry; }
const uid = () => crypto.randomUUID();
const rounded = (v: number) => Math.round(v * 1000) / 1000;
// Received orders from before partial deliveries were tracked imply a full receipt.
export const receivedQuantity = (order: Order, line: Line): number => line.receivedQuantity ?? (order.status === "received" ? line.quantity : 0);
export const remainingQuantity = (order: Order, line: Line): number => Math.max(0, rounded(line.quantity - receivedQuantity(order, line)));

export function applyAction(source: Data | LegacyData, action: Action, actor: string, now = today()): Data {
  row(action);
  const data: Data = normalizeData(source);
  const recordMovement = (item: Item, quantity: number, kind: Movement["kind"], d: string, note: string, cost = item.cost) => {
    data.movements.push({ id: uid(), labId: item.labId, itemId: item.id, itemName: item.name, units: item.units, quantity: rounded(quantity), cost, kind, date: d, note, actor });
  };
  switch (action.type) {
    case "lab.save": {
      const v = row(action.value); const old = v.id ? byId(data.labs, v.id, "Laboratory") : null;
      const lab: Lab = { id: old?.id ?? uid(), name: str(v.name, "Laboratory name", true), location: str(v.location, "Location"), budget: cents(v.budget, "Monthly budget") };
      upsert(data.labs, lab); if (!old && v.template === true) { data.flows.push(...defaultFlows(lab.id)); data.stages.push(...template(lab.id)); } break;
    }
    case "lab.delete": {
      const lab = byId(data.labs, action.id, "Laboratory");
      if (data.labs.length === 1) fail("Keep at least one laboratory.");
      if ([...data.items, ...data.orders, ...data.movements].some(r => r.labId === lab.id)) fail("Only empty laboratories can be removed. Inventory or transaction history exists.");
      data.labs = data.labs.filter(r => r.id !== lab.id); data.flows = data.flows.filter(r => r.labId !== lab.id); data.stages = data.stages.filter(r => r.labId !== lab.id); break;
    }
    case "flow.save": {
      const v = row(action.value); const lab = byId(data.labs, v.labId, "Laboratory"); const old = v.id ? byId(data.flows, v.id, "Workflow") : null;
      if (old && old.labId !== lab.id) fail("A workflow cannot move between laboratories.");
      const name = str(v.name, "Workflow name", true, 80), code = str(v.code, "Workflow abbreviation", true, 12);
      if (name.includes("::") || name.includes("|")) fail("Workflow names cannot contain :: or | because these separate CSV map links.");
      if (data.flows.some(f => f.labId === lab.id && f.id !== old?.id && f.name.toLowerCase() === name.toLowerCase())) fail("A workflow with this name already exists in this laboratory.");
      if (data.flows.some(f => f.labId === lab.id && f.id !== old?.id && f.code.toLowerCase() === code.toLowerCase())) fail("A workflow with this abbreviation already exists in this laboratory.");
      if (!flowColors.includes(v.color as FlowColor)) fail("Choose a valid workflow color.");
      upsert(data.flows, { id: old?.id ?? uid(), labId: lab.id, name, code, color: v.color as FlowColor }); break;
    }
    case "flow.delete": {
      const flow = byId(data.flows, action.id, "Workflow");
      if (data.stages.some(s => s.workflow === flow.id)) fail("Remove or move this workflow's checkpoints before removing the workflow. Inventory will be preserved.");
      data.flows = data.flows.filter(f => f.id !== flow.id); break;
    }
    case "stage.save": {
      const v = row(action.value); const lab = byId(data.labs, v.labId, "Laboratory"); const old = v.id ? byId(data.stages, v.id, "Checkpoint") : null;
      if (old && old.labId !== lab.id) fail("A checkpoint cannot move between laboratories.");
      const flow = byId(data.flows, v.workflow, "Workflow"); if (flow.labId !== lab.id) fail("Select a workflow in this laboratory.");
      const icon = str(v.icon, "Icon"); if (!iconKeys.includes(icon)) fail("Choose a valid icon.");
      const stageName = str(v.name, "Checkpoint name", true, 80);
      if (stageName.includes("::") || stageName.includes("|")) fail("Checkpoint names cannot contain :: or | because these separate CSV map links.");
      if (data.stages.some(s => s.workflow === flow.id && s.id !== old?.id && s.name.toLowerCase() === stageName.toLowerCase())) fail("A checkpoint with this name already exists in this workflow.");
      // Older clients omit color; an empty string explicitly restores workflow inheritance.
      const color = v.color === undefined ? old?.color : v.color === "" ? undefined : v.color;
      if (color !== undefined && !flowColors.includes(color as FlowColor)) fail("Choose a valid checkpoint color.");
      upsert(data.stages, { id: old?.id ?? uid(), labId: lab.id, workflow: flow.id, name: stageName, detail: str(v.detail, "Checkpoint description"), icon, ...(color === undefined ? {} : { color: color as FlowColor }) }); break;
    }
    case "stage.delete": {
      const s = byId(data.stages, action.id, "Checkpoint"); data.stages = data.stages.filter(r => r.id !== s.id);
      data.items.forEach(item => { item.stageIds = item.stageIds.filter(id => id !== s.id); }); break;
    }
    case "stage.reorder": {
      byId(data.labs, action.labId, "Laboratory");
      const flow = byId(data.flows, action.workflow, "Workflow"); if (flow.labId !== action.labId) fail("Select a workflow in this laboratory.");
      const stages = data.stages.filter(r => r.labId === action.labId && r.workflow === action.workflow);
      if (!Array.isArray(action.ids) || action.ids.length !== stages.length || new Set(action.ids).size !== stages.length || action.ids.some(id => !stages.some(s => s.id === id))) fail("The checkpoint list changed. Refresh and try again.");
      let i = 0; const ids = action.ids;
      data.stages = data.stages.map(s => s.labId === action.labId && s.workflow === action.workflow ? byId(stages, ids[i++], "Checkpoint") : s); break;
    }
    case "stage.unlinkItem": {
      const lab = byId(data.labs, action.labId, "Laboratory"), stage = byId(data.stages, action.stageId, "Checkpoint"), item = byId(data.items, action.itemId, "Inventory item");
      if (stage.labId !== lab.id || item.labId !== lab.id) fail("Select inventory and a checkpoint in this laboratory.");
      item.stageIds = item.stageIds.filter(id => id !== stage.id);
      break;
    }
    case "stage.linkItems": {
      const lab = byId(data.labs, action.labId, "Laboratory");
      const stage = byId(data.stages, action.stageId, "Checkpoint");
      if (stage.labId !== lab.id) fail("Select a checkpoint in this laboratory.");
      if (!Array.isArray(action.itemIds) || !action.itemIds.length || action.itemIds.length > 200 || action.itemIds.some(id => typeof id !== "string" || !id.trim())) fail("Select between 1 and 200 existing inventory items.");
      // Validate the entire selection before adding links. No inventory fields,
      // stock movements, or links to other checkpoints are replaced.
      const items = [...new Set(action.itemIds)].map(id => byId(data.items, id, "Inventory item"));
      if (items.some(item => item.labId !== lab.id)) fail("Select inventory from this laboratory only.");
      for (const item of items) if (!item.stageIds.includes(stage.id)) item.stageIds.push(stage.id);
      break;
    }
    case "item.save": {
      const v = row(action.value); const lab = byId(data.labs, v.labId, "Laboratory"); const old = v.id ? byId(data.items, v.id, "Inventory item") : null;
      if (old && old.labId !== lab.id) fail("An item cannot move between laboratories.");
      const stageIds = v.stageIds; if (!Array.isArray(stageIds) || stageIds.some(id => !data.stages.some(s => s.id === id && s.labId === lab.id))) fail("Select checkpoints in this laboratory.");
      const threshold = num(v.threshold, "Reorder threshold"), target = num(v.target, "Target stock");
      if (target <= threshold) fail("Target stock must be greater than the reorder threshold.");
      const url = str(v.url, "Vendor URL", false, 2000);
      if (url) { try { if (new URL(url).protocol !== "https:") fail("Use an https:// vendor URL."); } catch { fail("Use a valid https:// vendor URL."); } }
      const item: Item = { id: old?.id ?? uid(), labId: lab.id, stageIds: [...new Set(stageIds)] as string[], name: str(v.name, "Item name", true), units: str(v.units, "Stock unit", true, 40), stock: num(v.stock, "On-hand stock"), threshold, target, cost: cents(v.cost), url, vendor: str(v.vendor, "Vendor"), sku: str(v.sku, "Catalog number"), leadDays: num(v.leadDays, "Lead time", 3650), dailyUse: num(v.dailyUse, "Estimated daily usage"), location: str(v.location, "Storage location"), notes: str(v.notes, "Notes", false, 2000) };
      if (old && old.units !== item.units && (data.movements.some(m => m.itemId === old.id) || data.orders.some(o => o.lines.some(l => l.itemId === old.id)))) fail("Units are locked once stock history or orders exist. Create a separate item for a different stock unit.");
      upsert(data.items, item);
      if (item.stock !== (old?.stock ?? 0)) recordMovement(item, item.stock - (old?.stock ?? 0), old ? "adjustment" : "opening", now, old ? "Counted stock updated" : "Opening balance");
      break;
    }
    case "item.delete": {
      const item = byId(data.items, action.id, "Inventory item");
      if (data.orders.some(o => ["draft", "ordered"].includes(o.status) && o.lines.some(l => l.itemId === item.id))) fail("Cancel or receive this item's active orders before removing it.");
      if (item.stock > 0) fail("Record a counted-stock adjustment to zero before removing this item, so the stock change remains in history.");
      data.items = data.items.filter(r => r.id !== item.id); break;
    }
    case "stock.record": {
      const v = row(action.value); const item = byId(data.items, v.itemId, "Inventory item"); const amount = num(v.quantity, "Quantity");
      if (amount <= 0) fail("Quantity must be greater than zero.");
      if (v.kind !== "usage" && v.kind !== "receipt") fail("Choose usage or receipt.");
      const d = date(v.date, "Record date"); if (d > now) fail("Stock records cannot be future-dated.");
      const delta = v.kind === "usage" ? -amount : amount;
      if (item.stock + delta < 0) fail("Usage cannot exceed on-hand stock.");
      item.stock = rounded(item.stock + delta); if (item.stock > 1e8) fail("Stock exceeds the supported limit.");
      recordMovement(item, delta, v.kind, d, str(v.note, "Note", false, 1000), v.cost === undefined ? item.cost : cents(v.cost)); break;
    }
    case "usage.reverse": {
      const m = byId(data.movements, action.id, "Usage record");
      if (m.kind !== "usage" || m.reversedBy) fail("Only unreversed usage records can be reversed.");
      const item = byId(data.items, m.itemId, "Inventory item");
      item.stock = rounded(item.stock - m.quantity); if (item.stock > 1e8) fail("Stock exceeds the supported limit.");
      recordMovement(item, -m.quantity, "reversal", now, `Reversal of usage ${m.id} · ${str(action.note, "Reason", true, 500)}`, m.cost);
      m.reversedBy = data.movements[data.movements.length - 1].id; break;
    }
    case "order.reorder": {
      const item = byId(data.items, action.itemId, "Inventory item");
      if (item.labId !== action.labId) fail("Select inventory from this laboratory only.");
      return applyAction(data, { type: "order.save", value: {
        labId: item.labId, reference: `PO-${now.replaceAll("-", "")}-${uid().slice(0, 8).toUpperCase()}`,
        vendor: action.vendor === undefined ? item.vendor : action.vendor,
        status: "draft", date: now, expected: "", notes: action.notes ?? "", deliveryAddress: action.deliveryAddress ?? "",
        lines: [{ itemId: item.id, quantity: action.quantity, cost: action.cost === undefined ? item.cost : action.cost }],
      } }, actor, now);
    }
    case "order.save": {
      const v = row(action.value); const lab = byId(data.labs, v.labId, "Laboratory"); const old = v.id ? byId(data.orders, v.id, "Order") : null;
      if (old?.status === "received") fail("Received orders are locked to protect stock history.");
      if (old && old.lines.some(l => receivedQuantity(old, l) > 0)) fail("Orders with receipts are locked to protect stock history. Receive or cancel the remaining quantities instead.");
      if (old && old.labId !== lab.id) fail("An order cannot move between laboratories.");
      if (!["draft", "ordered", "cancelled"].includes(String(v.status))) fail("Choose a valid order status.");
      if (!Array.isArray(v.lines) || !v.lines.length || v.lines.length > 100) fail("Add between 1 and 100 order lines.");
      const lines: Line[] = v.lines.map(raw => { const l = row(raw); const item = byId(data.items, l.itemId, "Inventory item"); if (item.labId !== lab.id) fail("Order items must belong to this laboratory."); const quantity = num(l.quantity, "Order quantity"); if (!quantity) fail("Order quantity must be greater than zero."); return { itemId: item.id, name: item.name, units: item.units, quantity, cost: cents(l.cost), sku: old?.lines.find(line => line.itemId === item.id)?.sku ?? item.sku }; });
      if (new Set(lines.map(l => l.itemId)).size !== lines.length) fail("Each item can appear only once per order.");
      const ordered = date(v.date, "Order date"), expected = date(v.expected, "Expected date", true);
      if (expected && expected < ordered) fail("Expected delivery cannot be before the order date.");
      if (v.status === "ordered" && ordered > now) fail("Placed orders cannot be future-dated.");
      const reference = str(v.reference, "Order reference", true);
      if (data.orders.some(o => o.labId === lab.id && o.id !== old?.id && o.reference.toLowerCase() === reference.toLowerCase())) fail("An order with this reference already exists in this laboratory.");
      upsert(data.orders, { id: old?.id ?? uid(), labId: lab.id, reference, vendor: str(v.vendor, "Vendor", true), status: v.status as Order["status"], date: ordered, expected, notes: str(v.notes, "Order notes", false, 2000), lines, labName: old?.labName ?? lab.name, labLocation: old?.labLocation ?? lab.location, deliveryAddress: str(v.deliveryAddress === undefined ? old?.deliveryAddress : v.deliveryAddress, "Delivery address", false, 1000) }); break;
    }
    case "order.receive": {
      const order = byId(data.orders, action.id, "Order"); if (order.status !== "ordered") fail("Only placed orders with outstanding quantities can be received.");
      const receivedDate = date(action.date === undefined ? now : action.date, "Receipt date");
      if (receivedDate < order.date || receivedDate > now) fail("Receipt date must be on or after the order date and cannot be in the future.");
      const note = str(action.note, "Delivery note", false, 1000);
      const rawLines = action.lines === undefined ? order.lines.filter(l => remainingQuantity(order, l) > 0).map(l => ({ itemId: l.itemId, quantity: remainingQuantity(order, l) })) : action.lines;
      if (!Array.isArray(rawLines) || !rawLines.length || rawLines.length > 100) fail("Add between 1 and 100 delivery lines with a positive received quantity.");
      const received = new Set<string>();
      for (const raw of rawLines) {
        const v = row(raw), line = order.lines.find(l => l.itemId === v.itemId) ?? fail("A delivery item was not found in this order.");
        if (received.has(line.itemId)) fail("Each item can appear only once per delivery.");
        received.add(line.itemId);
        const quantity = num(v.quantity, "Received quantity");
        if (quantity <= 0) fail("Received quantity must be greater than zero. Omit items not included in this delivery.");
        if (quantity > remainingQuantity(order, line)) fail(`Received quantity for ${line.name} exceeds the outstanding order quantity.`);
        const item = byId(data.items, line.itemId, "Ordered item");
        item.stock = rounded(item.stock + quantity); if (item.stock > 1e8) fail("Stock exceeds the supported limit.");
        if (line.cost !== null) item.cost = line.cost;
        line.receivedQuantity = rounded(receivedQuantity(order, line) + quantity);
        recordMovement(item, quantity, "receipt", receivedDate, `Received ${order.reference}${note ? ` · ${note}` : ""}`, line.cost);
      }
      order.lastReceivedAt = order.lastReceivedAt && order.lastReceivedAt > receivedDate ? order.lastReceivedAt : receivedDate;
      if (order.lines.every(l => remainingQuantity(order, l) === 0)) { order.status = "received"; order.receivedAt = order.lastReceivedAt; }
      break;
    }
    case "order.cancel": {
      const order = byId(data.orders, action.id, "Order");
      if (order.status !== "ordered") fail("Only placed orders can have their remaining quantities cancelled.");
      const note = str(action.note, "Cancellation note", false, 500);
      order.status = "cancelled";
      order.cancelledAt = now;
      order.cancellationNote = note;
      break;
    }
    case "order.delete": {
      const order = byId(data.orders, action.id, "Order"); if (!["draft", "cancelled"].includes(order.status)) fail("Only draft or cancelled orders can be deleted.");
      if (order.lines.some(l => receivedQuantity(order, l) > 0)) fail("Orders with receipt history cannot be deleted.");
      data.orders = data.orders.filter(o => o.id !== order.id); break;
    }
    case "legacy.import": {
      const lab = byId(data.labs, action.labId, "Laboratory"); if (data.items.some(i => i.labId === lab.id)) fail("Import a saved layout before adding inventory, so checkpoint links remain intact.");
      if (!Array.isArray(action.stages) || !action.stages.length || action.stages.length > 100) fail("No valid saved map found.");
      for (const flow of defaultFlows(lab.id)) if (!data.flows.some(f => f.id === flow.id)) data.flows.push(flow);
      const stages = action.stages.map(raw => { const s = row(raw); if (s.workflow !== "id" && s.workflow !== "pgx") fail("Saved map has an unknown workflow."); return { id: uid(), labId: lab.id, workflow: `${lab.id}-flow-${s.workflow}`, name: str(s.name, "Checkpoint name", true, 80), detail: str(s.detail, "Description"), icon: "beaker" }; });
      data.stages = [...data.stages.filter(s => s.labId !== lab.id), ...stages]; break;
    }
    default: fail("Unknown inventory action.");
  }
  if (data.labs.length > 100 || data.flows.length > 1000 || data.stages.length > 1000 || data.items.length > 10000) fail("This workspace supports up to 100 laboratories, 1,000 workflows, 1,000 checkpoints and 10,000 active inventory items.");
  return data;
}
export function tone(item: Item): "critical" | "watch" | "good" {
  return item.stock <= item.threshold ? "critical" : item.stock <= item.threshold + Math.max(item.threshold * .25, item.dailyUse * item.leadDays) ? "watch" : "good";
}
export function health(items: Item[]): number | null {
  return items.length ? Math.round(items.reduce((sum, i) => sum + Math.min(1, i.stock / i.target), 0) / items.length * 100) : null;
}
export function analytics(data: Data, labId: string, now = today()) {
  const items = data.items.filter(i => i.labId === labId), movements = data.movements.filter(m => m.labId === labId);
  const end = new Date(`${now}T00:00:00Z`).getTime();
  const usage = movements.filter(m => m.kind === "usage" && !m.reversedBy && new Date(`${m.date}T00:00:00Z`).getTime() >= end - 29 * 86400000 && m.date <= now);
  const weeks = Array.from({ length: 8 }, (_, k) => {
    const start = end - (55 - k * 7) * 86400000, finish = start + 6 * 86400000;
    const rows = movements.filter(m => m.kind === "usage" && !m.reversedBy && new Date(`${m.date}T00:00:00Z`).getTime() >= start && new Date(`${m.date}T00:00:00Z`).getTime() <= finish);
    return { start: new Date(start).toISOString().slice(0, 10), value: rows.reduce((sum, m) => sum + Math.round(Math.abs(m.quantity) * (m.cost ?? 0)), 0), count: rows.length, unpriced: rows.filter(m => m.cost === null).length };
  });
  return { items, movements, usage, weeks, value: items.reduce((sum, i) => sum + Math.round(i.stock * (i.cost ?? 0)), 0), unpriced: items.filter(i => i.cost === null).length, usageValue: usage.reduce((sum, m) => sum + Math.round(Math.abs(m.quantity) * (m.cost ?? 0)), 0), unpricedUsage: usage.filter(m => m.cost === null).length, low: items.filter(i => tone(i) === "critical"), activeOrders: data.orders.filter(o => o.labId === labId && ["draft", "ordered"].includes(o.status)) };
}
