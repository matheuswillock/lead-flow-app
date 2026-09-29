import { z } from "zod";

const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 4_000;

export const clientEventSchema = z.object({
  level: z.enum(["warn", "error"]),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  stack: z.string().max(MAX_STACK_LENGTH).optional(),
  route: z.string().max(200).optional(),
  requestId: z.string().max(100).optional(),
}).strict();

export type ClientEvent = z.infer<typeof clientEventSchema>;

export function parseClientEvent(value: unknown): ClientEvent | null {
  const result = clientEventSchema.safeParse(value);
  return result.success ? result.data : null;
}

export const CLIENT_EVENT_LIMIT = { limit: 20, windowMs: 60_000 } as const;
