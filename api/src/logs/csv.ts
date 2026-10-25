/**
 * CSV cell encoding (WEB-FR-025, WEB-NFR-022).
 *
 * Formula injection: a spreadsheet treats a cell that starts with `=`, `+`,
 * `-`, `@`, a tab or a carriage return as a formula. Such a cell is prefixed
 * with a single quote so it is shown as text. The cell is then quoted
 * (RFC 4180) when it holds a comma, quote, CR or LF.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(',') + '\r\n';
}

/** UTF-8 byte order mark so Excel reads Arabic text correctly. */
export const CSV_BOM = '﻿';
