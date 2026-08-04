import { RADAR_IMPORT_FIELDS } from "./radarImportFields"

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

export type RadarImportMapping = Partial<Record<string, string>>

export function autoMapRadarColumns(columns: string[]): RadarImportMapping {
  const mapping: RadarImportMapping = {}
  const usedColumns = new Set<string>()

  const normalizedColumns = columns.map((column) => ({
    column,
    normalized: normalize(column),
  }))

  for (const field of RADAR_IMPORT_FIELDS) {
    const aliases = field.aliases.map(normalize)

    const exact = normalizedColumns.find(
      ({ column, normalized }) => !usedColumns.has(column) && aliases.includes(normalized)
    )
    if (exact) {
      mapping[field.key] = exact.column
      usedColumns.add(exact.column)
      continue
    }

    const partial = normalizedColumns.find(
      ({ column, normalized }) =>
        !usedColumns.has(column) &&
        normalized.length > 2 &&
        aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
    )
    if (partial) {
      mapping[field.key] = partial.column
      usedColumns.add(partial.column)
    }
  }

  return mapping
}
