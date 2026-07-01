"use client";

import { ImportFieldMapper } from "@/components/import/ImportFieldMapper";
import {
  EMAIL_CONTACT_IMPORT_FIELDS,
  type EmailContactImportFieldKey,
} from "@/lib/emailContactImport/emailContactImportFields";
import type { EmailContactImportMapping } from "./autoMapEmailContactColumns";

interface ContactFieldMapperProps {
  columns: string[];
  rows: Record<string, string>[];
  mapping: EmailContactImportMapping;
  onMappingChange: (field: EmailContactImportFieldKey, column: string | undefined) => void;
  disabled?: boolean;
}

export function ContactFieldMapper({
  columns,
  rows,
  mapping,
  onMappingChange,
  disabled,
}: ContactFieldMapperProps) {
  return (
    <ImportFieldMapper
      fields={EMAIL_CONTACT_IMPORT_FIELDS}
      columns={columns}
      rows={rows}
      mapping={mapping}
      onMappingChange={(fieldKey, column) =>
        onMappingChange(fieldKey as EmailContactImportFieldKey, column)
      }
      disabled={disabled}
    />
  );
}
