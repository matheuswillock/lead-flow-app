import type { EmailContactImportRow } from "./emailContactImportFields";
import { evaluateEmailForAudience } from "@/lib/email/audience-prevalidation";

const PREVIEW_LIMIT = 5;
const SKIPPED_ISSUES_PREVIEW_LIMIT = 50;

export type ContactImportSkippedIssue = {
  line?: number;
  email: string;
  reason: string;
};

export type ContactImportSkippedReasonCount = {
  reason: string;
  count: number;
};

export type ContactImportPreview = {
  totalFileRows: number;
  importableCount: number;
  skippedCount: number;
  skippedIssues: ContactImportSkippedIssue[];
  skippedReasonCounts: ContactImportSkippedReasonCount[];
  /** Linhas com e-mail válido — únicas que devem ser enfileiradas na importação. */
  importableRows: EmailContactImportRow[];
  preview: Array<{ line?: number; email: string; name?: string }>;
};

export function summarizeSkippedReasons(
  issues: ContactImportSkippedIssue[]
): ContactImportSkippedReasonCount[] {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue.reason, (counts.get(issue.reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, "pt-BR"));
}

export function buildContactImportPreview(
  rows: EmailContactImportRow[]
): ContactImportPreview {
  const importable: EmailContactImportRow[] = [];
  const skippedIssues: ContactImportSkippedIssue[] = [];

  for (const row of rows) {
    const validation = evaluateEmailForAudience(row.email);
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
    skippedReasonCounts: summarizeSkippedReasons(skippedIssues),
    importableRows: importable,
    preview: importable.slice(0, PREVIEW_LIMIT).map((row) => ({
      line: row.line,
      email: row.email.trim().toLowerCase(),
      name: row.name?.trim() || undefined,
    })),
  };
}
