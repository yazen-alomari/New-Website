import { applyAction, flowColors, normalizeData, today, type Data, type Item } from "./model.ts";
import { buildInventoryCsv, inventoryColumns, parseInventoryCsv, type InventoryCsvError } from "./inventory-csv.ts";

export type ImportOptions = { createCheckpoints: boolean; allowUpdates: boolean };
export type ImportPreviewRow = { row: number; name: string; mode: "Add" | "Update"; stock: number; previousStock: number | null; units: string; cost: number | null; links: string };
export type ImportPlan = { data: Data; errors: InventoryCsvError[]; preview: ImportPreviewRow[]; added: number; updated: number; newFlows: number; newStages: number };
const key = (s: string) => s.trim().toLocaleLowerCase("en-US");
function itemLinks(data: Data, item: Item): string {
  return item.stageIds.map(id => { const s = data.stages.find(s => s.id === id); const f = data.flows.find(f => f.id === s?.workflow); return s && f ? `${f.name}::${s.name}` : ""; }).filter(Boolean).join(" | ");
}

/** The browser preview and the API run the same validation. No writes occur here. */
export function planInventoryImport(source: Data, labId: string, csv: string, options: ImportOptions, actor: string, now = today()): ImportPlan {
  const original = normalizeData(source);
  let data = original;
  const parsed = parseInventoryCsv(csv), errors = [...parsed.errors];
  const preview: ImportPreviewRow[] = [];
  const seenIds = new Set<string>();
  let added = 0, updated = 0;
  const result = (): ImportPlan => ({ data: errors.length ? original : data, errors, preview, added, updated, newFlows: data.flows.length - original.flows.length, newStages: data.stages.length - original.stages.length });
  if (!data.labs.some(l => l.id === labId)) { errors.push({ row: 1, message: "Choose an existing laboratory before importing." }); return result(); }
  if (errors.length) return result();
  for (const r of parsed.rows) {
    const before = data;
    try {
      const id = r.item_id.trim();
      const old = id ? data.items.find(i => i.id === id && i.labId === labId) : undefined;
      if (id && !old) throw new Error("item_id was not found in the selected laboratory. Use its exported ID, or leave item_id blank to add a new item.");
      if (id && !options.allowUpdates) throw new Error("This row updates an existing item. Enable ‘Allow updates’ to review and import it.");
      if (id && inventoryColumns.some(column => !parsed.columns?.includes(column))) throw new Error("Updates require every column from Export CSV. Keep all exported columns so missing fields cannot accidentally erase existing values.");
      if (id && seenIds.has(id)) throw new Error("The same item_id appears more than once in this file.");
      if (id) seenIds.add(id);
      const duplicate = data.items.find(i => i.labId === labId && i.id !== id && (r.sku.trim() ? key(i.sku) === key(r.sku) && key(i.vendor) === key(r.vendor) : key(i.name) === key(r.item_name) && key(i.units) === key(r.stock_unit) && key(i.vendor) === key(r.vendor)));
      if (!id && duplicate) throw new Error(`Possible duplicate of “${duplicate.name}”. Export inventory and use that item's item_id for an update; check repeated rows in this file.`);
      const stageIds: string[] = [];
      // Existing IDs already disambiguate unchanged links, even when checkpoint
      // display names happen to be duplicated. Changed links are resolved below.
      const preserveLinks = !!old && r.checkpoint_links === itemLinks(data, old);
      if (preserveLinks) stageIds.push(...old!.stageIds);
      const links = !preserveLinks && r.checkpoint_links.trim() ? r.checkpoint_links.split("|").map(s => s.trim()) : [];
      if (links.length > 20) throw new Error("An import row can link to at most 20 checkpoints.");
      for (const link of links) {
        const names = link.split("::").map(s => s.trim());
        if (names.length !== 2 || !names[0] || !names[1]) throw new Error("Use Workflow name::Checkpoint name, separating multiple links with |.");
        const [flowName, stageName] = names;
        const matches = data.flows.filter(f => f.labId === labId && key(f.name) === key(flowName));
        if (matches.length > 1) throw new Error(`Workflow “${flowName}” is ambiguous. Rename duplicate workflows before importing.`);
        let flow = matches[0];
        if (!flow) {
          if (!options.createCheckpoints) throw new Error(`Workflow “${flowName}” does not exist. Add it first or enable creation of missing map locations.`);
          const base = flowName.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "FLOW";
          let code = base, n = 2;
          while (data.flows.some(f => f.labId === labId && key(f.code) === key(code))) code = `${base}${n++}`;
          data = applyAction(data, { type: "flow.save", value: { labId, name: flowName, code, color: flowColors[data.flows.filter(f => f.labId === labId).length % flowColors.length] } }, actor, now);
          flow = data.flows[data.flows.length - 1];
        }
        const checkpoints = data.stages.filter(s => s.labId === labId && s.workflow === flow.id && key(s.name) === key(stageName));
        if (checkpoints.length > 1) throw new Error(`Checkpoint “${stageName}” is ambiguous within “${flowName}”. Rename the duplicate checkpoints.`);
        let stage = checkpoints[0];
        if (!stage) {
          if (!options.createCheckpoints) throw new Error(`Checkpoint “${stageName}” does not exist in “${flowName}”. Add it first or enable creation of missing map locations.`);
          data = applyAction(data, { type: "stage.save", value: { labId, workflow: flow.id, name: stageName, detail: "", icon: "beaker" } }, actor, now);
          stage = data.stages[data.stages.length - 1];
        }
        stageIds.push(stage.id);
      }
      if (data.flows.length + data.stages.length - original.flows.length - original.stages.length > 100) throw new Error("One import can create at most 100 new workflows and checkpoints. Split this file into smaller imports.");
      const value = { id: old?.id, labId, name: r.item_name, units: r.stock_unit, stock: r.on_hand, threshold: r.reorder_threshold, target: r.target_stock, cost: r.unit_cost_usd === "" ? null : Math.round(Number(r.unit_cost_usd) * 100), vendor: r.vendor, sku: r.sku, url: r.vendor_url, location: r.location, leadDays: r.lead_time_days || 0, dailyUse: r.estimated_daily_usage || 0, stageIds, notes: r.notes };
      data = applyAction(data, { type: "item.save", value }, actor, now);
      const item = old ? data.items.find(i => i.id === old.id)! : data.items[data.items.length - 1];
      preview.push({ row: r.rowNumber, name: item.name, mode: old ? "Update" : "Add", stock: item.stock, previousStock: old?.stock ?? null, units: item.units, cost: item.cost, links: r.checkpoint_links });
      if (old) updated++; else added++;
    } catch (error) {
      data = before;
      errors.push({ row: r.rowNumber, message: error instanceof Error ? error.message : "Invalid inventory row." });
    }
  }
  return result();
}

/** Export IDs plus every editable inventory field for safe CSV round-tripping. */
export function exportInventoryCsv(data: Data, labId: string): string {
  return buildInventoryCsv(data.items.filter(i => i.labId === labId).map((i: Item) => ({
    item_id: i.id, item_name: i.name, stock_unit: i.units, on_hand: i.stock, reorder_threshold: i.threshold, target_stock: i.target, unit_cost_usd: i.cost === null ? "" : i.cost / 100, vendor: i.vendor, sku: i.sku, vendor_url: i.url, location: i.location, lead_time_days: i.leadDays, estimated_daily_usage: i.dailyUse, notes: i.notes,
    checkpoint_links: itemLinks(data, i),
  })));
}
