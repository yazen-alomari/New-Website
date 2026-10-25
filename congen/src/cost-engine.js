/* Pure molecular cost model. Money remains in cents until the UI formats it. */

const MAX_CENTS = 100000000;
const additionalKeys = [
  "collectionCents",
  "shippingCents",
  "ppeWasteCents",
  "extractionQcPerPlateCents",
  "pcrQcPerPlateCents",
  "pcrRepeatConsumablesCents",
  "otherPerBatchCents",
  "otherPerReportCents",
];
const laborMoneyKeys = ["benchHourlyCents", "reviewHourlyCents"];
const laborMinuteKeys = [
  "benchBatchMinutes",
  "benchSampleMinutes",
  "benchExtractionPlateMinutes",
  "benchPcrPlateMinutes",
  "benchPcrRepeatMinutes",
  "reviewMinutesPerReport",
];
const monthlyKeys = [
  "equipmentCents",
  "maintenanceCents",
  "facilityCents",
  "softwareCents",
  "qualityCents",
  "adminCents",
];
const materialMoneyKeys = [
  "extractionCents",
  "waterCents",
  "tipsCents",
  "deepwellPlateCents",
  "pcrPlateCents",
];
const customBases = [
  "per_received",
  "per_full_attempt",
  "per_pcr_attempt",
  "per_extraction_plate",
  "per_pcr_plate",
  "per_batch",
  "per_report",
  "monthly",
];
const overridePaths = [
  ...materialMoneyKeys.map((key) => "material." + key),
  "material.extractionCapacity",
  "material.pcrCapacity",
  ...additionalKeys.map((key) => "additional." + key),
  ...[...laborMoneyKeys, ...laborMinuteKeys].map((key) => "labor." + key),
  "reagentLossPct",
  "revenue.collectedCents",
  "revenue.targetMarginPct",
];
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const nilObject = (keys) => Object.fromEntries(keys.map((key) => [key, null]));
const zero = (value) => (value === null ? 0 : value);
const sum = (values) => values.reduce((total, value) => total + value, 0);

function record(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(path + " must be an object.");
  }
  return value;
}

function number(
  value,
  path,
  minimum,
  maximum,
  integer,
  nullable = false,
  exclusiveMaximum = false,
) {
  if (nullable && value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (integer && !Number.isSafeInteger(value)) ||
    value < minimum ||
    (exclusiveMaximum ? value >= maximum : value > maximum)
  ) {
    throw new TypeError(
      path +
        " must be " +
        (integer ? "a whole number" : "a finite number") +
        " from " +
        minimum +
        (exclusiveMaximum ? " to less than " : " to ") +
        maximum +
        ".",
    );
  }
  return value;
}

function knownKeys(object, keys, path) {
  const unexpected = Object.keys(object).find((key) => !keys.includes(key));
  if (unexpected !== undefined)
    throw new TypeError(path + "." + unexpected + " is not supported.");
}

function validateRates(rates) {
  record(rates, "rates");
  number(rates.maximumBatchSize, "rates.maximumBatchSize", 1, 10000000, true);
  number(
    rates.defaultBatchSize,
    "rates.defaultBatchSize",
    1,
    rates.maximumBatchSize,
    true,
  );
  for (const key of [
    "extractionCentsPerSample",
    "waterCentsPerSample",
    "tipsCentsPerSample",
  ]) {
    number(rates[key], "rates." + key, 0, MAX_CENTS, true);
  }
  for (const key of ["extractionPlate", "pcrPlate"]) {
    record(rates[key], "rates." + key);
    number(
      rates[key].costCents,
      "rates." + key + ".costCents",
      0,
      MAX_CENTS,
      true,
    );
    number(
      rates[key].samplesPerPlate,
      "rates." + key + ".samplesPerPlate",
      1,
      960,
      true,
    );
  }
  if (!Array.isArray(rates.panels) || rates.panels.length === 0) {
    throw new TypeError("rates.panels must contain at least one panel.");
  }
  const ids = new Set();
  for (const panel of rates.panels) {
    record(panel, "rates.panels entry");
    if (
      typeof panel.id !== "string" ||
      !panel.id ||
      ids.has(panel.id) ||
      typeof panel.name !== "string" ||
      !panel.name
    ) {
      throw new TypeError("Each rate panel must have a unique ID and a name.");
    }
    ids.add(panel.id);
    number(
      panel.reagentCentsPerSample,
      "rates.panels." + panel.id + ".reagentCentsPerSample",
      0,
      MAX_CENTS,
      true,
    );
  }
  return rates;
}

function molecularDefaults(rates) {
  validateRates(rates);
  return {
    version: 3,
    batchSize: rates.defaultBatchSize,
    selectedPanel: rates.panels.some((panel) => panel.id === "rpp")
      ? "rpp"
      : rates.panels[0].id,
    repeats: null,
    pcrOnlyRepeats: null,
    nonreportable: null,
    reagentLossPct: null,
    monthlyReports: null,
    material: {
      extractionCents: rates.extractionCentsPerSample,
      waterCents: rates.waterCentsPerSample,
      tipsCents: rates.tipsCentsPerSample,
      deepwellPlateCents: rates.extractionPlate.costCents,
      extractionCapacity: rates.extractionPlate.samplesPerPlate,
      pcrPlateCents: rates.pcrPlate.costCents,
      pcrCapacity: rates.pcrPlate.samplesPerPlate,
      panels: Object.fromEntries(
        rates.panels.map((panel) => [panel.id, panel.reagentCentsPerSample]),
      ),
    },
    additional: nilObject(additionalKeys),
    labor: nilObject([...laborMoneyKeys, ...laborMinuteKeys]),
    monthly: nilObject(monthlyKeys),
    revenue: { collectedCents: null, targetMarginPct: null },
    panelSettings: Object.fromEntries(
      rates.panels.map((panel) => [
        panel.id,
        {
          overrides: {},
          customCosts: [],
          monthlyReports: null,
        },
      ]),
    ),
  };
}

function normalizeMolecularAnalysis(input, rates) {
  const defaults = molecularDefaults(rates);
  record(input, "analysis");
  knownKeys(input, Object.keys(defaults), "analysis");
  if (has(input, "version") && ![2, 3].includes(input.version)) {
    throw new TypeError("analysis.version must be 2 or 3.");
  }
  const output = { ...defaults, ...input, version: 3 };
  const groupNames = ["material", "additional", "labor", "monthly", "revenue"];
  for (const group of groupNames) {
    if (has(input, group)) {
      record(input[group], "analysis." + group);
      knownKeys(
        input[group],
        Object.keys(defaults[group]),
        "analysis." + group,
      );
    }
    output[group] = { ...defaults[group], ...(input[group] || {}) };
  }
  const panelDefaults = defaults.material.panels;
  if (has(output.material, "panels")) {
    record(output.material.panels, "analysis.material.panels");
    knownKeys(
      output.material.panels,
      Object.keys(panelDefaults),
      "analysis.material.panels",
    );
  }
  output.material.panels = { ...panelDefaults, ...output.material.panels };
  number(
    output.batchSize,
    "analysis.batchSize",
    1,
    rates.maximumBatchSize,
    true,
  );
  if (!rates.panels.some((panel) => panel.id === output.selectedPanel)) {
    throw new TypeError("analysis.selectedPanel must be a listed panel ID.");
  }
  for (const key of ["repeats", "pcrOnlyRepeats"]) {
    number(output[key], "analysis." + key, 0, 10000, true, true);
  }
  number(
    output.nonreportable,
    "analysis.nonreportable",
    0,
    output.batchSize,
    true,
    true,
  );
  number(output.reagentLossPct, "analysis.reagentLossPct", 0, 95, false, true);
  number(
    output.monthlyReports,
    "analysis.monthlyReports",
    1,
    10000000,
    true,
    true,
  );
  for (const key of materialMoneyKeys) {
    number(
      output.material[key],
      "analysis.material." + key,
      0,
      MAX_CENTS,
      true,
      true,
    );
  }
  for (const key of ["extractionCapacity", "pcrCapacity"]) {
    number(output.material[key], "analysis.material." + key, 1, 960, true);
  }
  for (const id of Object.keys(panelDefaults)) {
    number(
      output.material.panels[id],
      "analysis.material.panels." + id,
      0,
      MAX_CENTS,
      true,
      true,
    );
  }
  for (const [group, keys] of [
    ["additional", additionalKeys],
    ["labor", laborMoneyKeys],
    ["monthly", monthlyKeys],
  ]) {
    for (const key of keys)
      number(
        output[group][key],
        "analysis." + group + "." + key,
        0,
        MAX_CENTS,
        true,
        true,
      );
  }
  for (const key of laborMinuteKeys) {
    number(output.labor[key], "analysis.labor." + key, 0, 10000, false, true);
  }
  number(
    output.revenue.collectedCents,
    "analysis.revenue.collectedCents",
    0,
    MAX_CENTS,
    true,
    true,
  );
  number(
    output.revenue.targetMarginPct,
    "analysis.revenue.targetMarginPct",
    0,
    100,
    false,
    true,
    true,
  );
  if (has(input, "panelSettings")) {
    record(input.panelSettings, "analysis.panelSettings");
    knownKeys(
      input.panelSettings,
      rates.panels.map((panel) => panel.id),
      "analysis.panelSettings",
    );
  }
  output.panelSettings = Object.fromEntries(
    rates.panels.map((panel) => {
      const path = "analysis.panelSettings." + panel.id;
      const source =
        input.panelSettings && has(input.panelSettings, panel.id)
          ? record(input.panelSettings[panel.id], path)
          : {};
      knownKeys(source, ["overrides", "customCosts", "monthlyReports"], path);
      const overrides = has(source, "overrides")
        ? record(source.overrides, path + ".overrides")
        : {};
      knownKeys(overrides, overridePaths, path + ".overrides");
      for (const [key, value] of Object.entries(overrides)) {
        validateOverride(value, key, path + ".overrides." + key);
      }
      const monthlyReports = has(source, "monthlyReports")
        ? source.monthlyReports
        : null;
      number(monthlyReports, path + ".monthlyReports", 1, 10000000, true, true);
      const sourceRows = has(source, "customCosts") ? source.customCosts : [];
      if (!Array.isArray(sourceRows) || sourceRows.length > 100) {
        throw new TypeError(
          path + ".customCosts must be an array with at most 100 costs.",
        );
      }
      const rowIds = new Set();
      const customCosts = sourceRows.map((row, index) => {
        const rowPath = path + ".customCosts[" + index + "]";
        record(row, rowPath);
        knownKeys(
          row,
          ["id", "label", "amountCents", "quantity", "basis", "enabled"],
          rowPath,
        );
        if (
          typeof row.id !== "string" ||
          !/^[A-Za-z0-9_-]{1,80}$/.test(row.id) ||
          rowIds.has(row.id)
        ) {
          throw new TypeError(
            rowPath +
              ".id must be a unique 1–80 character ID using letters, numbers, underscores or hyphens.",
          );
        }
        rowIds.add(row.id);
        if (
          typeof row.label !== "string" ||
          !row.label.trim() ||
          row.label.trim().length > 80
        ) {
          throw new TypeError(rowPath + ".label must contain 1–80 characters.");
        }
        number(
          row.amountCents,
          rowPath + ".amountCents",
          0,
          MAX_CENTS,
          true,
          true,
        );
        number(
          row.quantity,
          rowPath + ".quantity",
          Number.MIN_VALUE,
          1000000,
          false,
        );
        if (!customBases.includes(row.basis))
          throw new TypeError(rowPath + ".basis is not supported.");
        if (typeof row.enabled !== "boolean")
          throw new TypeError(rowPath + ".enabled must be true or false.");
        return {
          id: row.id,
          label: row.label.trim(),
          amountCents: row.amountCents,
          quantity: row.quantity,
          basis: row.basis,
          enabled: row.enabled,
        };
      });
      return [
        panel.id,
        { overrides: { ...overrides }, customCosts, monthlyReports },
      ];
    }),
  );
  return output;
}

function validateOverride(value, key, path) {
  if (key === "material.extractionCapacity" || key === "material.pcrCapacity") {
    return number(value, path, 1, 960, true);
  }
  if (key === "reagentLossPct") return number(value, path, 0, 95, false, true);
  if (key === "revenue.targetMarginPct")
    return number(value, path, 0, 100, false, true, true);
  if (key.startsWith("labor.") && laborMinuteKeys.includes(key.slice(6))) {
    return number(value, path, 0, 10000, false, true);
  }
  return number(value, path, 0, MAX_CENTS, true, true);
}

function applyPanelOverrides(analysis, panelId) {
  if (!has(analysis.panelSettings, panelId))
    throw new TypeError("Choose a listed panel ID.");
  const effective = {
    ...analysis,
    selectedPanel: panelId,
    material: { ...analysis.material, panels: { ...analysis.material.panels } },
    additional: { ...analysis.additional },
    labor: { ...analysis.labor },
    monthly: { ...analysis.monthly },
    revenue: { ...analysis.revenue },
  };
  for (const [path, value] of Object.entries(
    analysis.panelSettings[panelId].overrides,
  )) {
    const [group, field] = path.split(".");
    if (field === undefined) effective[group] = value;
    else effective[group][field] = value;
  }
  return effective;
}

function molecularEffectiveSettings(input, panelId, rates) {
  return applyPanelOverrides(normalizeMolecularAnalysis(input, rates), panelId);
}

function calculateMolecularCosts(input, rates) {
  const analysis = normalizeMolecularAnalysis(input, rates);
  const batchSize = analysis.batchSize;
  const fullRepeats = zero(analysis.repeats);
  const pcrOnlyRepeats = zero(analysis.pcrOnlyRepeats);
  const attempts = batchSize + fullRepeats;
  const pcrAttempts = attempts + pcrOnlyRepeats;
  const reportable = batchSize - zero(analysis.nonreportable);
  const repeatRuns = fullRepeats + pcrOnlyRepeats > 0 ? 1 : 0;
  const monthlyTotalCents = sum(
    monthlyKeys.map((key) => zero(analysis.monthly[key])),
  );
  const monthlyAllocatedCents =
    analysis.monthlyReports === null
      ? 0
      : (monthlyTotalCents / analysis.monthlyReports) * reportable;
  const unallocatedMonthlyCents =
    analysis.monthlyReports === null ? monthlyTotalCents : 0;

  const panels = rates.panels.map((panel) => {
    const effective = applyPanelOverrides(analysis, panel.id);
    const material = effective.material;
    const additional = effective.additional;
    const labor = effective.labor;
    const settings = analysis.panelSettings[panel.id];
    // Original and consolidated repeat runs always use separate plates.
    const extractionPlates =
      Math.ceil(batchSize / material.extractionCapacity) +
      (fullRepeats > 0
        ? Math.ceil(fullRepeats / material.extractionCapacity)
        : 0);
    const repeatPcrAttempts = fullRepeats + pcrOnlyRepeats;
    const pcrPlates =
      Math.ceil(batchSize / material.pcrCapacity) +
      (repeatPcrAttempts > 0
        ? Math.ceil(repeatPcrAttempts / material.pcrCapacity)
        : 0);
    const reagentYield = 1 - zero(effective.reagentLossPct) / 100;
    const unpricedFields = [];
    const missing = (path) => {
      if (!unpricedFields.includes(path)) unpricedFields.push(path);
    };
    // Do not pull unknown settings from a different panel into this result.
    for (const key of [
      "repeats",
      "pcrOnlyRepeats",
      "nonreportable",
      "reagentLossPct",
      "monthlyReports",
    ]) {
      if (effective[key] === null) missing(key);
    }
    for (const key of materialMoneyKeys)
      if (material[key] === null) missing("material." + key);
    if (material.panels[panel.id] === null)
      missing("material.panels." + panel.id);
    for (const [group, keys] of [
      ["additional", additionalKeys],
      ["labor", [...laborMoneyKeys, ...laborMinuteKeys]],
      ["monthly", monthlyKeys],
      ["revenue", ["collectedCents", "targetMarginPct"]],
    ]) {
      for (const key of keys)
        if (effective[group][key] === null) missing(group + "." + key);
    }
    const lines = [];
    const add = (id, label, group, totalCents, basisCount, unknown = false) => {
      lines.push({
        id,
        label,
        group,
        totalCents,
        basisCount,
        status: basisCount === 0 ? "unused" : unknown ? "pending" : "known",
      });
    };
    add(
      "extraction",
      "Extraction reagents",
      "material",
      (attempts * zero(material.extractionCents)) / reagentYield,
      attempts,
      material.extractionCents === null || effective.reagentLossPct === null,
    );
    add(
      "reagent",
      panel.name + " panel reagents",
      "material",
      (pcrAttempts * zero(material.panels[panel.id])) / reagentYield,
      pcrAttempts,
      material.panels[panel.id] === null || effective.reagentLossPct === null,
    );
    add(
      "water",
      "Water and base consumables",
      "material",
      attempts * zero(material.waterCents),
      attempts,
      material.waterCents === null,
    );
    add(
      "tips",
      "Base pipette tips",
      "material",
      attempts * zero(material.tipsCents),
      attempts,
      material.tipsCents === null,
    );
    add(
      "extraction-plates",
      "Deep-well extraction plates",
      "material",
      extractionPlates * zero(material.deepwellPlateCents),
      extractionPlates,
      material.deepwellPlateCents === null,
    );
    add(
      "pcr-plates",
      "PCR plates",
      "material",
      pcrPlates * zero(material.pcrPlateCents),
      pcrPlates,
      material.pcrPlateCents === null,
    );
    add(
      "collection",
      "Collection materials",
      "additional",
      batchSize * zero(additional.collectionCents),
      batchSize,
      additional.collectionCents === null,
    );
    add(
      "shipping",
      "Shipping and transport",
      "additional",
      batchSize * zero(additional.shippingCents),
      batchSize,
      additional.shippingCents === null,
    );
    add(
      "ppe-waste",
      "PPE and waste",
      "additional",
      attempts * zero(additional.ppeWasteCents),
      attempts,
      additional.ppeWasteCents === null,
    );
    add(
      "extraction-qc",
      "Extraction QC per plate",
      "additional",
      extractionPlates * zero(additional.extractionQcPerPlateCents),
      extractionPlates,
      additional.extractionQcPerPlateCents === null,
    );
    add(
      "pcr-qc",
      "PCR QC per plate",
      "additional",
      pcrPlates * zero(additional.pcrQcPerPlateCents),
      pcrPlates,
      additional.pcrQcPerPlateCents === null,
    );
    add(
      "pcr-repeat-consumables",
      "PCR-only repeat consumables",
      "additional",
      pcrOnlyRepeats * zero(additional.pcrRepeatConsumablesCents),
      pcrOnlyRepeats,
      additional.pcrRepeatConsumablesCents === null,
    );
    add(
      "other-batch",
      "Other batch cost",
      "additional",
      zero(additional.otherPerBatchCents),
      1,
      additional.otherPerBatchCents === null,
    );
    add(
      "other-report",
      "Other cost per report",
      "additional",
      reportable * zero(additional.otherPerReportCents),
      reportable,
      additional.otherPerReportCents === null,
    );
    const benchMinutes =
      (1 + repeatRuns) * zero(labor.benchBatchMinutes) +
      attempts * zero(labor.benchSampleMinutes) +
      extractionPlates * zero(labor.benchExtractionPlateMinutes) +
      pcrPlates * zero(labor.benchPcrPlateMinutes) +
      pcrOnlyRepeats * zero(labor.benchPcrRepeatMinutes);
    const benchLaborCents = (benchMinutes * zero(labor.benchHourlyCents)) / 60;
    const reviewLaborCents =
      (reportable *
        zero(labor.reviewMinutesPerReport) *
        zero(labor.reviewHourlyCents)) /
      60;
    add(
      "bench-labor",
      "Bench labor",
      "labor",
      benchLaborCents,
      1,
      [
        "benchHourlyCents",
        "benchBatchMinutes",
        "benchSampleMinutes",
        "benchExtractionPlateMinutes",
        "benchPcrPlateMinutes",
      ].some((key) => labor[key] === null) ||
        (pcrOnlyRepeats > 0 && labor.benchPcrRepeatMinutes === null),
    );
    add(
      "review-labor",
      "Report review labor",
      "labor",
      reviewLaborCents,
      reportable,
      labor.reviewMinutesPerReport === null || labor.reviewHourlyCents === null,
    );
    add(
      "monthly-overhead",
      "Allocated shared monthly costs",
      "overhead",
      monthlyAllocatedCents,
      analysis.monthlyReports === null
        ? reportable > 0
          ? null
          : 0
        : reportable / analysis.monthlyReports,
      analysis.monthlyReports === null ||
        monthlyKeys.some((key) => analysis.monthly[key] === null),
    );
    if (reportable > 0 && unallocatedMonthlyCents > 0)
      lines[lines.length - 1].status = "unallocated";

    let pendingCustomCount = 0;
    let unallocatedCustomMonthlyCents = 0;
    const basisCounts = {
      per_received: batchSize,
      per_full_attempt: attempts,
      per_pcr_attempt: pcrAttempts,
      per_extraction_plate: extractionPlates,
      per_pcr_plate: pcrPlates,
      per_batch: 1,
      per_report: reportable,
    };
    for (const row of settings.customCosts) {
      const monthly = row.basis === "monthly";
      const basisCount = monthly
        ? reportable === 0
          ? 0
          : settings.monthlyReports === null
            ? null
            : reportable / settings.monthlyReports
        : basisCounts[row.basis];
      let status = "known";
      let totalCents = 0;
      if (!row.enabled) status = "disabled";
      else if (basisCount === 0) status = "unused";
      // A known zero charge needs no volume denominator to establish its cost.
      else if (row.amountCents === 0) status = "known";
      else if (row.amountCents === null) {
        status = "pending";
        pendingCustomCount++;
        missing(
          "panelSettings." +
            panel.id +
            ".customCosts." +
            row.id +
            ".amountCents",
        );
        if (monthly && settings.monthlyReports === null)
          missing("panelSettings." + panel.id + ".monthlyReports");
      } else if (basisCount === null) {
        status = "unallocated";
        pendingCustomCount++;
        unallocatedCustomMonthlyCents += row.amountCents * row.quantity;
        missing("panelSettings." + panel.id + ".monthlyReports");
      } else {
        totalCents = row.amountCents * row.quantity * basisCount;
      }
      lines.push({
        id: "custom-" + row.id,
        label: row.label,
        group: monthly ? "overhead" : "custom",
        totalCents,
        basisCount,
        status,
        custom: true,
        basis: row.basis,
        quantity: row.quantity,
      });
    }
    const groupTotal = (group) =>
      sum(
        lines
          .filter((item) => item.group === group)
          .map((item) => item.totalCents),
      );
    const materialCents = groupTotal("material");
    const customCents = sum(
      lines.filter((item) => item.custom).map((item) => item.totalCents),
    );
    const directCents =
      materialCents + groupTotal("additional") + groupTotal("custom");
    const laborCents = groupTotal("labor");
    const overheadCents = groupTotal("overhead");
    const totalCents = directCents + laborCents + overheadCents;
    const perReportCents = reportable === 0 ? null : totalCents / reportable;
    const revenueCents =
      effective.revenue.collectedCents === null
        ? null
        : reportable * effective.revenue.collectedCents;
    const contributionCents =
      revenueCents === null ? null : revenueCents - totalCents;
    const marginPct =
      revenueCents !== null && revenueCents > 0
        ? (contributionCents / revenueCents) * 100
        : null;
    const targetPriceCents =
      perReportCents === null || effective.revenue.targetMarginPct === null
        ? null
        : perReportCents / (1 - effective.revenue.targetMarginPct / 100);
    const warnings = [];
    if (unpricedFields.length > 0) {
      warnings.push(
        "Blank inputs remain unknown. Missing cost inputs contribute $0 to the displayed subtotal; this does not establish a complete cost.",
      );
    }
    if (
      effective.repeats === null ||
      effective.pcrOnlyRepeats === null ||
      effective.nonreportable === null ||
      effective.reagentLossPct === null
    ) {
      warnings.push(
        "Blank repeat, nonreportable, and reagent-loss assumptions are calculated as 0.",
      );
    }
    if (repeatRuns)
      warnings.push(
        "All repeat attempts are consolidated into one additional run with separate plates. More repeat runs may cost more.",
      );
    if (unallocatedMonthlyCents > 0)
      warnings.push(
        "Shared monthly costs are entered but not allocated because shared monthly report volume is blank.",
      );
    if (pendingCustomCount > 0)
      warnings.push(
        pendingCustomCount +
          " custom cost" +
          (pendingCustomCount === 1 ? " is" : "s are") +
          " pending and excluded from the known subtotal.",
      );
    if (
      settings.customCosts.some(
        (row) =>
          row.enabled && row.basis === "monthly" && row.amountCents !== 0,
      ) &&
      reportable > 0 &&
      settings.monthlyReports === null
    ) {
      warnings.push(
        "Panel monthly custom costs are excluded until this panel's monthly report volume is entered.",
      );
    }
    if (reportable === 0)
      warnings.push(
        "No reportable results remain. Cost per report and target price cannot be calculated.",
      );
    return {
      id: panel.id,
      name: panel.name,
      lines,
      materialCents,
      directCents,
      laborCents,
      overheadCents,
      customCents,
      totalCents,
      perReceivedCents: totalCents / batchSize,
      perReportCents,
      revenueCents,
      contributionCents,
      marginPct,
      targetPriceCents,
      batchSize,
      attempts,
      pcrAttempts,
      reportable,
      repeatRuns,
      extractionPlates,
      pcrPlates,
      extractionUtilization:
        attempts / (extractionPlates * material.extractionCapacity),
      pcrUtilization: pcrAttempts / (pcrPlates * material.pcrCapacity),
      monthlyTotalCents,
      monthlyAllocatedCents,
      unallocatedMonthlyCents,
      unallocatedMonthly: unallocatedMonthlyCents > 0,
      pendingCustomCount,
      unallocatedCustomMonthlyCents,
      unpricedFields,
      warnings,
    };
  });
  const selected = panels.find((panel) => panel.id === analysis.selectedPanel);
  return {
    batchSize,
    attempts,
    pcrAttempts,
    reportable,
    repeatRuns,
    extractionPlates: selected.extractionPlates,
    pcrPlates: selected.pcrPlates,
    extractionUtilization: selected.extractionUtilization,
    pcrUtilization: selected.pcrUtilization,
    monthlyTotalCents,
    monthlyAllocatedCents,
    unallocatedMonthlyCents,
    unallocatedMonthly: unallocatedMonthlyCents > 0,
    unpricedFields: selected.unpricedFields,
    warnings: selected.warnings,
    panels,
  };
}

export {
  molecularDefaults,
  normalizeMolecularAnalysis,
  molecularEffectiveSettings,
  calculateMolecularCosts,
};
