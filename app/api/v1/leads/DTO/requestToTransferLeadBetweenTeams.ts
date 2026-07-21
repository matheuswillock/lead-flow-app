import { z } from "zod";

export const TransferLeadBetweenTeamsRequestSchema = z.object({
  targetTeamId: z.string().uuid("ID do time destino deve ser um UUID válido"),
  closerId: z.string().uuid("ID do closer deve ser um UUID válido").optional(),
  sdrId: z.string().uuid("ID do SDR deve ser um UUID válido").optional().nullable().default(null),
  schedule: z
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
    .nullable(),
});

export type TransferLeadBetweenTeamsRequest = z.infer<typeof TransferLeadBetweenTeamsRequestSchema>;
