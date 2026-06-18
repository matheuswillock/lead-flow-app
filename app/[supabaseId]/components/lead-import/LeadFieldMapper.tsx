"use client";

import { ImportFieldMapper } from "@/components/import/ImportFieldMapper";
import { LEAD_IMPORT_FIELDS, type LeadImportFieldKey } from "@/lib/leadImport/leadImportFields";
import type { LeadImportMapping } from "./autoMapColumns";

interface LeadFieldMapperProps {
  columns: string[];
  rows: Record<string, string>[];
  mapping: LeadImportMapping;
  onMappingChange: (field: LeadImportFieldKey, column: string | undefined) => void;
  disabled?: boolean;
}

export function LeadFieldMapper({
  columns,
  rows,
  mapping,
  onMappingChange,
  disabled,
}: LeadFieldMapperProps) {
  return (
    <ImportFieldMapper
      fields={LEAD_IMPORT_FIELDS}
      columns={columns}
      rows={rows}
      mapping={mapping}
      onMappingChange={(fieldKey, column) =>
        onMappingChange(fieldKey as LeadImportFieldKey, column)
      }
      disabled={disabled}
    />
  );
}
