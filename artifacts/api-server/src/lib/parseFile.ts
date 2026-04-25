import Papa from "papaparse";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type ParsedFile = {
  fileType: string;
  rawText: string;
  tabular: string[][] | null;
  warnings: string[];
};

const MAX_PDF_PAGES = 10;
const MAX_TEXT_LENGTH = 60_000;

function clip(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH);
}

function tabularToText(rows: string[][]): string {
  return rows
    .slice(0, 200)
    .map((row) => row.map((cell) => String(cell ?? "").trim()).join("\t"))
    .join("\n");
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfParse = require("pdf-parse") as (
    data: Buffer,
    options?: { max?: number },
  ) => Promise<{ text: string }>;
  const result = await pdfParse(buffer, { max: MAX_PDF_PAGES });
  return result.text ?? "";
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

function parseCsv(buffer: Buffer): { rows: string[][]; text: string } {
  const text = buffer.toString("utf-8");
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
  });
  const rows = (parsed.data as string[][]).filter((r) => Array.isArray(r));
  return { rows, text: tabularToText(rows) };
}

function parseXlsx(buffer: Buffer): { rows: string[][]; text: string } {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const allRows: string[][] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    if (rows.length > 0) {
      allRows.push([`# Sheet: ${sheetName}`]);
      for (const row of rows) {
        allRows.push(row.map((c) => String(c ?? "")));
      }
      allRows.push([]);
    }
  }
  return { rows: allRows, text: tabularToText(allRows) };
}

export async function parseUploadedFile(
  filename: string,
  mimetype: string,
  buffer: Buffer,
): Promise<ParsedFile> {
  const lower = filename.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";

  const warnings: string[] = [];

  if (ext === "pdf" || mimetype === "application/pdf") {
    const text = await parsePdf(buffer);
    // Detect image-based / scanned PDFs: lots of bytes, almost no text.
    if (text.trim().length < 100 && buffer.length > 50_000) {
      warnings.push(
        "This PDF appears to be image-based (a scan or photo). Very little text could be extracted, so the analysis may be incomplete. Try exporting it as a searchable PDF, or paste the text contents directly.",
      );
    }
    return { fileType: "pdf", rawText: clip(text), tabular: null, warnings };
  }

  if (
    ext === "docx" ||
    ext === "doc" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimetype === "application/msword"
  ) {
    const text = await parseDocx(buffer);
    return { fileType: "docx", rawText: clip(text), tabular: null, warnings };
  }

  if (ext === "csv" || mimetype === "text/csv") {
    const { rows, text } = parseCsv(buffer);
    return { fileType: "csv", rawText: clip(text), tabular: rows, warnings };
  }

  if (
    ext === "xlsx" ||
    ext === "xls" ||
    mimetype.includes("spreadsheet") ||
    mimetype.includes("excel")
  ) {
    const { rows, text } = parseXlsx(buffer);
    return {
      fileType: ext || "xlsx",
      rawText: clip(text),
      tabular: rows,
      warnings,
    };
  }

  if (ext === "txt" || mimetype.startsWith("text/")) {
    return {
      fileType: "txt",
      rawText: clip(buffer.toString("utf-8")),
      tabular: null,
      warnings,
    };
  }

  // Last-ditch attempt: treat as utf-8 text
  return {
    fileType: ext || "unknown",
    rawText: clip(buffer.toString("utf-8")),
    tabular: null,
    warnings,
  };
}
