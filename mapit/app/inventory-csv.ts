/** Inventory CSV contract shared by the import preview and server validation. */
export const inventoryColumns = [
  "item_id", "item_name", "stock_unit", "on_hand", "reorder_threshold", "target_stock",
  "unit_cost_usd", "vendor", "sku", "vendor_url", "location", "lead_time_days",
  "estimated_daily_usage", "checkpoint_links", "notes",
] as const;
export type InventoryColumn = (typeof inventoryColumns)[number];
export type InventoryCsvRow = Record<InventoryColumn, string> & { rowNumber: number };
export type InventoryCsvError = { row: number; message: string };
export type InventoryCsvResult = { rows: InventoryCsvRow[]; errors: InventoryCsvError[]; columns?: InventoryColumn[] };
export const inventoryCsvMaxRows = 250;
export const inventoryCsvMaxBytes = 1024 * 1024;
const requiredColumns: InventoryColumn[] = ["item_name", "stock_unit", "on_hand", "reorder_threshold", "target_stock"];
const quantityColumns: InventoryColumn[] = ["on_hand", "reorder_threshold", "target_stock", "lead_time_days", "estimated_daily_usage"];
const dangerousFormula = /^\s*[=+\-@]/u;
type CsvRecord = { cells: string[]; row: number };

/**
 * Prefix formula-like text and literal leading apostrophes for spreadsheet safety.
 * The parser reverses one such prefix. External CSVs using a leading apostrophe
 * as a spreadsheet text marker are treated the same way, so a literal leading
 * apostrophe before a formula-like value must be doubled to preserve it.
 */
function spreadsheetSafe(value: string): string {
  return value.startsWith("'") || dangerousFormula.test(value) ? `'${value}` : value;
}
function decodeSpreadsheetText(value: string): string {
  if (value.startsWith("'") && (value[1] === "'" || dangerousFormula.test(value.slice(1)))) return value.slice(1);
  return value;
}
function encodeCell(value: string | number | null | undefined): string {
  const text = spreadsheetSafe(value == null ? "" : String(value));
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A UTF-8 BOM helps Excel recognize Unicode; blank cells preserve unknown costs. */
export function buildInventoryCsv(rows: Record<string, string | number | null>[]): string {
  return `\uFEFF${[inventoryColumns.join(","), ...rows.map(row => inventoryColumns.map(column => encodeCell(row[column])).join(","))].join("\r\n")}\r\n`;
}
export const inventoryTemplateCsv = buildInventoryCsv([]);

function readRecords(text: string): { records: CsvRecord[]; errors: InventoryCsvError[] } {
  const records: CsvRecord[] = [];
  let cells: string[] = [], cell = "", row = 1, line = 1;
  let quoted = false, closedQuote = false, started = false;
  const failure = (message: string) => ({ records: [], errors: [{ row, message }] });
  const finishCell = () => { cells.push(cell); cell = ""; closedQuote = false; };
  const finishRecord = () => {
    finishCell(); records.push({ cells, row }); cells = []; started = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closedQuote = true; }
      } else {
        cell += char;
        if (char === "\r") {
          if (text[i + 1] === "\n") { cell += "\n"; i++; }
          line++;
        } else if (char === "\n") line++;
      }
      continue;
    }
    if (char === ",") { finishCell(); started = true; continue; }
    if (char === "\r" || char === "\n") {
      finishRecord();
      if (records.length > inventoryCsvMaxRows + 1) return failure(`Import at most ${inventoryCsvMaxRows} inventory rows at a time.`);
      if (char === "\r" && text[i + 1] === "\n") i++;
      line++; row = line;
      continue;
    }
    if (closedQuote) return failure("A quoted cell must be followed by a comma or a line ending.");
    if (char === '"') {
      if (cell.length) return failure("A quote inside an unquoted cell is invalid. Enclose the complete cell in quotes.");
      quoted = true; started = true;
    } else { cell += char; started = true; }
  }
  if (quoted) return failure("A quoted cell is missing its closing quote.");
  if (started || cells.length || cell.length || closedQuote) finishRecord();
  return { records, errors: [] };
}

/** Parse without persistence; every error includes the record's physical start line. */
export function parseInventoryCsv(input: string): InventoryCsvResult {
  if (new TextEncoder().encode(input).byteLength > inventoryCsvMaxBytes) return { rows: [], errors: [{ row: 1, message: "CSV must be 1 MB or smaller." }] };
  const text = input.replace(/^\uFEFF/, "");
  if (!text.trim()) return { rows: [], errors: [{ row: 1, message: "The CSV is empty. Download the template and add your inventory rows." }] };
  const parsed = readRecords(text);
  if (parsed.errors.length) return { rows: [], errors: parsed.errors };
  const header = parsed.records[0];
  const headers = header.cells.map(value => value.trim().toLowerCase());
  const errors: InventoryCsvError[] = [];
  const used = new Set<string>();
  for (const name of headers) {
    if (used.has(name)) errors.push({ row: header.row, message: `Duplicate column: ${name || "(blank)"}.` });
    else if (!inventoryColumns.includes(name as InventoryColumn)) errors.push({ row: header.row, message: `Unknown column: ${name || "(blank)"}. Use the downloaded template headers.` });
    used.add(name);
  }
  for (const name of requiredColumns) if (!used.has(name)) errors.push({ row: header.row, message: `Required column is missing: ${name}.` });
  if (errors.length) return { rows: [], errors };
  const records = parsed.records.slice(1);
  if (!records.length) return { rows: [], errors: [{ row: 2, message: "The template contains no inventory rows. Add at least one item below the headers." }] };
  if (records.length > inventoryCsvMaxRows) return { rows: [], errors: [{ row: records[inventoryCsvMaxRows].row, message: `Import at most ${inventoryCsvMaxRows} inventory rows at a time.` }] };
  const rows: InventoryCsvRow[] = [];
  for (const record of records) {
    if (record.cells.every(value => !value.trim())) { errors.push({ row: record.row, message: "Empty inventory row. Remove the blank row before importing." }); continue; }
    if (record.cells.length !== headers.length) { errors.push({ row: record.row, message: `Expected ${headers.length} cells but found ${record.cells.length}. Quote any value containing a comma.` }); continue; }
    const data = Object.fromEntries(inventoryColumns.map(name => [name, ""])) as Record<InventoryColumn, string>;
    headers.forEach((name, index) => { data[name as InventoryColumn] = decodeSpreadsheetText(record.cells[index]); });
    for (const name of requiredColumns) if (!data[name].trim()) errors.push({ row: record.row, message: `${name} is required.` });
    for (const name of [...quantityColumns, "unit_cost_usd" as const]) {
      const value = data[name].trim();
      data[name] = value;
      if (!value) continue;
      const decimals = name === "unit_cost_usd" ? 2 : 3;
      const pattern = new RegExp(`^(?:\\d+(?:\\.\\d{0,${decimals}})?|\\.\\d{1,${decimals}})$`);
      if (!pattern.test(value) || !Number.isFinite(Number(value))) errors.push({ row: record.row, message: `${name} must be a nonnegative decimal with at most ${decimals} decimal places (no currency symbols, thousands separators, or formulas).` });
    }
    const threshold = data.reorder_threshold, target = data.target_stock;
    if (threshold && target && Number.isFinite(Number(threshold)) && Number.isFinite(Number(target)) && Number(target) <= Number(threshold)) errors.push({ row: record.row, message: "target_stock must be greater than reorder_threshold." });
    rows.push({ ...data, rowNumber: record.row });
  }
  return { rows, errors, columns: headers as InventoryColumn[] };
}
