import { GoogleConnectionEventType, GoogleConnectionFlow, Prisma } from "@prisma/client";
import { createLogger, sanitize } from "@/lib/observability/logger";
import { googleConnectionEventRepository } from "@/app/api/infra/data/repositories/googleConnectionEvent/GoogleConnectionEventRepository";
import type { IGoogleConnectionEventRepository } from "@/app/api/infra/data/repositories/googleConnectionEvent/IGoogleConnectionEventRepository";

const logger = createLogger("google-connection");

export class GoogleConnectionEventService {
  constructor(private readonly repository: IGoogleConnectionEventRepository = googleConnectionEventRepository) {}

  async record(input: {
    eventType: GoogleConnectionEventType;
    flow: GoogleConnectionFlow;
    profileId?: string | null;
    supabaseUserId?: string | null;
    googleEmail?: string | null;
    errorCode?: string | null;
    errorCategory?: string | null;
    requestId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      const dedupeKey = input.requestId ? `${input.requestId}:${input.eventType}` : null;
      const metadata = input.metadata == null ? null : JSON.parse(JSON.stringify(sanitize(input.metadata))) as Prisma.InputJsonValue;
      await this.repository.create({ ...input, dedupeKey, metadata });
      logger.info("connection event recorded", { eventType: input.eventType, flow: input.flow, profileId: input.profileId, requestId: input.requestId, errorCategory: input.errorCategory });
    } catch (error) {
      logger.error("failed to record connection event", { error, eventType: input.eventType, flow: input.flow, requestId: input.requestId });
    }
  }
}

export const googleConnectionEventService = new GoogleConnectionEventService();
