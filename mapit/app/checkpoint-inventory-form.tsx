"use client";
import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { Field } from "./forms";
import { qty, type Action, type Item, type Stage } from "./model";

export function CheckpointInventoryForm({ stage, items, save, close, createNew, busy }: {
  stage: Stage; items: Item[]; save: (action: Action) => Promise<boolean>;
  close: () => void; createNew: () => void; busy: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const listId = useId();
  const inventory = items.filter(item => item.labId === stage.labId);
  const visible = inventory.filter(item => `${item.name} ${item.vendor} ${item.sku} ${item.location}`.toLowerCase().includes(search.trim().toLowerCase()));
  const available = inventory.filter(item => !item.stageIds.includes(stage.id));
  const selectableIds = selected.filter(id => available.some(item => item.id === id));
  const toggle = (id: string) => setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);

  return <form onSubmit={async e => {
    e.preventDefault();
    if (!selectableIds.length || busy) return;
    if (await save({ type: "stage.linkItems", labId: stage.labId, stageId: stage.id, itemIds: selectableIds })) close();
  }}><fieldset disabled={busy}>
    <p className="checkpoint-picker-context">Choose supplies for <strong>{stage.name}</strong>. Linking keeps their stock and other checkpoint links unchanged.</p>
    <div className="checkpoint-picker-heading"><h3>Existing inventory</h3><button type="button" className="button" onClick={createNew}><Plus size={16}/>Create new item</button></div>
    {inventory.length > 0 ? <>
      <Field label="Search existing inventory"><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Item name, vendor, SKU or location" autoFocus aria-controls={listId}/></Field>
      <div className="checkpoint-picker-summary" role="status">{visible.length} results · {selectableIds.length} selected</div>
      {!available.length && <p className="callout">All inventory items in this laboratory are already linked to this checkpoint.</p>}
      <div className="checkpoint-inventory-list" id={listId}>
        {visible.map(item => {
          const linked = item.stageIds.includes(stage.id), checked = selectableIds.includes(item.id);
          return <label key={item.id} className={`checkpoint-inventory-option${checked ? " is-selected" : ""}${linked ? " is-linked" : ""}`}>
            <input type="checkbox" checked={linked || checked} disabled={linked || (!checked && selectableIds.length >= 200)} onChange={() => toggle(item.id)} aria-label={`${linked ? "Already linked" : "Select"}: ${item.name}`}/>
            <span className="checkpoint-inventory-copy"><strong>{item.name}</strong><span>{[item.vendor, item.sku].filter(Boolean).join(" · ") || "No vendor or catalog number"}</span>{item.location && <span>Location: {item.location}</span>}<span className="checkpoint-inventory-stock">{qty(item.stock)} {item.units} on hand · Reorder ≤ {qty(item.threshold)} · Target {qty(item.target)}</span><span className={linked ? "checkpoint-link-status" : "muted"}>{linked ? "Already linked here" : item.stageIds.length ? `Used at ${item.stageIds.length} other ${item.stageIds.length === 1 ? "checkpoint" : "checkpoints"}` : "Not linked to a checkpoint yet"}</span></span>
          </label>;
        })}
        {!visible.length && <p className="checkpoint-picker-empty">No matching inventory. Try another name, vendor, SKU or location.</p>}
      </div>
      {selectableIds.length >= 200 && <p className="callout">Link up to 200 supplies at a time. Save this selection, then add more.</p>}
    </> : <p className="checkpoint-picker-empty">This laboratory has no inventory yet. Create a new item to add its first supply.</p>}
    <div className="form-footer"><button type="button" className="button" disabled={busy} onClick={close}>Cancel</button><button className="button primary" disabled={busy || !selectableIds.length}>{busy ? "Linking…" : `Link ${selectableIds.length || "selected"} ${selectableIds.length === 1 ? "supply" : "supplies"}`}</button></div>
  </fieldset></form>;
}
