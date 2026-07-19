// Shared spreadsheet-export helpers used across the app so CSV/XLSX generation
// stays consistent (UTF-8 BOM, escaped cells, frozen+styled headers, column
// widths) and doesn't get copy-pasted page by page.

// Wrap a single CSV cell: escape embedded quotes and always quote so commas,
// newlines and leading separators in values can't break the columns.
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// Trigger a browser download for a generated blob.
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// A labelled block of tabular data — used for multi-sheet .xlsx exports and
// for clearly-sectioned single-file CSV exports.
export interface SheetSection {
  title: string;
  headers: string[];
  rows: string[][];
  columnWidths?: number[];
}

// Build a CSV from headers + rows and download it. Prepends a UTF-8 BOM so
// Excel renders accented/non-ASCII characters correctly.
export function downloadCsv(
  headers: string[],
  rows: string[][],
  filename: string,
): void {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

// Build a true .xlsx with a formatted, frozen header row and proper column
// widths so it opens cleanly without an import step, then download it. The
// widest column is wrapped for readability (typically the free-text column).
export async function downloadXlsx(
  sheetName: string,
  headers: string[],
  rows: string[][],
  filename: string,
  columnWidths?: number[],
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = headers.map((h, i) => ({
    header: h,
    width: columnWidths?.[i] ?? 20,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF002147" },
  };
  headerRow.alignment = { vertical: "middle" };

  for (const row of rows) {
    sheet.addRow(row);
  }

  // Wrap the widest column (typically a long free-text column) for readability.
  if (columnWidths && columnWidths.length > 0) {
    let widest = 0;
    for (let i = 1; i < columnWidths.length; i++) {
      if ((columnWidths[i] ?? 0) > (columnWidths[widest] ?? 0)) widest = i;
    }
    sheet.getColumn(widest + 1).alignment = { wrapText: true, vertical: "top" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}

// Build a single CSV file with several clearly-labelled sections, each as its
// own header + rows block separated by a blank line so the file stays readable
// in a spreadsheet. Prepends a UTF-8 BOM like downloadCsv.
export function downloadCsvSections(
  sections: SheetSection[],
  filename: string,
): void {
  const blocks = sections.map((s) => {
    const lines = [csvCell(s.title)];
    lines.push(s.headers.map(csvCell).join(","));
    for (const row of s.rows) lines.push(row.map(csvCell).join(","));
    return lines.join("\r\n");
  });
  const csv = "\uFEFF" + blocks.join("\r\n\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

// Build a true .xlsx with one formatted worksheet per section (frozen+styled
// header row, column widths, widest column wrapped) and download it. Sheet
// names are truncated to Excel's 31-char limit.
export async function downloadXlsxSheets(
  sections: SheetSection[],
  filename: string,
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  for (const s of sections) {
    const sheet = workbook.addWorksheet(s.title.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = s.headers.map((h, i) => ({
      header: h,
      width: s.columnWidths?.[i] ?? 20,
    }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF002147" },
    };
    headerRow.alignment = { vertical: "middle" };

    for (const row of s.rows) {
      sheet.addRow(row);
    }

    // Wrap the widest column (typically a long free-text column) for readability.
    if (s.columnWidths && s.columnWidths.length > 0) {
      let widest = 0;
      for (let i = 1; i < s.columnWidths.length; i++) {
        if ((s.columnWidths[i] ?? 0) > (s.columnWidths[widest] ?? 0)) widest = i;
      }
      sheet.getColumn(widest + 1).alignment = { wrapText: true, vertical: "top" };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}
