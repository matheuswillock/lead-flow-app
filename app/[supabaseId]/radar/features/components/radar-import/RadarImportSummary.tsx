"use client"

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RADAR_IMPORT_FIELDS, isRadarNewFieldKey } from "@/lib/radarImport/radarImportFields"

type RadarImportSummaryProps = {
  fileName: string
  rowCount: number
  mapping: Record<string, string>
  baseName: string
  onBaseNameChange: (value: string) => void
}

export function RadarImportSummary({
  fileName,
  rowCount,
  mapping,
  baseName,
  onBaseNameChange,
}: RadarImportSummaryProps) {
  const mappedEntries = Object.entries(mapping)
  const newFieldCount = mappedEntries.filter(([key]) => isRadarNewFieldKey(key)).length

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-surface-1 p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Arquivo:</span> {fileName}
        </p>
        <p>
          <span className="text-muted-foreground">Linhas:</span> {rowCount}
        </p>
        <p>
          <span className="text-muted-foreground">Campos mapeados:</span> {mappedEntries.length}
        </p>
        <p>
          <span className="text-muted-foreground">Campos novos:</span> {newFieldCount}
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel>Nome da base</FieldLabel>
          <Input
            value={baseName}
            onChange={(event) => onBaseNameChange(event.target.value)}
            placeholder="Ex.: Base evento março 2026"
          />
        </Field>
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Resumo do mapeamento</p>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {mappedEntries.map(([fieldKey, column]) => {
            const field = RADAR_IMPORT_FIELDS.find((item) => item.key === fieldKey)
            const label = field?.label ?? (isRadarNewFieldKey(fieldKey) ? `Novo: ${fieldKey.slice(4)}` : fieldKey)
            return (
              <li key={fieldKey}>
                {label} → {column}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
