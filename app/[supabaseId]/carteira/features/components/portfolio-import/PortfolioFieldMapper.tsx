"use client";

import { ImportFieldMapper } from "@/components/import/ImportFieldMapper";
import {
  PORTFOLIO_IMPORT_FIELDS,
  type PortfolioImportFieldKey,
} from "@/lib/portfolioImport/portfolioImportFields";
import type { PortfolioImportMapping } from "./autoMapPortfolioColumns";

interface PortfolioFieldMapperProps {
  columns: string[];
  rows: Record<string, string>[];
  mapping: PortfolioImportMapping;
  onMappingChange: (field: PortfolioImportFieldKey, column: string | undefined) => void;
  disabled?: boolean;
}

export function PortfolioFieldMapper({
  columns,
  rows,
  mapping,
  onMappingChange,
  disabled,
}: PortfolioFieldMapperProps) {
  return (
    <ImportFieldMapper
      fields={PORTFOLIO_IMPORT_FIELDS}
      columns={columns}
      rows={rows}
      mapping={mapping}
      onMappingChange={(fieldKey, column) =>
        onMappingChange(fieldKey as PortfolioImportFieldKey, column)
      }
      disabled={disabled}
    />
  );
}
