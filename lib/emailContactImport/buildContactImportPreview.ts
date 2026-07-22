import type { EmailContactImportRow } from "./emailContactImportFields";
import { isValidResendRecipientEmail } from "@/lib/email/is-valid-resend-recipient-email";

const PREVIEW_LIMIT = 5;
const SKIPPED_ISSUES_PREVIEW_LIMIT = 50;

export type ContactImportSkippedIssue = {
  line?: number;
  email: string;
  reason: string;
};

export type ContactImportPreview = {
  totalFileRows: number;
  importableCount: number;
  skippedCount: number;
  skippedIssues: ContactImportSkippedIssue[];
  preview: Array<{ line?: number; email: string; name?: string }>;
};

export function buildContactImportPreview(
  rows: EmailContactImportRow[]
): ContactImportPreview {
  const importable: EmailContactImportRow[] = [];
  const skippedIssues: ContactImportSkippedIssue[] = [];

  for (const row of rows) {
    const validation = isValidResendRecipientEmail(row.email);
    if (validation.ok) {
      importable.push({
        ...row,
        email: validation.email,
      });
    } else {
      skippedIssues.push({
        line: row.line,
        email: (row.email ?? "").trim() || "(vazio)",
        reason: validation.reason,
      });
    }
  }

  return {
    totalFileRows: rows.length,
    importableCount: importable.length,
    skippedCount: skippedIssues.length,
    skippedIssues: skippedIssues.slice(0, SKIPPED_ISSUES_PREVIEW_LIMIT),
    preview: importable.slice(0, PREVIEW_LIMIT).map((row) => ({
      line: row.line,
      email: row.email.trim().toLowerCase(),
      name: row.name?.trim() || undefined,
    })),
  };
}
