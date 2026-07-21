import {
  EMAIL_CONTACT_IMPORT_FIELDS,
  type EmailContactImportFieldKey,
} from "@/lib/emailContactImport/emailContactImportFields";

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type EmailContactImportMapping = Partial<Record<EmailContactImportFieldKey, string>>;

export function autoMapEmailContactColumns(columns: string[]): EmailContactImportMapping {
  const mapping: EmailContactImportMapping = {};
  const usedColumns = new Set<string>();

  const normalizedColumns = columns.map((column) => ({
    column,
    normalized: normalize(column),
  }));

  for (const field of EMAIL_CONTACT_IMPORT_FIELDS) {
    const aliases = field.aliases.map(normalize);

    const exact = normalizedColumns.find(
      ({ column, normalized }) => !usedColumns.has(column) && aliases.includes(normalized)
    );
    if (exact) {
      mapping[field.key as EmailContactImportFieldKey] = exact.column;
      usedColumns.add(exact.column);
      continue;
    }

    const partial = normalizedColumns.find(
      ({ column, normalized }) =>
        !usedColumns.has(column) &&
        normalized.length > 2 &&
        aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
    );
    if (partial) {
      mapping[field.key as EmailContactImportFieldKey] = partial.column;
      usedColumns.add(partial.column);
    }
  }

  return mapping;
}
