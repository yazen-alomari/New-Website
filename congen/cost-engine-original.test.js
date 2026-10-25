import test from "node:test";
import assert from "node:assert/strict";
import {
  molecularDefaults,
  normalizeMolecularAnalysis,
  molecularEffectiveSettings,
  calculateMolecularCosts,
} from "./src/cost-engine.js";

const rates = {
  version: 1,
  currency: "USD",
  defaultBatchSize: 60,
  maximumBatchSize: 960,
  extractionCentsPerSample: 280,
  waterCentsPerSample: 30,
  tipsCentsPerSample: 100,
  extractionPlate: { costCents: 500, samplesPerPlate: 16 },
  pcrPlate: { costCents: 300, samplesPerPlate: 60 },
  panels: [
    { id: "rpp", name: "RPP Light", reagentCentsPerSample: 500 },
    { id: "sti", name: "STI", reagentCentsPerSample: 1200 },
    { id: "uti", name: "UTI", reagentCentsPerSample: 1800 },
    { id: "wound", name: "Wound", reagentCentsPerSample: 2000 },
  ],
};
const close = (actual, expected) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-7,
    "Expected " + actual + " to equal " + expected,
  );
const line = (panel, id) =>
  panel.lines.find((item) => item.id === id).totalCents;
const model = (overrides) => ({ ...molecularDefaults(rates), ...overrides });

test("original 1, 16, 60 and 240 sample presets retain material totals", () => {
  for (const [n, exPlates, pcrPlates, totals] of [
    [1, 1, 1, [1710, 2410, 3010, 3210]],
    [16, 1, 1, [15360, 26560, 36160, 39360]],
    [60, 4, 1, [56900, 98900, 134900, 146900]],
    [240, 15, 4, [227100, 395100, 539100, 587100]],
  ]) {
    const result = calculateMolecularCosts({ batchSize: n }, rates);
    assert.equal(result.extractionPlates, exPlates);
    assert.equal(result.pcrPlates, pcrPlates);
    assert.equal(result.attempts, n);
    assert.equal(result.pcrAttempts, n);
    assert.equal(result.reportable, n);
    assert.equal(result.repeatRuns, 0);
    result.panels.forEach((panel, index) => {
      close(panel.totalCents, totals[index]);
      close(panel.materialCents, totals[index]);
      close(panel.perReceivedCents, totals[index] / n);
      close(panel.perReportCents, totals[index] / n);
      assert.equal(panel.revenueCents, null);
    });
  }
});

test("full workflow repeats charge new extraction and PCR plates", () => {
  const result = calculateMolecularCosts(
    model({ batchSize: 15, repeats: 1 }),
    rates,
  );
  assert.equal(result.attempts, 16);
  assert.equal(result.pcrAttempts, 16);
  assert.equal(result.extractionPlates, 2);
  assert.equal(result.pcrPlates, 2);
  assert.equal(result.repeatRuns, 1);
  close(result.extractionUtilization, 16 / 32);
  close(result.pcrUtilization, 16 / 120);
  assert.equal(result.reportable, 15);
});

test("PCR-only reruns consume panel reagents and a new PCR plate without re-extraction", () => {
  const a = model({ batchSize: 16, repeats: 0, pcrOnlyRepeats: 1 });
  a.additional.pcrRepeatConsumablesCents = 80;
  const result = calculateMolecularCosts(a, rates);
  const panel = result.panels[0];
  assert.equal(result.attempts, 16);
  assert.equal(result.pcrAttempts, 17);
  assert.equal(result.extractionPlates, 1);
  assert.equal(result.pcrPlates, 2);
  assert.equal(line(panel, "extraction"), 16 * 280);
  assert.equal(line(panel, "reagent"), 17 * 500);
  assert.equal(line(panel, "water"), 16 * 30);
  assert.equal(line(panel, "tips"), 16 * 100);
  assert.equal(line(panel, "pcr-repeat-consumables"), 80);
});

test("initial and repeat plate counts round independently at capacity boundaries", () => {
  const result = calculateMolecularCosts(
    model({ batchSize: 60, repeats: 16, pcrOnlyRepeats: 45 }),
    rates,
  );
  assert.equal(result.extractionPlates, 5); // 4 initial + 1 repeat.
  assert.equal(result.pcrPlates, 3); // 1 initial + 2 repeat.
  assert.equal(result.attempts, 76);
  assert.equal(result.pcrAttempts, 121);
});

test("loss adjustment applies only to extraction and panel reagents", () => {
  const base = calculateMolecularCosts(
    model({ batchSize: 10, reagentLossPct: 0 }),
    rates,
  ).panels[0];
  const adjusted = calculateMolecularCosts(
    model({ batchSize: 10, reagentLossPct: 20 }),
    rates,
  ).panels[0];
  close(line(adjusted, "extraction"), line(base, "extraction") / 0.8);
  close(line(adjusted, "reagent"), line(base, "reagent") / 0.8);
  for (const id of ["water", "tips", "extraction-plates", "pcr-plates"]) {
    assert.equal(line(adjusted, id), line(base, id));
  }
});

test("fully specified example reconciles direct costs, labor, overhead, revenue and target price", () => {
  const a = model({
    batchSize: 10,
    repeats: 2,
    pcrOnlyRepeats: 3,
    nonreportable: 2,
    reagentLossPct: 20,
    monthlyReports: 100,
  });
  a.additional = {
    collectionCents: 100,
    shippingCents: 200,
    ppeWasteCents: 50,
    extractionQcPerPlateCents: 100,
    pcrQcPerPlateCents: 200,
    pcrRepeatConsumablesCents: 30,
    otherPerBatchCents: 500,
    otherPerReportCents: 20,
  };
  a.labor = {
    benchHourlyCents: 6000,
    benchBatchMinutes: 10,
    benchSampleMinutes: 2,
    benchExtractionPlateMinutes: 3,
    benchPcrPlateMinutes: 4,
    benchPcrRepeatMinutes: 5,
    reviewHourlyCents: 12000,
    reviewMinutesPerReport: 1.5,
  };
  a.monthly = {
    equipmentCents: 10000,
    maintenanceCents: 5000,
    facilityCents: 10000,
    softwareCents: 2000,
    qualityCents: 2000,
    adminCents: 1000,
  };
  a.revenue = { collectedCents: 5000, targetMarginPct: 25 };
  const result = calculateMolecularCosts(a, rates);
  const panel = result.panels[0];
  assert.deepEqual(result.unpricedFields, []);
  assert.equal(result.monthlyTotalCents, 30000);
  assert.equal(result.monthlyAllocatedCents, 2400);
  assert.equal(result.unallocatedMonthlyCents, 0);
  assert.equal(result.unallocatedMonthly, false);
  assert.equal(panel.materialCents, 16735);
  assert.equal(panel.directCents, 21685);
  assert.equal(line(panel, "bench-labor"), 7300);
  assert.equal(line(panel, "review-labor"), 2400);
  assert.equal(panel.laborCents, 9700);
  assert.equal(panel.overheadCents, 2400);
  assert.equal(panel.totalCents, 33785);
  assert.equal(panel.perReceivedCents, 3378.5);
  assert.equal(panel.perReportCents, 4223.125);
  assert.equal(panel.revenueCents, 40000);
  assert.equal(panel.contributionCents, 6215);
  close(panel.marginPct, 15.5375);
  close(panel.targetPriceCents, 5630.833333333333);
  close(
    panel.lines.reduce((total, row) => total + row.totalCents, 0),
    panel.totalCents,
  );
});

test("all failures keep consumed cost but suppress report denominators", () => {
  const a = model({ batchSize: 10, nonreportable: 10, monthlyReports: 100 });
  a.monthly.equipmentCents = 10000;
  a.revenue = { collectedCents: 5000, targetMarginPct: 20 };
  a.additional.otherPerReportCents = 500;
  const result = calculateMolecularCosts(a, rates);
  const panel = result.panels[0];
  assert.equal(result.reportable, 0);
  assert.equal(result.monthlyAllocatedCents, 0);
  assert.ok(panel.totalCents > 0);
  assert.equal(line(panel, "other-report"), 0);
  assert.equal(panel.perReportCents, null);
  assert.equal(panel.targetPriceCents, null);
  assert.equal(panel.revenueCents, 0);
  assert.equal(panel.contributionCents, -panel.totalCents);
  assert.equal(panel.marginPct, null);
  assert.ok(
    result.warnings.some((warning) =>
      warning.includes("No reportable results"),
    ),
  );
});

test("monthly costs remain separately unallocated until report volume is known", () => {
  const a = model({ batchSize: 16 });
  a.monthly.equipmentCents = 100000;
  const missing = calculateMolecularCosts(a, rates);
  assert.equal(missing.monthlyTotalCents, 100000);
  assert.equal(missing.monthlyAllocatedCents, 0);
  assert.equal(missing.unallocatedMonthlyCents, 100000);
  assert.equal(missing.unallocatedMonthly, true);
  assert.ok(
    missing.warnings.some((warning) => warning.includes("not allocated")),
  );
  a.monthlyReports = 500;
  const allocated = calculateMolecularCosts(a, rates);
  assert.equal(allocated.monthlyAllocatedCents, 3200);
  close(allocated.panels[0].totalCents - missing.panels[0].totalCents, 3200);
});

test("blank money remains unknown while explicit zero is known", () => {
  const a = model({ batchSize: 16 });
  a.additional.collectionCents = 0;
  a.material.extractionCents = null;
  a.material.panels.rpp = null;
  const result = calculateMolecularCosts(a, rates);
  assert.ok(result.unpricedFields.includes("material.extractionCents"));
  assert.ok(result.unpricedFields.includes("material.panels.rpp"));
  assert.ok(result.unpricedFields.includes("additional.shippingCents"));
  assert.ok(!result.unpricedFields.includes("additional.collectionCents"));
  assert.equal(line(result.panels[0], "extraction"), 0);
  assert.equal(line(result.panels[0], "reagent"), 0);
  assert.ok(Number.isFinite(result.panels[0].totalCents));
});

test("zero revenue gives negative contribution and no undefined percentage", () => {
  const a = model({ batchSize: 1 });
  a.revenue = { collectedCents: 0, targetMarginPct: 0 };
  const panel = calculateMolecularCosts(a, rates).panels[0];
  assert.equal(panel.revenueCents, 0);
  assert.equal(panel.contributionCents, -panel.totalCents);
  assert.equal(panel.marginPct, null);
  assert.equal(panel.targetPriceCents, panel.perReportCents);
});

test("legacy batch-only state and partial v2 state receive independent defaults", () => {
  const legacy = normalizeMolecularAnalysis({ batchSize: 17 }, rates);
  assert.equal(legacy.version, 3);
  assert.equal(legacy.batchSize, 17);
  assert.equal(legacy.material.extractionCapacity, 16);
  assert.equal(legacy.material.panels.sti, 1200);
  assert.equal(legacy.pcrOnlyRepeats, null);
  const partial = normalizeMolecularAnalysis(
    { version: 2, material: { panels: { rpp: 700 } } },
    rates,
  );
  assert.equal(partial.material.panels.rpp, 700);
  assert.equal(partial.material.panels.sti, 1200);
  assert.equal(partial.batchSize, 60);
  legacy.material.panels.rpp = 1;
  assert.equal(molecularDefaults(rates).material.panels.rpp, 500);
  assert.equal(rates.panels[0].reagentCentsPerSample, 500);
});

test("normalization and calculation do not mutate input or rates", () => {
  const a = model({ batchSize: 17, repeats: 2 });
  const before = JSON.stringify({ a, rates });
  normalizeMolecularAnalysis(a, rates);
  calculateMolecularCosts(a, rates);
  assert.equal(JSON.stringify({ a, rates }), before);
});

test("invalid imports reject without implicit numeric coercion", () => {
  const invalid = [
    null,
    [],
    "60",
    { version: 1 },
    { batchSize: "16" },
    { batchSize: null },
    { batchSize: 0 },
    { batchSize: 961 },
    { batchSize: 1.5 },
    { batchSize: NaN },
    { repeats: -1 },
    { repeats: 10001 },
    { repeats: "2" },
    { pcrOnlyRepeats: 0.5 },
    { nonreportable: 61 },
    { nonreportable: -1 },
    { reagentLossPct: 95.01 },
    { reagentLossPct: Infinity },
    { monthlyReports: 0 },
    { monthlyReports: 1.5 },
    { monthlyReports: 10000001 },
    { selectedPanel: "unknown" },
    { additional: null },
    { labor: [] },
    { monthly: false },
    { material: { extractionCapacity: null } },
    { material: { pcrCapacity: 0 } },
    { material: { pcrCapacity: 961 } },
    { material: { panels: { rpp: "500" } } },
    { material: { panels: { unknown: 100 } } },
    { material: { waterCents: -1 } },
    { material: { tipsCents: 0.1 } },
    { additional: { collectionCents: 100000001 } },
    { labor: { benchBatchMinutes: -0.01 } },
    { labor: { benchPcrRepeatMinutes: 10000.1 } },
    { labor: { benchHourlyCents: "6000" } },
    { revenue: { collectedCents: false } },
    { revenue: { targetMarginPct: 100 } },
    { revenue: { targetMarginPct: -1 } },
    { revenue: { targetMarginPct: "20" } },
    { unrecognizedField: 10 },
  ];
  for (const input of invalid)
    assert.throws(() => normalizeMolecularAnalysis(input, rates), TypeError);
});

test("documented upper boundaries and fractional minutes and percentages are valid", () => {
  const a = model({
    batchSize: 960,
    repeats: 10000,
    pcrOnlyRepeats: 10000,
    nonreportable: 960,
    reagentLossPct: 95,
    monthlyReports: 10000000,
  });
  a.material.extractionCapacity = 1;
  a.material.pcrCapacity = 960;
  a.labor.benchPcrRepeatMinutes = 0.5;
  a.revenue.targetMarginPct = 99.999;
  a.additional.otherPerBatchCents = 100000000;
  const result = calculateMolecularCosts(a, rates);
  for (const panel of result.panels)
    assert.ok(Number.isFinite(panel.totalCents));
  assert.equal(result.attempts, 10960);
  assert.equal(result.pcrAttempts, 20960);
});

const customRow = (id, basis, changes = {}) => ({
  id,
  label: id,
  amountCents: 100,
  quantity: 1,
  basis,
  enabled: true,
  ...changes,
});
const panelById = (result, id) =>
  result.panels.find((panel) => panel.id === id);

test("v2 and legacy data migrate to v3 with independent empty settings for every panel", () => {
  const old = molecularDefaults(rates);
  delete old.panelSettings;
  old.version = 2;
  old.material.panels.uti = 2100;
  old.additional.shippingCents = 125;
  for (const input of [old, { batchSize: 16 }, { version: 3 }]) {
    const result = normalizeMolecularAnalysis(input, rates);
    assert.equal(result.version, 3);
    assert.deepEqual(Object.keys(result.panelSettings), [
      "rpp",
      "sti",
      "uti",
      "wound",
    ]);
    for (const settings of Object.values(result.panelSettings)) {
      assert.deepEqual(settings, {
        overrides: {},
        customCosts: [],
        monthlyReports: null,
      });
    }
    result.panelSettings.rpp.overrides["additional.shippingCents"] = 500;
    assert.deepEqual(result.panelSettings.sti.overrides, {});
  }
  const migrated = normalizeMolecularAnalysis(old, rates);
  assert.equal(migrated.material.panels.uti, 2100);
  assert.equal(migrated.additional.shippingCents, 125);
});

test("panel overrides affect only the selected panel and top-level counts follow that panel", () => {
  const a = model({ batchSize: 16 });
  const baseline = calculateMolecularCosts(a, rates);
  a.panelSettings.rpp.overrides = {
    "material.extractionCents": 100,
    "material.waterCents": 0,
    "material.extractionCapacity": 8,
    "material.pcrCapacity": 4,
    "additional.collectionCents": 50,
    "labor.benchHourlyCents": 6000,
    "labor.benchBatchMinutes": 10,
    reagentLossPct: 50,
    "revenue.collectedCents": 5000,
    "revenue.targetMarginPct": 20,
  };
  const result = calculateMolecularCosts(a, rates);
  for (const id of ["sti", "uti", "wound"]) {
    assert.deepEqual(panelById(result, id), panelById(baseline, id));
  }
  const rpp = panelById(result, "rpp");
  assert.equal(rpp.extractionPlates, 2);
  assert.equal(rpp.pcrPlates, 4);
  assert.equal(line(rpp, "extraction"), 3200);
  assert.equal(line(rpp, "reagent"), 16000);
  assert.equal(line(rpp, "water"), 0);
  assert.equal(line(rpp, "collection"), 800);
  assert.equal(line(rpp, "bench-labor"), 1000);
  assert.equal(rpp.revenueCents, 80000);
  close(rpp.targetPriceCents, rpp.perReportCents / 0.8);
  assert.equal(result.extractionPlates, 2);
  assert.equal(result.pcrPlates, 4);
  a.selectedPanel = "sti";
  const stiSelected = calculateMolecularCosts(a, rates);
  assert.equal(stiSelected.extractionPlates, 1);
  assert.equal(stiSelected.pcrPlates, 1);
  assert.deepEqual(
    stiSelected.unpricedFields,
    panelById(stiSelected, "sti").unpricedFields,
  );
});

test("per-panel reagent fields remain isolated and unavailable as sparse override paths", () => {
  const a = model({ batchSize: 16 });
  const baseline = calculateMolecularCosts(a, rates);
  a.material.panels.rpp = null;
  const changed = calculateMolecularCosts(a, rates);
  assert.ok(
    panelById(changed, "rpp").unpricedFields.includes("material.panels.rpp"),
  );
  assert.deepEqual(panelById(changed, "sti"), panelById(baseline, "sti"));
  assert.ok(
    !panelById(changed, "sti").unpricedFields.includes("material.panels.rpp"),
  );
  a.panelSettings.rpp.overrides["material.panels.rpp"] = 100;
  assert.throws(() => normalizeMolecularAnalysis(a, rates), TypeError);
});

test("missing override inherits, explicit null stays unknown, and explicit zero is known", () => {
  const a = model({ batchSize: 10 });
  a.additional.shippingCents = 200;
  assert.equal(
    molecularEffectiveSettings(a, "rpp", rates).additional.shippingCents,
    200,
  );
  a.panelSettings.rpp.overrides["additional.shippingCents"] = null;
  let result = panelById(calculateMolecularCosts(a, rates), "rpp");
  assert.equal(line(result, "shipping"), 0);
  assert.ok(result.unpricedFields.includes("additional.shippingCents"));
  a.panelSettings.rpp.overrides["additional.shippingCents"] = 0;
  result = panelById(calculateMolecularCosts(a, rates), "rpp");
  assert.equal(line(result, "shipping"), 0);
  assert.ok(!result.unpricedFields.includes("additional.shippingCents"));
  delete a.panelSettings.rpp.overrides["additional.shippingCents"];
  result = panelById(calculateMolecularCosts(a, rates), "rpp");
  assert.equal(line(result, "shipping"), 2000);
});

test("effective settings helper is detached, applies overrides, and does not calculate recursively", () => {
  const a = model({ batchSize: 60 });
  a.panelSettings.uti.overrides = {
    reagentLossPct: 10,
    "labor.benchBatchMinutes": 12.5,
  };
  const original = JSON.stringify(a);
  const effective = molecularEffectiveSettings(a, "uti", rates);
  assert.equal(effective.version, 3);
  assert.equal(effective.selectedPanel, "uti");
  assert.equal(effective.reagentLossPct, 10);
  assert.equal(effective.labor.benchBatchMinutes, 12.5);
  effective.material.panels.uti = 1;
  effective.panelSettings.rpp.customCosts.push(customRow("new", "per_batch"));
  assert.equal(JSON.stringify(a), original);
  assert.throws(
    () => molecularEffectiveSettings(a, "unknown", rates),
    TypeError,
  );
});

test("all eight custom cost bases use the correct panel-specific denominator without double counting", () => {
  const a = model({
    batchSize: 10,
    repeats: 2,
    pcrOnlyRepeats: 3,
    nonreportable: 2,
    monthlyReports: 200,
  });
  a.monthly.equipmentCents = 1000;
  const baseline = calculateMolecularCosts(a, rates);
  const bases = [
    "per_received",
    "per_full_attempt",
    "per_pcr_attempt",
    "per_extraction_plate",
    "per_pcr_plate",
    "per_batch",
    "per_report",
    "monthly",
  ];
  a.panelSettings.rpp.monthlyReports = 100;
  a.panelSettings.rpp.customCosts = bases.map((basis, index) =>
    customRow("cost_" + index, basis, { quantity: 2 }),
  );
  const result = calculateMolecularCosts(a, rates);
  const rpp = panelById(result, "rpp");
  const oldRpp = panelById(baseline, "rpp");
  const expectedCounts = [10, 12, 15, 2, 2, 1, 8, 0.08];
  bases.forEach((basis, index) => {
    const row = rpp.lines.find((item) => item.id === "custom-cost_" + index);
    assert.equal(row.basisCount, expectedCounts[index]);
    assert.equal(row.totalCents, 200 * expectedCounts[index]);
    assert.equal(row.status, "known");
    assert.equal(row.group, basis === "monthly" ? "overhead" : "custom");
  });
  assert.equal(rpp.customCents, 10016);
  assert.equal(rpp.totalCents - oldRpp.totalCents, 10016);
  assert.equal(rpp.directCents - oldRpp.directCents, 10000);
  assert.equal(rpp.overheadCents - oldRpp.overheadCents, 16);
  assert.equal(rpp.monthlyAllocatedCents, 40); // Shared overhead still uses the shared volume of 200.
  assert.equal(rpp.pendingCustomCount, 0);
  close(
    rpp.lines.reduce((total, row) => total + row.totalCents, 0),
    rpp.totalCents,
  );
  assert.deepEqual(panelById(result, "sti"), panelById(baseline, "sti"));
});

test("custom per-plate costs follow this panel’s overridden capacities", () => {
  const a = model({ batchSize: 60, repeats: 1 });
  a.panelSettings.sti.overrides = {
    "material.extractionCapacity": 10,
    "material.pcrCapacity": 20,
  };
  a.panelSettings.sti.customCosts = [
    customRow("ex", "per_extraction_plate", { amountCents: 50 }),
    customRow("pcr", "per_pcr_plate", { amountCents: 25 }),
  ];
  const sti = panelById(calculateMolecularCosts(a, rates), "sti");
  assert.equal(sti.extractionPlates, 7);
  assert.equal(sti.pcrPlates, 4);
  assert.equal(line(sti, "custom-ex"), 350);
  assert.equal(line(sti, "custom-pcr"), 100);
});

test("unknown and unallocated custom costs remain pending while disabled rows never incur costs", () => {
  const a = model({ batchSize: 10 });
  a.panelSettings.rpp.customCosts = [
    customRow("unknown", "per_received", { amountCents: null }),
    customRow("off", "per_batch", { amountCents: null, enabled: false }),
    customRow("monthly", "monthly", { amountCents: 5000, quantity: 2 }),
    customRow("zero", "per_received", { amountCents: 0 }),
  ];
  let rpp = panelById(calculateMolecularCosts(a, rates), "rpp");
  const byId = (id) => rpp.lines.find((row) => row.id === "custom-" + id);
  assert.equal(rpp.pendingCustomCount, 2);
  assert.equal(rpp.customCents, 0);
  assert.equal(rpp.unallocatedCustomMonthlyCents, 10000);
  assert.equal(byId("unknown").status, "pending");
  assert.equal(byId("off").status, "disabled");
  assert.equal(byId("monthly").status, "unallocated");
  assert.equal(byId("zero").status, "known");
  assert.ok(
    rpp.unpricedFields.includes(
      "panelSettings.rpp.customCosts.unknown.amountCents",
    ),
  );
  assert.ok(
    !rpp.unpricedFields.includes(
      "panelSettings.rpp.customCosts.off.amountCents",
    ),
  );
  assert.ok(rpp.unpricedFields.includes("panelSettings.rpp.monthlyReports"));
  a.panelSettings.rpp.monthlyReports = 100;
  rpp = panelById(calculateMolecularCosts(a, rates), "rpp");
  assert.equal(rpp.pendingCustomCount, 1);
  assert.equal(rpp.unallocatedCustomMonthlyCents, 0);
  assert.equal(rpp.customCents, 1000);
});

test("zero-report custom rows are unused rather than pending, even with unknown amounts or volume", () => {
  const a = model({ batchSize: 10, nonreportable: 10 });
  a.panelSettings.rpp.customCosts = [
    customRow("report", "per_report", { amountCents: null }),
    customRow("monthly", "monthly", { amountCents: null }),
    customRow("monthly_known", "monthly", { amountCents: 10000 }),
  ];
  const rpp = panelById(calculateMolecularCosts(a, rates), "rpp");
  assert.equal(rpp.pendingCustomCount, 0);
  assert.equal(rpp.unallocatedCustomMonthlyCents, 0);
  assert.equal(rpp.customCents, 0);
  for (const row of rpp.lines.filter((row) => row.custom)) {
    assert.equal(row.status, "unused");
    assert.equal(row.basisCount, 0);
  }
  assert.ok(
    !rpp.unpricedFields.some((path) => path.startsWith("panelSettings.rpp.")),
  );
});

test("explicit zero monthly custom cost is known without panel volume", () => {
  const a = model({ batchSize: 16 });
  a.panelSettings.rpp.customCosts = [
    customRow("free_monthly", "monthly", { amountCents: 0, quantity: 2 }),
  ];
  const rpp = panelById(calculateMolecularCosts(a, rates), "rpp");
  const row = rpp.lines.find((item) => item.id === "custom-free_monthly");
  assert.equal(row.status, "known");
  assert.equal(row.totalCents, 0);
  assert.equal(rpp.customCents, 0);
  assert.equal(rpp.pendingCustomCount, 0);
  assert.equal(rpp.unallocatedCustomMonthlyCents, 0);
  assert.ok(!rpp.unpricedFields.includes("panelSettings.rpp.monthlyReports"));
  assert.ok(
    !rpp.warnings.some((warning) =>
      warning.includes("Panel monthly custom costs"),
    ),
  );
});

test("panel settings serialize and normalize with stable IDs and trimmed labels", () => {
  const a = model({ batchSize: 17 });
  a.panelSettings.wound = {
    overrides: { "additional.shippingCents": 250, reagentLossPct: null },
    customCosts: [
      customRow("shipping-carrier_1", "per_batch", {
        label: "  Courier surcharge  ",
        quantity: 1.5,
      }),
    ],
    monthlyReports: 200,
  };
  const roundTrip = normalizeMolecularAnalysis(
    JSON.parse(JSON.stringify(a)),
    rates,
  );
  assert.equal(
    roundTrip.panelSettings.wound.customCosts[0].label,
    "Courier surcharge",
  );
  assert.equal(
    roundTrip.panelSettings.wound.customCosts[0].id,
    "shipping-carrier_1",
  );
  assert.equal(roundTrip.panelSettings.wound.customCosts[0].quantity, 1.5);
  assert.equal(
    a.panelSettings.wound.customCosts[0].label,
    "  Courier surcharge  ",
  );
  assert.deepEqual(
    calculateMolecularCosts(roundTrip, rates),
    calculateMolecularCosts(a, rates),
  );
});

test("invalid panel overrides and custom rows are rejected strictly", () => {
  const invalidSettings = [
    null,
    [],
    { unsupported: 1 },
    { overrides: null },
    { overrides: [] },
    { overrides: { batchSize: 1 } },
    { overrides: { monthlyReports: 1 } },
    { overrides: { "monthly.equipmentCents": 500 } },
    { overrides: { "material.panels": { rpp: 1 } } },
    { overrides: { "material.extractionCapacity": null } },
    { overrides: { "material.pcrCapacity": 0 } },
    { overrides: { "additional.shippingCents": "100" } },
    { overrides: { "labor.benchSampleMinutes": -1 } },
    { overrides: { reagentLossPct: 96 } },
    { overrides: { "revenue.targetMarginPct": 100 } },
    { customCosts: null },
    { customCosts: {} },
    { monthlyReports: 0 },
    { monthlyReports: "100" },
    { monthlyReports: 1.5 },
    { monthlyReports: 10000001 },
  ];
  const invalidRows = [
    null,
    [],
    {},
    customRow("", "per_batch"),
    customRow("space id", "per_batch"),
    customRow("x".repeat(81), "per_batch"),
    customRow("same", "per_batch", { label: "" }),
    customRow("same", "per_batch", { label: " ".repeat(4) }),
    customRow("same", "per_batch", { label: "x".repeat(81) }),
    customRow("same", "per_batch", { amountCents: undefined }),
    customRow("same", "per_batch", { amountCents: "100" }),
    customRow("same", "per_batch", { amountCents: 0.5 }),
    customRow("same", "per_batch", { amountCents: -1 }),
    customRow("same", "per_batch", { amountCents: 100000001 }),
    customRow("same", "per_batch", { quantity: 0 }),
    customRow("same", "per_batch", { quantity: -1 }),
    customRow("same", "per_batch", { quantity: "1" }),
    customRow("same", "per_batch", { quantity: Infinity }),
    customRow("same", "per_batch", { quantity: 1000001 }),
    customRow("same", "per_batch", { enabled: "true" }),
    customRow("same", "unsupported"),
    { ...customRow("same", "per_batch"), extra: true },
  ];
  for (const settings of invalidSettings) {
    assert.throws(
      () =>
        normalizeMolecularAnalysis({ panelSettings: { rpp: settings } }, rates),
      TypeError,
    );
  }
  for (const row of invalidRows) {
    assert.throws(
      () =>
        normalizeMolecularAnalysis(
          { panelSettings: { rpp: { customCosts: [row] } } },
          rates,
        ),
      TypeError,
    );
  }
  assert.throws(
    () => normalizeMolecularAnalysis({ panelSettings: { unknown: {} } }, rates),
    TypeError,
  );
  assert.throws(
    () => normalizeMolecularAnalysis({ panelSettings: null }, rates),
    TypeError,
  );
  assert.throws(
    () => normalizeMolecularAnalysis({ version: 4 }, rates),
    TypeError,
  );
  const duplicates = [
    customRow("duplicate", "per_batch"),
    customRow("duplicate", "per_received"),
  ];
  assert.throws(
    () =>
      normalizeMolecularAnalysis(
        { panelSettings: { rpp: { customCosts: duplicates } } },
        rates,
      ),
    TypeError,
  );
  const rows = Array.from({ length: 100 }, (_, index) =>
    customRow("id_" + index, "per_batch"),
  );
  assert.equal(
    normalizeMolecularAnalysis(
      { panelSettings: { rpp: { customCosts: rows } } },
      rates,
    ).panelSettings.rpp.customCosts.length,
    100,
  );
  rows.push(customRow("one_too_many", "per_batch"));
  assert.throws(
    () =>
      normalizeMolecularAnalysis(
        { panelSettings: { rpp: { customCosts: rows } } },
        rates,
      ),
    TypeError,
  );
});
