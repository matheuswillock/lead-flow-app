import type { EmailContactImportRow } from "@/lib/emailContactImport/emailContactImportFields";
import type { ParsedLeadRow } from "@/app/[supabaseId]/components/lead-import/leadFileParser";
import type { EmailContactImportMapping } from "./autoMapEmailContactColumns";

export function buildMappedContactRows(
  rows: ParsedLeadRow[],
  columns: string[],
  mapping: EmailContactImportMapping
): EmailContactImportRow[] {
  const emailColumn = mapping.email;
  if (!emailColumn) return [];

  const nameColumn = mapping.name;
  const reservedColumns = new Set([emailColumn, nameColumn].filter(Boolean) as string[]);

  return rows.map((row, index) => {
    const email = row.values[emailColumn]?.trim() ?? "";
    const name = nameColumn ? row.values[nameColumn]?.trim() : undefined;
    const customFields: Record<string, string> = {};

    for (const column of columns) {
      if (reservedColumns.has(column)) continue;
      const value = row.values[column]?.trim();
      if (value) customFields[column] = value;
    }

    return {
      line: row.line ?? index + 2,
      email,
      name: name || undefined,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    };
  });
}
