import { dayRange } from "./dates";

export function historyDateRange(from = "", to = "") {
  const first = from ? dayRange(from) : null;
  const last = to ? dayRange(to) : null;
  if ((from && !first) || (to && !last) || (first && last && first.start >= last.end)) {
    throw new Error("Choose valid dates, with the end date on or after the start date.");
  }
  return { ...(first ? { gte: first.start } : {}), ...(last ? { lt: last.end } : {}) };
}

// Quote every cell and neutralize spreadsheet formula injection in user input.
export function csvRow(values: readonly unknown[]) {
  return values.map((value) => {
    let cell = value instanceof Date ? value.toISOString() : value == null ? "" : String(value);
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(cell) || /^[\t\r\n]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  }).join(",") + "\r\n";
}
