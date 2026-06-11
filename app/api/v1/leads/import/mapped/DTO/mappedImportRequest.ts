import { z } from "zod";
import { LEAD_IMPORT_MAX_ROWS } from "@/lib/leadImport/leadImportFields";

const importRowSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  cnpj: z.string().optional(),
  age: z.string().optional(),
  currentHealthPlan: z.string().optional(),
  currentValue: z.string().optional(),
  ticket: z.string().optional(),
  referenceHospital: z.string().optional(),
  currentTreatment: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  soldPlan: z.string().optional(),
  contractDueDate: z.string().optional(),
});

export const MappedImportRequestSchema = z.object({
  rows: z
    .array(importRowSchema)
    .min(1, "Envie pelo menos uma linha para importar")
    .max(LEAD_IMPORT_MAX_ROWS, `Limite de ${LEAD_IMPORT_MAX_ROWS} linhas por importação`),
});

export type MappedImportRequest = z.infer<typeof MappedImportRequestSchema>;
export type MappedImportRow = z.infer<typeof importRowSchema>;
