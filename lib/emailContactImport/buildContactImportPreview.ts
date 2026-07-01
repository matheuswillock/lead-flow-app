import type { EmailContactImportRow } from "./emailContactImportFields";

const PREVIEW_LIMIT = 5;

export type ContactImportPreview = {
  totalFileRows: number;
  importableCount: number;
  skippedCount: number;
  preview: Array<{ line?: number; email: string; name?: string }>;
};

function isImportableEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 && normalized.includes("@");
}

export function buildContactImportPreview(
  rows: EmailContactImportRow[]
): ContactImportPreview {
  const importable: EmailContactImportRow[] = [];
  const skipped: EmailContactImportRow[] = [];

  for (const row of rows) {
    if (isImportableEmail(row.email)) {
      importable.push(row);
    } else {
      skipped.push(row);
    }
  }

  return {
    totalFileRows: rows.length,
    importableCount: importable.length,
    skippedCount: skipped.length,
    preview: importable.slice(0, PREVIEW_LIMIT).map((row) => ({
      line: row.line,
      email: row.email.trim().toLowerCase(),
      name: row.name?.trim() || undefined,
    })),
  };
}
