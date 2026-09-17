import type { Data, Item } from "./model.ts";

export type PurchasingField = "vendor" | "sku" | "url";
export type ReadinessIssue = {
  key: "laboratory" | "lab-location" | "workflows" | "checkpoints" | "items" | "prices" | "purchasing" | "locations" | "links";
  label: string;
  count: number;
  itemIds: string[];
};

/** Data completeness only: this is not an assessment of clinical or regulatory readiness. */
export function dataReadiness(data: Data, labId: string) {
  const lab = data.labs.find(entry => entry.id === labId);
  const items = data.items.filter(item => item.labId === labId);
  const flows = data.flows.filter(flow => flow.labId === labId);
  const stages = data.stages.filter(stage => stage.labId === labId);
  const stageIds = new Set(stages.map(stage => stage.id));
  const missingPrices = items.filter(item => item.cost === null);
  const missingPurchasing = items.flatMap(item => {
    const fields = (["vendor", "sku", "url"] as const).filter(field => !item[field].trim());
    return fields.length ? [{ item, fields: fields as PurchasingField[] }] : [];
  });
  const missingLocations = items.filter(item => !item.location.trim());
  const missingCheckpointLinks = items.filter(item => !item.stageIds.some(id => stageIds.has(id)));
  const missingLabLocation = Boolean(lab && !lab.location.trim());
  const missingWorkflows = Boolean(lab && !flows.length);
  const missingCheckpoints = Boolean(lab && !stages.length);
  const missingItems = Boolean(lab && !items.length);
  const issues: ReadinessIssue[] = [];
  if (!lab) issues.push({ key: "laboratory", label: "Select an existing laboratory", count: 1, itemIds: [] });
  if (missingLabLocation) issues.push({ key: "lab-location", label: "Laboratory location not set", count: 1, itemIds: [] });
  if (missingWorkflows) issues.push({ key: "workflows", label: "Add a workflow", count: 1, itemIds: [] });
  if (missingCheckpoints) issues.push({ key: "checkpoints", label: "Add a checkpoint", count: 1, itemIds: [] });
  if (missingItems) issues.push({ key: "items", label: "Add or import inventory", count: 1, itemIds: [] });
  const addItemIssue = (key: ReadinessIssue["key"], label: string, rows: Item[]) => {
    if (rows.length) issues.push({ key, label, count: rows.length, itemIds: rows.map(item => item.id) });
  };
  addItemIssue("prices", "Items without a unit cost", missingPrices);
  addItemIssue("purchasing", "Items missing vendor, catalog number, or ordering link", missingPurchasing.map(row => row.item));
  addItemIssue("locations", "Items without a storage location", missingLocations);
  addItemIssue("links", "Items without a checkpoint link", missingCheckpointLinks);
  const incompleteItemCount = new Set(issues.flatMap(issue => issue.itemIds)).size;
  return {
    labFound: Boolean(lab), itemCount: items.length, workflowCount: flows.length, checkpointCount: stages.length,
    missingPrices, missingPurchasing, missingLocations, missingCheckpointLinks,
    missingLabLocation, missingWorkflows, missingCheckpoints, missingItems,
    issues, totalIssues: issues.reduce((sum, issue) => sum + issue.count, 0),
    incompleteItemCount, completeItemCount: items.length - incompleteItemCount,
    complete: Boolean(lab) && issues.length === 0,
  };
}

export const stockHistoryColumns = [
  "movement_id", "laboratory_id", "laboratory_name", "item_id", "item_name", "stock_unit",
  "quantity_change", "unit_cost_usd", "value_change_usd", "movement_kind", "date", "note", "actor", "reversed_by",
] as const;

// Only actual numbers bypass formula protection, so signed stock changes remain numeric.
function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (typeof value !== "number" && (text.startsWith("'") || /^\s*[=+\-@]/u.test(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Export persisted audit snapshots, including deleted items and reversed usage records. */
export function stockHistoryCsv(data: Data, labId: string): string {
  const labName = data.labs.find(lab => lab.id === labId)?.name ?? "";
  const rows = data.movements.filter(movement => movement.labId === labId).map(movement => [
    movement.id, movement.labId, labName, movement.itemId, movement.itemName, movement.units,
    movement.quantity, movement.cost === null ? null : movement.cost / 100,
    movement.cost === null ? null : Math.round(movement.quantity * movement.cost) / 100,
    movement.kind, movement.date, movement.note, movement.actor, movement.reversedBy,
  ].map(csvCell).join(","));
  return `\uFEFF${[stockHistoryColumns.join(","), ...rows].join("\r\n")}\r\n`;
}
