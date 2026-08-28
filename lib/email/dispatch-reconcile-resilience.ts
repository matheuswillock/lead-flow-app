import { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { withDeadlockRetry } from "@/lib/email/with-deadlock-retry";

/** Pool/connection exhaustion — safe to reconnect and re-run the operation. */
const POOL_EXHAUSTED_ERRORS = new Set(["P1001", "P1002", "P1008", "P2024"]);

/** Server closed connection — commit may have succeeded; verify before re-running. */
const SERVER_CLOSED_ERRORS = new Set(["P1017"]);

export type DispatchTerminalSnapshot = {
  campaignStatus: "sent" | "failed" | "partially_sent";
  dispatchStatus: "completed" | "failed";
  errorMessage: string | null;
};

function getPrismaErrorCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : (error as { code?: string } | null)?.code;
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
 * Conta só o que um reenvio poderia resolver: recusas do provedor (`failed`).
 *
 * Fora da conta de propósito: `suppressed`, que é recusa da nossa
 * pré-validação e reprovaria de novo na mesma regra; e bounce, que já entrou
 * em `countSuccessfulDispatchLogs` por ter `sentAt`. É este valor que decide
 * entre `sent` e `partially_sent`.
 */
export async function countRetriableFailedDispatchLogs(dispatchId: string): Promise<number> {
  return prisma.emailLog.count({
    where: {
      dispatchId,
      status: "failed",
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
      ...(params.terminal.campaignStatus === "sent" || params.terminal.campaignStatus === "partially_sent"
        ? { sentAt: new Date() }
        : {}),
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
 * Deadlock retry + connection retry for commitDispatchTerminalState (D10).
 * - P1001/P2024: reconnect via prisma.$connect() and re-run operation.
 * - P1017 + verifyAlreadyCommitted: verify terminal state instead of blind re-run.
 */
export async function withDispatchTerminalCommitRetry<T>(
  operation: () => Promise<T>,
  options?: {
    onDeadlockRetry?: (attempt: number, error: unknown) => void;
    verifyAlreadyCommitted?: () => Promise<T | null | undefined>;
  }
): Promise<T> {
  const maxPoolRetries = 2;
  const verify = options?.verifyAlreadyCommitted;

  for (let attempt = 0; attempt <= maxPoolRetries; attempt += 1) {
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
      const code = getPrismaErrorCode(error);

      if (verify && code && SERVER_CLOSED_ERRORS.has(code)) {
        const already = await verify();
        if (already != null) {
          return already;
        }
      }

      const isPoolRetryable = !!code && POOL_EXHAUSTED_ERRORS.has(code);
      const hasRetriesLeft = attempt < maxPoolRetries;

      if (!isPoolRetryable || !hasRetriesLeft) {
        throw error;
      }

      console.warn(
        `[dispatch-reconcile] Pool/connection error (${code}) during terminal commit. Retrying (${attempt + 1}/${maxPoolRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, 150));
      await prisma.$connect();
    }
  }

  throw new Error("withDispatchTerminalCommitRetry: unreachable");
}
