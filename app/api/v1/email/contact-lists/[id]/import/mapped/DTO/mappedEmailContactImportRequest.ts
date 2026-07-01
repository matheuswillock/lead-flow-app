import { z } from "zod";

const MappedEmailContactRowSchema = z.object({
  line: z.number().int().positive().optional(),
  email: z.string(),
  name: z.string().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export const MappedEmailContactImportRequestSchema = z.object({
  rows: z.array(MappedEmailContactRowSchema).min(1, "Envie ao menos uma linha para importar"),
});

export type MappedEmailContactImportRequest = z.infer<typeof MappedEmailContactImportRequestSchema>;
