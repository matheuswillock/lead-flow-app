import { z } from "zod";

export const bethaniaAiIntentSchema = z.enum([
  "show_menu",
  "list_leads",
  "agenda_today",
  "list_tasks",
  "search_lead",
  "team_digest",
  "open_lead",
  "add_note",
  "create_task",
  "schedule_meeting",
  "cancel_meeting",
  "upload_attachment",
  "unknown",
]);

export const bethaniaAiResponseSchema = z
  .object({
    intent: bethaniaAiIntentSchema,
    confidence: z.number().min(0).max(1),
    entities: z
      .object({
        searchQuery: z.string().max(160).optional(),
        leadReference: z.string().max(80).optional(),
        noteBody: z.string().max(2000).optional(),
        taskTitle: z.string().max(180).optional(),
        dateExpression: z.string().max(80).optional(),
        isoDate: z.string().optional(),
        time: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .optional(),
      })
      .strict()
      .default({}),
    needsClarification: z.boolean().default(false),
    clarificationField: z
      .enum(["lead", "date", "time", "task_title", "note", "none"])
      .default("none"),
  })
  .strict();

export type BethaniaAiResponse = z.infer<typeof bethaniaAiResponseSchema>;
