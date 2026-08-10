import { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { withDeadlockRetry } from "@/lib/email/with-deadlock-retry";

/** Connection/pool errors where the DB may have committed before the client saw the response. */
const AMBIGUOUS_CONNECTION_ERRORS = new Set(["P1017", "P1001", "P1002", "P1008", "P2024"]);

export type DispatchTerminalSnapshot = {
  campaignStatus: "sent" | "failed";
  dispatchStatus: "completed" | "failed";
  errorMessage: string | null;
};

function isAmbiguousConnectionError(error: unknown): boolean {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : (error as { code?: string } | null)?.code;
  return !!code && AMBIGUOUS_CONNECTION_ERRORS.has(code);
}

/** Count EmailLog rows with send evidence (sentAt), including later bounces/complaints (D10). */
export async function countSuccessfulDispatchLogs(dispatchId: string): Promise<number> {
  return prisma.emailLog.count({
    where: {
      dispatchId,
      sentAt: { not: null },
    },
  });
}

/**
 * Isolated writes (no transaction) when commitDispatchTerminalState fails after retries.
 * D10 — preserve totalSent and terminal statuses when EmailLog proves sends occurred.
 */
export async function persistDispatchTerminalFallback(params: {
  campaignId: string;
  dispatchId: string;
  sentCount: number;
  terminal: DispatchTerminalSnapshot;
  totalRecipients?: number;
  incrementCampaignSent?: boolean;
  incrementDispatchCount?: boolean;
}): Promise<boolean> {
  const incrementCampaignSent = params.incrementCampaignSent ?? true;
  const incrementDispatchCount = params.incrementDispatchCount ?? true;

  const dispatch = await prisma.emailCampaignDispatch.findUnique({
    where: { id: params.dispatchId },
    select: { status: true },
  });
  if (dispatch && dispatch.status !== "sending") {
    return true;
  }

  await prisma.emailCampaign.updateMany({
    where: { id: params.campaignId, status: "sending" },
    data: {
      status: params.terminal.campaignStatus,
      errorMessage: params.terminal.errorMessage,
      ...(params.terminal.campaignStatus === "sent" ? { sentAt: new Date() } : {}),
      ...(params.totalRecipients !== undefined ? { totalRecipients: params.totalRecipients } : {}),
      ...(incrementCampaignSent && params.sentCount > 0
        ? { totalSent: { increment: params.sentCount } }
        : {}),
      ...(incrementDispatchCount ? { dispatchCount: { increment: 1 } } : {}),
    },
  });

  const updated = await prisma.emailCampaignDispatch.updateMany({
    where: { id: params.dispatchId, status: "sending" },
    data: {
      totalSent: params.sentCount,
      status: params.terminal.dispatchStatus,
      errorMessage: params.terminal.errorMessage,
    },
  });
  return updated.count === 1;
}

/**
 * Deadlock retry + guarded connection retry for commitDispatchTerminalState (D10).
 * On ambiguous connection errors, verifies terminal state before re-running increments.
 */
export async function withDispatchTerminalCommitRetry<T>(
  operation: () => Promise<T>,
  options?: {
    onDeadlockRetry?: (attempt: number, error: unknown) => void;
    verifyAlreadyCommitted?: () => Promise<T | null | undefined>;
  }
): Promise<T> {
  const maxConnectionRetries = 2;
  const verify = options?.verifyAlreadyCommitted;

  for (let connAttempt = 0; connAttempt <= maxConnectionRetries; connAttempt += 1) {
    if (verify) {
      const already = await verify();
      if (already != null) {
        return already;
      }
    }

    try {
      return await withDeadlockRetry(operation, {
        onRetry: options?.onDeadlockRetry,
      });
    } catch (error) {
      if (verify) {
        const already = await verify();
        if (already != null) {
          return already;
        }
      }

      const hasRetriesLeft = connAttempt < maxConnectionRetries;
      if (!isAmbiguousConnectionError(error) || !hasRetriesLeft) {
        throw error;
      }

      console.warn(
        `[dispatch-reconcile] Ambiguous connection error during terminal commit. Retrying (${connAttempt + 1}/${maxConnectionRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
      await prisma.$connect();
    }
  }

  throw new Error("withDispatchTerminalCommitRetry: unreachable");
}
