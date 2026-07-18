import { z } from "zod";

export const bethaniaAiIntentSchema = z.enum([
  "show_menu", "list_leads", "list_agenda", "list_tasks", "search", "digest", "open_lead",
  "propose_note", "propose_task", "propose_meeting", "propose_meeting_cancel", "propose_attachment",
]);

export const bethaniaAiResponseSchema = z.object({
  intent: bethaniaAiIntentSchema,
  confidence: z.number().min(0).max(1),
  response: z.string().max(1000),
  entityId: z.string().uuid().optional(),
  proposal: z.object({
    kind: z.enum(["note", "task", "meeting", "meeting_cancel", "attachment"]),
    parameters: z.record(z.string(), z.unknown()),
  }).optional(),
}).strict();

export type BethaniaAiResponse = z.infer<typeof bethaniaAiResponseSchema>;
