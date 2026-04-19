// Pure client-side CSV serializer. Takes an array of row objects + a column
// map, returns a Blob, triggers a download. No external deps.
//
// RFC 4180 quoting: any field containing a comma, double-quote, CR, or LF
// gets wrapped in double quotes with embedded quotes doubled.

export type CsvColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
};

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCell(c.accessor(row))).join(","),
  );
  return [header, ...lines].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function exportRowsAsCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string,
): void {
  downloadCsv(filename, rowsToCsv(rows, columns));
}

export function todayStamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
