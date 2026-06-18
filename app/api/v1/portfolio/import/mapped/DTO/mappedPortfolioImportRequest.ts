import { z } from "zod";
import { PORTFOLIO_IMPORT_MAX_ROWS } from "@/lib/portfolioImport/portfolioImportFields";

const importRowSchema = z.object({
  line: z.number().int().min(1).optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  cnpj: z.string().optional(),
  contractType: z.enum(['individual', 'corporate', 'adhesion']).optional(),
  operadora: z.string().optional(),
  productName: z.string().optional(),
  amount: z.string().optional(),
  startDateAt: z.string().optional(),
  finalizedDateAt: z.string().optional(),
  contractDueDate: z.string().optional(),
  notes: z.string().optional(),
  holderName: z.string().optional(),
  holderBirthDate: z.string().optional(),
  holderDocument: z.string().optional(),
});

export const MappedPortfolioImportRequestSchema = z.object({
  closerId: z.string().uuid("Closer inválido"),
  source: z.enum(["manual", "brokerage_transfer"]),
  rows: z
    .array(importRowSchema)
    .min(1, "Envie pelo menos uma linha para importar")
    .max(PORTFOLIO_IMPORT_MAX_ROWS, `Limite de ${PORTFOLIO_IMPORT_MAX_ROWS} linhas por importação`),
});

export type MappedPortfolioImportRequest = z.infer<typeof MappedPortfolioImportRequestSchema>;
export type MappedPortfolioImportRow = z.infer<typeof importRowSchema>;
