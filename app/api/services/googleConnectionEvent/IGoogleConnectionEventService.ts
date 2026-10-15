import type { GoogleConnectionEventType, GoogleConnectionFlow } from "@prisma/client";

export type GoogleConnectionEventRecordInput = {
  eventType: GoogleConnectionEventType;
  flow: GoogleConnectionFlow;
  profileId?: string | null;
  supabaseUserId?: string | null;
  googleEmail?: string | null;
  errorCode?: string | null;
  errorCategory?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export interface IGoogleConnectionEventService {
  record(input: GoogleConnectionEventRecordInput): Promise<void>;
}
