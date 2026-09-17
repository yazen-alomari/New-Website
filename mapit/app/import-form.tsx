"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileUp, TriangleAlert } from "lucide-react";
import { inventoryCsvMaxBytes, inventoryCsvMaxRows, inventoryTemplateCsv } from "./inventory-csv";
import { planInventoryImport } from "./import-plan";
import { money, qty, type Action, type Data } from "./model";

export function downloadInventoryTemplate() {
  const url = URL.createObjectURL(new Blob([inventoryTemplateCsv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = "mapit-inventory-template.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ImportForm({ data, labId, save, close, busy }: { data: Data; labId: string; save: (action: Action) => Promise<boolean>; close: () => void; busy: boolean }) {
  const [csv, setCsv] = useState<string | null>(null), [filename, setFilename] = useState(""), [fileError, setFileError] = useState(""), [reading, setReading] = useState(false);
  const [createCheckpoints, setCreateCheckpoints] = useState(false), [allowUpdates, setAllowUpdates] = useState(false), [limit, setLimit] = useState(30);
  const plan = useMemo(() => csv === null ? null : planInventoryImport(data, labId, csv, { createCheckpoints, allowUpdates }, "Import preview"), [csv, data, labId, createCheckpoints, allowUpdates]);
  const laboratory = data.labs.find(l => l.id === labId)!;
  return <div className="import-form">
    <p className="callout"><strong>Import into {laboratory.name}</strong><br/>Up to {inventoryCsvMaxRows} supplies per CSV file, 1 MB maximum. Nothing is saved until you confirm a valid preview.</p>
    <div className="split"><span className="muted">Fill the template in Excel, Numbers or Sheets, then save as UTF-8 CSV.</span><button className="button" disabled={busy} onClick={downloadInventoryTemplate}><Download size={17}/>Download template</button></div>
    <details className="import-guide"><summary>Template columns & instructions</summary><div>
      <p><strong>Required:</strong> item_name, stock_unit, on_hand, reorder_threshold, target_stock. Target must be above the reorder threshold.</p>
      <p><strong>Optional:</strong> unit_cost_usd, vendor, sku, vendor_url, location, lead_time_days, estimated_daily_usage, checkpoint_links, notes.</p>
      <p><strong>Numbers:</strong> use plain numbers without currency symbols or thousands separators. Quantities allow 3 decimal places; prices allow 2. Blank prices stay unpriced. Blank lead time and estimated usage mean zero.</p>
      <p><strong>Map links:</strong> use the full workflow and checkpoint names: <code>Infectious disease::Extraction | Pharmacogenomics::Extraction</code>. Custom workflows work the same way. Leave blank for unassigned inventory.</p>
      <p><strong>Updates:</strong> download Export CSV from Inventory and keep item_id and every exported column to update those exact records. Leave item_id blank for new items. Rows not in your file are never removed. Possible duplicate additions are rejected.</p>
      <p><strong>Catalog numbers:</strong> format the SKU column as text in your spreadsheet to preserve leading zeros.</p>
      <p><strong>Scope:</strong> imports inventory fields and map assignments, not purchase orders or historical consumption. New checkpoints start with the beaker icon and an empty description, both editable afterward.</p>
    </div></details>
    <label className="import-file"><FileUp size={26}/><strong>{reading ? "Reading file…" : filename || "Choose your completed CSV"}</strong><input type="file" accept=".csv,text/csv" aria-label="Inventory CSV file" disabled={busy || reading} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; setCsv(null); setFileError(""); setFilename(file?.name ?? ""); setLimit(30); if (!file) return; if (!file.name.toLowerCase().endsWith(".csv")) { setFileError("Save your spreadsheet as a .csv file first; .xlsx files cannot be imported directly."); return; } if (file.size > inventoryCsvMaxBytes) { setFileError("CSV must be 1 MB or smaller."); return; } setReading(true); try { setCsv(await file.text()); } catch { setFileError("The file could not be read. Choose it again."); } finally { setReading(false); } }}/><span>File contents are previewed here before being sent to shared storage.</span></label>
    <label className="check-row"><input type="checkbox" checked={createCheckpoints} disabled={busy} onChange={e => setCreateCheckpoints(e.target.checked)}/><span>Create missing workflows and checkpoints from my map links</span></label>
    <label className="check-row"><input type="checkbox" checked={allowUpdates} disabled={busy} onChange={e => setAllowUpdates(e.target.checked)}/><span>Allow updates to existing items using item_id</span></label>
    {allowUpdates && <p className="import-warning">Updates replace all editable fields in those rows. Blank optional cells clear the old values. On-hand is a new counted balance, not an amount to add; changes are logged as adjustments.</p>}
    {fileError && <div className="alert" role="alert">{fileError}</div>}
    {plan && (plan.errors.length ? <div className="import-errors" role="alert"><h3><TriangleAlert size={18}/>Fix {plan.errors.length} {plan.errors.length === 1 ? "error" : "errors"} before importing</h3><p>No rows will be saved. Correct the file or options, then select the file again.</p><ul>{plan.errors.slice(0, 50).map((e, i) => <li key={i}><strong>CSV line {e.row}:</strong> {e.message}</li>)}</ul>{plan.errors.length > 50 && <p>Showing the first 50 errors.</p>}</div> : <>
      <div className="import-summary"><CheckCircle2 size={20}/><div><strong>Ready: {plan.added} new · {plan.updated} updated supplies</strong><small>{plan.newFlows} new workflows · {plan.newStages} new checkpoints · {plan.preview.filter(r => r.cost === null).length} unpriced items</small></div></div>
      <div className="import-preview table-scroll"><table><thead><tr><th>CSV line / action</th><th>Supply</th><th>New on-hand</th><th>Unit price</th><th>Map links</th></tr></thead><tbody>{plan.preview.slice(0, limit).map(r => <tr key={r.row}><td>{r.row} · {r.mode}</td><td><strong>{r.name}</strong><small>{r.units}</small></td><td>{qty(r.stock)}{r.previousStock !== null && <small>Was {qty(r.previousStock)}</small>}</td><td>{money(r.cost)}</td><td>{r.links || "Unassigned"}</td></tr>)}</tbody></table></div>{limit < plan.preview.length && <button className="button small" onClick={() => setLimit(limit + 50)}>Show more preview rows</button>}
    </>)}
    <div className="form-footer"><button className="button" disabled={busy} onClick={close}>Cancel</button><button className="button primary" disabled={busy || reading || !plan || !!plan.errors.length || !!fileError} onClick={async () => { if (await save({ type: "inventory.import", labId, csv, createCheckpoints, allowUpdates })) close(); }}>{busy ? "Importing…" : `Import ${plan && !plan.errors.length ? plan.preview.length : ""} supplies`}</button></div>
  </div>;
}
