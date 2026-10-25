import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Save,
  Copy,
  Settings2,
  X,
  ArrowUpRight,
  Download,
  Upload,
  Trash2,
  FlaskConical,
  SlidersHorizontal,
  Check,
  Printer,
  ChevronDown,
} from "lucide-react";
import {
  calculateMolecularCosts,
  molecularEffectiveSettings,
  normalizeMolecularAnalysis,
} from "./cost-engine.js";
import { money, uid, isoDay } from "./model.js";
import {
  Alert,
  Badge,
  Button,
  Field,
  IconButton,
  Metric,
  Modal,
  NumberField,
  csv,
  download,
} from "./components.jsx";

const bases = {
  per_received: "Per received sample",
  per_full_attempt: "Per full attempt",
  per_pcr_attempt: "Per PCR attempt",
  per_extraction_plate: "Per extraction plate",
  per_pcr_plate: "Per PCR plate",
  per_batch: "Per job",
  per_report: "Per reported result",
  monthly: "Monthly",
};
const groups = {
  materials: [
    ["material.extractionCents", "Extraction reagents / attempt", "money"],
    ["material.waterCents", "Water & consumables / attempt", "money"],
    ["material.tipsCents", "Pipette tips / attempt", "money"],
    ["material.deepwellPlateCents", "Extraction plate", "money"],
    ["material.extractionCapacity", "Samples / extraction plate", "capacity"],
    ["material.pcrPlateCents", "PCR plate", "money"],
    ["material.pcrCapacity", "Sample-panels / PCR plate", "capacity"],
    ["reagentLossPct", "Reagent loss (%)", "percent"],
  ],
  handling: [
    ["additional.collectionCents", "Collection kit / received sample", "money"],
    ["additional.shippingCents", "Shipping / received sample", "money"],
    ["additional.ppeWasteCents", "PPE & waste / full attempt", "money"],
    ["additional.extractionQcPerPlateCents", "Extraction QC / plate", "money"],
    ["additional.pcrQcPerPlateCents", "PCR QC / plate", "money"],
    [
      "additional.pcrRepeatConsumablesCents",
      "Consumables / PCR-only repeat",
      "money",
    ],
    ["additional.otherPerBatchCents", "Other cost / job", "money"],
    ["additional.otherPerReportCents", "Other cost / report", "money"],
  ],
  labor: [
    ["labor.benchHourlyCents", "Loaded bench rate / hour", "money"],
    ["labor.benchBatchMinutes", "Bench minutes / run", "number"],
    ["labor.benchSampleMinutes", "Bench minutes / full attempt", "number"],
    [
      "labor.benchExtractionPlateMinutes",
      "Bench minutes / extraction plate",
      "number",
    ],
    ["labor.benchPcrPlateMinutes", "Bench minutes / PCR plate", "number"],
    [
      "labor.benchPcrRepeatMinutes",
      "Bench minutes / PCR-only repeat",
      "number",
    ],
    ["labor.reviewHourlyCents", "Review rate / hour", "money"],
    ["labor.reviewMinutesPerReport", "Review minutes / report", "number"],
  ],
  overhead: [
    ["monthly.equipmentCents", "Equipment / month", "money"],
    ["monthly.maintenanceCents", "Maintenance / month", "money"],
    ["monthly.facilityCents", "Facility / month", "money"],
    ["monthly.softwareCents", "Software / month", "money"],
    ["monthly.qualityCents", "Quality program / month", "money"],
    ["monthly.adminCents", "Administration / month", "money"],
    ["monthlyReports", "Shared monthly report volume", "volume"],
  ],
  pricing: [
    ["revenue.collectedCents", "Expected collected / report", "money"],
    ["revenue.targetMarginPct", "Target margin (%)", "margin"],
  ],
};
const get = (object, path) =>
  path.split(".").reduce((value, key) => value?.[key], object);
function set(object, path, value) {
  const keys = path.split("."),
    last = keys.pop();
  keys.reduce((v, k) => v[k], object)[last] = value;
}

export default function Costs({ data, save, busy, notify, onDirty }) {
  const [id, setId] = useState(data.scenarios[0].id),
    [draft, setDraft] = useState(structuredClone(data.scenarios[0].analysis));
  const [name, setName] = useState(data.scenarios[0].name),
    [dirty, setDirty] = useState(false),
    [settings, setSettings] = useState(false),
    [tab, setTab] = useState("materials"),
    [modal, setModal] = useState(null),
    [error, setError] = useState("");
  const upload = useRef(null);
  const panelId = draft.selectedPanel;
  const result = useMemo(() => {
    try {
      return calculateMolecularCosts(draft, data.rates);
    } catch {
      return null;
    }
  }, [draft, data.rates]);
  const selected = result?.panels.find((p) => p.id === panelId);
  const effective = useMemo(() => {
    try {
      return molecularEffectiveSettings(draft, panelId, data.rates);
    } catch {
      return draft;
    }
  }, [draft, panelId, data.rates]);
  const change = (fn) => {
    setDraft((old) => {
      const next = structuredClone(old);
      fn(next);
      return next;
    });
    setDirty(true);
    onDirty(true);
    setError("");
  };
  function field(path, value) {
    change((d) => {
      if (path.startsWith("monthly.") || path === "monthlyReports")
        set(d, path, value);
      else d.panelSettings[panelId].overrides[path] = value;
    });
  }
  async function persist(copy = false, newName = name) {
    if (!result) return;
    const response = await save({
      type: "scenario.save",
      value: { id: copy ? undefined : id, name: newName, analysis: draft },
    });
    if (response) {
      if (copy) setId(response.scenarios.at(-1).id);
      setName(newName);
      setDirty(false);
      onDirty(false);
      notify("Scenario saved");
      return true;
    }
    return false;
  }
  function choose(s, confirmed = false) {
    if (
      !confirmed &&
      dirty &&
      !window.confirm("Discard unsaved scenario edits?")
    )
      return;
    setId(s.id);
    setName(s.name);
    setDraft(structuredClone(s.analysis));
    setDirty(false);
    onDirty(false);
    setError("");
  }
  const comparisons = [1, 16, 32, 60, 96, 192].map((count) => {
    try {
      const p = calculateMolecularCosts(
        { ...draft, batchSize: count },
        data.rates,
      ).panels.find((p) => p.id === panelId);
      return { ...p, count };
    } catch {
      return { count, perReportCents: null };
    }
  });
  const max = Math.max(...comparisons.map((p) => p.perReportCents || 0), 1);
  const exportCsv = () =>
    download(
      `congen-${panelId}-${isoDay()}.csv`,
      csv([
        [
          "Panel",
          "Batch samples",
          "Reportable results",
          "Cost category",
          "Batch cost USD",
          "Cost/report USD",
          "Status",
        ],
        ...selected.lines.map((l) => [
          selected.name,
          draft.batchSize,
          selected.reportable,
          l.label,
          (l.totalCents / 100).toFixed(2),
          selected.reportable
            ? (l.totalCents / selected.reportable / 100).toFixed(2)
            : "",
          l.status,
        ]),
      ]),
      "text/csv;charset=utf-8",
    );
  return (
    <div className="cost-workspace">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TEST ECONOMICS</span>
          <h1>
            Cost analysis
            <span className="title-dot" />
          </h1>
          <p>Know the cost of every reportable result.</p>
        </div>
        <div className="actions">
          <IconButton
            icon={Upload}
            label="Import calculator settings"
            onClick={() => upload.current.click()}
          />
          <IconButton
            icon={Download}
            label="Export scenario backup"
            onClick={() =>
              download(
                `congen-scenario-${isoDay()}.json`,
                JSON.stringify({ name, analysis: draft }, null, 2),
              )
            }
          />
          <IconButton
            icon={Printer}
            label="Print cost report"
            onClick={() => window.print()}
          />
          <Button
            icon={Save}
            kind="primary"
            disabled={busy || !result}
            onClick={() => persist()}
          >
            {dirty ? "Save changes" : "Saved scenario"}
          </Button>
        </div>
      </div>
      <input
        type="file"
        accept="application/json,.json"
        className="sr-only"
        ref={upload}
        onChange={async (e) => {
          const f = e.target.files[0];
          e.target.value = "";
          if (!f) return;
          try {
            if (f.size > 1500000)
              throw new Error("Choose a JSON file smaller than 1.5 MB.");
            const value = JSON.parse(await f.text());
            const imported = normalizeMolecularAnalysis(
              value.analysis || value,
              data.rates,
            );
            setDraft(imported);
            setDirty(true);
            onDirty(true);
            notify("Imported into your draft. Save to keep these settings.");
          } catch (err) {
            setError(err.message);
          }
        }}
      />
      {error && <Alert>{error}</Alert>}
      {!result && (
        <Alert>
          Check the scenario: nonreportable results cannot exceed the number of
          received samples, and all counts must be whole numbers.
        </Alert>
      )}
      <div className="scenario-bar">
        <Field label="Scenario">
          <select
            aria-label="Scenario"
            value={id}
            onChange={(e) =>
              choose(data.scenarios.find((s) => s.id === e.target.value))
            }
          >
            {data.scenarios.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Badge tone={dirty ? "amber" : "green"}>
          {dirty ? "Unsaved draft" : "Shared scenario"}
        </Badge>
        <div className="spacer" />
        <Button icon={Copy} onClick={() => setModal("scenario")}>
          Save as
        </Button>
        <IconButton
          icon={Trash2}
          label="Delete scenario"
          disabled={data.scenarios.length < 2 || busy}
          onClick={async () => {
            if (!window.confirm(`Delete ${name}?`)) return;
            const next = await save({ type: "scenario.delete", id });
            if (next) choose(next.scenarios[0], true);
          }}
        />
      </div>
      <div className="panel-tabs" role="tablist" aria-label="Test panels">
        {data.rates.panels.map((p, i) => (
          <button
            role="tab"
            aria-selected={panelId === p.id}
            key={p.id}
            className={panelId === p.id ? "active" : ""}
            onClick={() => change((d) => (d.selectedPanel = p.id))}
          >
            <span className={`panel-dot color-${i % 4}`} />
            {p.name}
          </button>
        ))}
        <IconButton
          icon={Plus}
          label="Add test panel"
          onClick={() => setModal("panel")}
        />
      </div>
      <div className="cost-layout">
        <div className="cost-main">
          <div className="cost-head">
            <div>
              <span className="eyebrow">
                {selected?.name || "SELECTED PANEL"} / KNOWN COST
              </span>
              <div className="cost-amount">
                {money(selected?.perReportCents ?? null)}
                <span>/ report</span>
              </div>
              <span className="muted">
                {selected?.unpricedFields.length || 0} inputs not set{" "}
                <span className="separator">/</span> Subtotal of entered costs
              </span>
            </div>
            <Button
              icon={SlidersHorizontal}
              kind={settings ? "selected" : ""}
              onClick={() => setSettings(!settings)}
            >
              Panel settings
            </Button>
          </div>
          <div className="metrics compact">
            <Metric
              label="Job total"
              value={money(selected?.totalCents ?? null)}
              detail="Including entered repeat costs"
            />
            <Metric
              label="Reportable"
              value={
                selected
                  ? `${selected.reportable} / ${draft.batchSize}`
                  : "Not set"
              }
              detail="Original samples only"
            />
            <Metric
              label="Contribution"
              value={money(selected?.contributionCents ?? null)}
              detail={
                selected?.marginPct == null
                  ? "Expected collection not set"
                  : `${selected.marginPct.toFixed(1)}% of entered revenue`
              }
            />
          </div>
          <section className="section-block">
            <div className="section-heading">
              <h2>Run configuration</h2>
              <span className="muted">Samples & repeats</span>
            </div>
            <div className="batch-control">
              <NumberField
                label="Received samples"
                value={draft.batchSize}
                change={(v) => change((d) => (d.batchSize = v))}
                min={1}
                max={960}
                step={1}
                required
              />
              <div className="segmented" aria-label="Batch presets">
                {[1, 16, 32, 60, 96].map((n) => (
                  <button
                    key={n}
                    aria-pressed={draft.batchSize === n}
                    onClick={() => change((d) => (d.batchSize = n))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="field-grid three">
              <NumberField
                label="Full-workflow repeats"
                value={draft.repeats}
                change={(v) => change((d) => (d.repeats = v))}
                step={1}
                max={10000}
              />
              <NumberField
                label="PCR-only repeats"
                value={draft.pcrOnlyRepeats}
                change={(v) => change((d) => (d.pcrOnlyRepeats = v))}
                step={1}
                max={10000}
              />
              <NumberField
                label="Nonreportable samples"
                value={draft.nonreportable}
                change={(v) => change((d) => (d.nonreportable = v))}
                step={1}
                max={draft.batchSize}
              />
            </div>
            <div className="run-strip">
              <span>
                <b>{selected?.extractionPlates ?? "-"}</b> extraction plates
              </span>
              <span>
                <b>{selected?.pcrPlates ?? "-"}</b> PCR plates
              </span>
              <span>
                <b>{selected?.pcrAttempts ?? "-"}</b> PCR attempts
              </span>
            </div>
          </section>
          <section className="section-block">
            <div className="section-heading">
              <h2>Cost breakdown</h2>
              <IconButton
                icon={Download}
                label="Export cost breakdown CSV"
                disabled={!selected}
                onClick={exportCsv}
              />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Cost component</th>
                    <th>Status</th>
                    <th className="numeric">Job total</th>
                    <th className="numeric">Per report</th>
                  </tr>
                </thead>
                <tbody>
                  {selected?.lines
                    .filter(
                      (l) =>
                        l.totalCents > 0 ||
                        [
                          "extraction",
                          "reagent",
                          "water",
                          "tips",
                          "extraction-plates",
                          "pcr-plates",
                        ].includes(l.id) ||
                        l.custom,
                    )
                    .map((l) => (
                      <tr key={l.id}>
                        <td>{l.label}</td>
                        <td>
                          <Badge tone={l.status === "known" ? "" : "amber"}>
                            {l.status === "known" ? "Entered" : l.status}
                          </Badge>
                        </td>
                        <td className="numeric">{money(l.totalCents)}</td>
                        <td className="numeric">
                          {money(
                            selected.reportable
                              ? l.totalCents / selected.reportable
                              : null,
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={2}>Known subtotal</th>
                    <td className="numeric">
                      {money(selected?.totalCents ?? null)}
                    </td>
                    <td className="numeric">
                      {money(selected?.perReportCents ?? null)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
        {settings ? (
          <aside className="settings-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{selected?.name}</span>
                <h2>Panel settings</h2>
              </div>
              <IconButton
                icon={X}
                label="Close panel settings"
                onClick={() => setSettings(false)}
              />
            </div>
            <div className="settings-tabs">
              {[...Object.keys(groups), "custom"].map((t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "materials" && (
              <NumberField
                label="Panel reagents / PCR attempt"
                cents
                value={draft.material.panels[panelId]}
                change={(v) => change((d) => (d.material.panels[panelId] = v))}
              />
            )}
            {(groups[tab] || []).map(([path, label, type]) => (
              <NumberField
                key={`${panelId}:${path}`}
                label={label}
                value={get(effective, path)}
                change={(v) => field(path, v)}
                cents={type === "money"}
                min={["capacity", "volume"].includes(type) ? 1 : 0}
                max={
                  type === "margin"
                    ? 99.99
                    : type === "percent"
                      ? 95
                      : type === "capacity"
                        ? 960
                        : undefined
                }
                step={["capacity", "volume"].includes(type) ? 1 : undefined}
                required={type === "capacity"}
              />
            ))}
            {tab === "pricing" && (
              <div className="pricing-result">
                <span>Target price on entered costs</span>
                <strong>{money(selected?.targetPriceCents ?? null)}</strong>
              </div>
            )}
            {tab === "overhead" && (
              <p className="context-note">
                Shared monthly overhead applies to every panel in this scenario.
                Panel-specific monthly charges belong in Custom.
              </p>
            )}
            {tab === "custom" && (
              <>
                <NumberField
                  label="Panel monthly report volume"
                  min={1}
                  step={1}
                  value={draft.panelSettings[panelId].monthlyReports}
                  change={(v) =>
                    change((d) => (d.panelSettings[panelId].monthlyReports = v))
                  }
                />
                <div className="custom-costs">
                  {draft.panelSettings[panelId].customCosts.map((row, i) => (
                    <div className="custom-cost" key={row.id}>
                      <div className="split">
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(e) =>
                              change(
                                (d) =>
                                  (d.panelSettings[panelId].customCosts[
                                    i
                                  ].enabled = e.target.checked),
                              )
                            }
                          />
                          Included
                        </label>
                        <IconButton
                          icon={Trash2}
                          label={`Remove ${row.label}`}
                          onClick={() =>
                            change((d) =>
                              d.panelSettings[panelId].customCosts.splice(i, 1),
                            )
                          }
                        />
                      </div>
                      <Field label="Cost name">
                        <input
                          value={row.label}
                          maxLength={80}
                          onChange={(e) =>
                            change(
                              (d) =>
                                (d.panelSettings[panelId].customCosts[i].label =
                                  e.target.value),
                            )
                          }
                        />
                      </Field>
                      <NumberField
                        label="Amount"
                        cents
                        value={row.amountCents}
                        change={(v) =>
                          change(
                            (d) =>
                              (d.panelSettings[panelId].customCosts[
                                i
                              ].amountCents = v),
                          )
                        }
                      />
                      <Field label="Charged per">
                        <select
                          value={row.basis}
                          onChange={(e) =>
                            change(
                              (d) =>
                                (d.panelSettings[panelId].customCosts[i].basis =
                                  e.target.value),
                            )
                          }
                        >
                          {Object.entries(bases).map(([v, l]) => (
                            <option value={v} key={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <NumberField
                        label="Quantity multiplier"
                        min={0.001}
                        value={row.quantity}
                        required
                        change={(v) =>
                          change(
                            (d) =>
                              (d.panelSettings[panelId].customCosts[
                                i
                              ].quantity = v),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                <Button
                  icon={Plus}
                  onClick={() =>
                    change((d) =>
                      d.panelSettings[panelId].customCosts.push({
                        id: uid(),
                        label: "Additional cost",
                        amountCents: null,
                        quantity: 1,
                        basis: "per_received",
                        enabled: true,
                      }),
                    )
                  }
                >
                  Add cost item
                </Button>
              </>
            )}
            <div className="settings-footer">
              <Button
                icon={Save}
                kind="primary"
                disabled={busy || !result}
                onClick={() => persist()}
              >
                Save scenario
              </Button>
            </div>
          </aside>
        ) : (
          <aside className="insight-panel">
            <section className="section-block">
              <div className="section-heading">
                <h2>Batch efficiency</h2>
                <Badge>Cost / report</Badge>
              </div>
              <div className="batch-chart">
                {comparisons.map((p) => (
                  <button
                    className={draft.batchSize === p.count ? "active" : ""}
                    key={p.count}
                    onClick={() => change((d) => (d.batchSize = p.count))}
                    title={`${p.count} samples: ${money(p.perReportCents)}`}
                  >
                    <span>
                      {p.count}
                      <small>samples</small>
                    </span>
                    <div>
                      <i
                        style={{
                          width: `${Math.max(2, ((p.perReportCents || 0) / max) * 100)}%`,
                        }}
                      />
                    </div>
                    <b>{money(p.perReportCents)}</b>
                  </button>
                ))}
              </div>
            </section>
            <section className="section-block">
              <div className="section-heading">
                <h2>Panel comparison</h2>
                <span className="muted">{draft.batchSize} samples</span>
              </div>
              {result?.panels.map((p, i) => (
                <button
                  className="panel-comparison"
                  key={p.id}
                  onClick={() => change((d) => (d.selectedPanel = p.id))}
                >
                  <span>
                    <i className={`panel-dot color-${i % 4}`} />
                    {p.name}
                  </span>
                  <strong>{money(p.perReportCents)}</strong>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </section>
            <section className="section-block assumptions">
              <h2>Model assumptions</h2>
              {selected?.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
              <small>
                {data.rates.source}. Capacities and pricing remain editable.
              </small>
            </section>
          </aside>
        )}
      </div>
      {modal && (
        <Modal
          title={modal === "panel" ? "Add test panel" : "Save a scenario"}
          close={() => setModal(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const val = new FormData(e.currentTarget).get("name");
              if (modal === "panel") {
                const next = await save({ type: "panel.add", name: val });
                if (next) {
                  const d = normalizeMolecularAnalysis(draft, next.rates);
                  d.selectedPanel = next.rates.panels.at(-1).id;
                  d.material.panels[d.selectedPanel] = null;
                  setDraft(d);
                  setDirty(true);
                  onDirty(true);
                  setModal(null);
                }
              } else if (await persist(true, val)) setModal(null);
            }}
          >
            <Field label={modal === "panel" ? "Panel name" : "Scenario name"}>
              <input
                name="name"
                required
                maxLength={80}
                autoFocus
                defaultValue={modal === "panel" ? "" : `${name} - comparison`}
              />
            </Field>
            <footer className="form-actions">
              <Button onClick={() => setModal(null)}>Cancel</Button>
              <button className="button primary" disabled={busy}>
                <Plus size={16} />
                {modal === "panel" ? "Add panel" : "Save scenario"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
