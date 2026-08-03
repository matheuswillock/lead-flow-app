"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field"
import { ImportFieldMapper } from "@/components/import/ImportFieldMapper"
import { ImportMappingHeader } from "@/components/import/ImportMappingHeader"
import { RADAR_IMPORT_FIELDS, slugifyRadarFieldKey } from "@/lib/radarImport/radarImportFields"

type RadarFieldMapperProps = {
  columns: string[]
  rows: Record<string, string>[]
  mapping: Record<string, string>
  onMappingChange: (fieldKey: string, column: string | undefined) => void
  onCreateFieldForColumn: (column: string) => void
  disabled?: boolean
}

export function RadarFieldMapper({
  columns,
  rows,
  mapping,
  onMappingChange,
  onCreateFieldForColumn,
  disabled,
}: RadarFieldMapperProps) {
  const usedColumns = useMemo(() => new Set(Object.values(mapping)), [mapping])
  const unmappedColumns = useMemo(
    () => columns.filter((column) => !usedColumns.has(column)),
    [columns, usedColumns]
  )

  return (
    <div className="flex flex-col gap-4">
      <ImportFieldMapper
        fields={RADAR_IMPORT_FIELDS}
        columns={columns}
        rows={rows}
        mapping={mapping}
        onMappingChange={onMappingChange}
        disabled={disabled}
      />

      {unmappedColumns.length > 0 ? (
        <div className="flex flex-col gap-3">
          <ImportMappingHeader
            left="Colunas extras"
            right="Criar campo no Radar"
            sticky={false}
          />
          <FieldGroup className="gap-3">
            {unmappedColumns.map((column) => {
              const createKey = `new:${slugifyRadarFieldKey(column)}`
              const isCreated = mapping[createKey] === column

              return (
                <Field key={column} orientation="responsive" className="rounded-md border p-3">
                  <FieldContent>
                    <FieldTitle>{column}</FieldTitle>
                    <FieldDescription>
                      Coluna não mapeada. Você pode criar um campo dinâmico no Radar para usá-la em
                      segmentos e interpolação.
                    </FieldDescription>
                  </FieldContent>
                  {isCreated ? (
                    <Badge variant="secondary">Campo será criado</Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onCreateFieldForColumn(column)}
                    >
                      Criar campo no Radar
                    </Button>
                  )}
                </Field>
              )
            })}
          </FieldGroup>
        </div>
      ) : null}
    </div>
  )
}
