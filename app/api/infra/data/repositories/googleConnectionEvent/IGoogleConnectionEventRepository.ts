import type { GoogleConnectionEventType, GoogleConnectionFlow, Prisma } from "@prisma/client";

export type GoogleConnectionEventInput = {
  eventType: GoogleConnectionEventType;
  flow: GoogleConnectionFlow;
  profileId?: string | null;
  supabaseUserId?: string | null;
  googleEmail?: string | null;
  errorCode?: string | null;
  errorCategory?: string | null;
  requestId?: string | null;
  dedupeKey?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export interface IGoogleConnectionEventRepository {
  create(input: GoogleConnectionEventInput): Promise<void>;
}
