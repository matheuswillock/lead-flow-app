import { z } from "zod";

const TransferScheduleSchema = z
  .object({
    date: z.string().datetime().optional(),
    meetingTitle: z.string().optional(),
    meetingLink: z.string().optional(),
    meetingNotes: z.string().optional(),
    meetingType: z.enum(["online", "call", "whatsapp"]).optional(),
    extraGuests: z.array(z.string().email("Email de convidado inválido")).optional(),
    transitionStatusToScheduled: z.boolean().optional(),
  })
  .optional()
  .nullable();

export const TransferMultiskillLeadRequestSchema = z.object({
  targetMasterId: z.string().uuid("ID do master destino deve ser um UUID válido"),
  closerId: z.string().uuid("ID do closer deve ser um UUID válido"),
  sdrId: z.string().uuid("ID do SDR deve ser um UUID válido").optional().nullable().default(null),
  schedule: TransferScheduleSchema,
});

export type TransferMultiskillLeadRequest = z.infer<typeof TransferMultiskillLeadRequestSchema>;
