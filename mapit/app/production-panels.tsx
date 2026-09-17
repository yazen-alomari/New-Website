"use client";
import { CheckCircle2, ClipboardList, Code2, Pencil, Plus, TriangleAlert } from "lucide-react";
import { dataReadiness } from "./readiness";
import { type Data, type Item, type Lab } from "./model";

export function SetupPanel({ data, lab, editItem, editLab, addWorkflow, addStage, addItems }: { data: Data; lab: Lab; editItem: (item: Item) => void; editLab: () => void; addWorkflow: () => void; addStage: () => void; addItems: () => void }) {
  const report = dataReadiness(data, lab.id);
  const issues = report.issues.filter(issue => issue.count > 0);
  return <section className="panel setup-panel"><details><summary className="panel-heading"><div><div className="eyebrow">REAL DATA CHECK</div><h2>Laboratory data checklist</h2><p className="muted">Based on saved records · not a clinical or compliance score</p></div><span className={`badge ${report.complete ? "good" : "watch"}`}>{report.complete ? <CheckCircle2 size={15}/> : <ClipboardList size={15}/>} {report.complete ? "Details complete" : `${report.totalIssues} setup gaps · open checklist`}</span></summary><div className="setup-content">
    <div className="setup-actions">{report.missingLabLocation && <button className="button small" onClick={editLab}><Pencil size={15}/>Set laboratory location</button>}{report.missingWorkflows && <button className="button small" onClick={addWorkflow}><Plus size={15}/>Add workflow</button>}{report.missingCheckpoints && !report.missingWorkflows && <button className="button small" onClick={addStage}><Plus size={15}/>Add checkpoint</button>}{report.missingItems && <button className="button primary small" onClick={addItems}><Plus size={15}/>Import inventory</button>}</div>
    {issues.filter(issue => issue.itemIds.length > 0).length > 0 && <div className="setup-issues">{issues.filter(issue => issue.itemIds.length > 0).map(issue => <details key={issue.key}><summary><span>{issue.label}</span><b>{issue.count}</b></summary><div>{issue.itemIds.map(id => data.items.find(item => item.id === id)).filter((item): item is Item => Boolean(item)).map(item => <button className="setup-item" key={item.id} onClick={() => editItem(item)}><span>{item.name}</span><Pencil size={14}/></button>)}</div></details>)}</div>}
    <p className="muted">{report.complete ? "Your tracked supplies have prices, purchasing details, locations and checkpoint links. Keep quantities and usage up to date as work happens." : "Open a row to edit missing details, or export and re-import your inventory for bulk updates. Optional planning estimates and budgets remain unset until you choose to enter them."}</p>
  </div></details></section>;
}

export function IntegrationPanel() {
  return <section className="panel"><div className="panel-heading"><div><h2>Integrations & API</h2><p className="muted">Connection status and requirements</p></div><Code2 size={22}/></div><div className="settings-copy integration-copy">
    <div className="split"><strong>Inventory CSV import / export</strong><span className="badge good">Available</span></div>
    <div className="split"><strong>External services</strong><span className="badge neutral">Not connected</span></div>
    <p>This is a shared workspace. Anyone with the link can view and edit its inventory. Vendor links open the supplier’s site; purchase orders are not automatically submitted.</p>
    <p><strong>General-purpose client API.</strong> A versioned REST/JSON API can let each client build its own LIS integration. It needs machine authentication, per-client laboratory permissions and documented stock, order and receipt operations. This client API is not enabled yet; each LIS will still need field and unit mapping.</p>
    <details><summary>What is needed to connect a system?</summary><ol><li>The exact LIS/LIMS, supplier, accounting or notification service, plus its API documentation and a test account.</li><li>The records to sync, direction, schedule, and which system owns each value. Match SKUs and stock units explicitly.</li><li>Scoped credentials configured securely on the server. Never enter API secrets into inventory notes or import files.</li><li>A tested connector with permissions, duplicate-event protection, retries and visible sync history. Automatic purchasing requires a separate approval step.</li></ol></details>
    <p className="integration-boundary"><TriangleAlert size={18}/>Keep patient identifiers and results out of this inventory workspace. Team roles, restore testing and external connections need separate setup before wider rollout.</p>
  </div></section>;
}
