import { prisma, withPrismaRetry } from "@/app/api/infra/data/prisma";
import { withDeadlockRetry } from "@/lib/email/with-deadlock-retry";

/** Statuses that count as successfully sent for dispatch reconcile (D10). */
export const DISPATCH_SUCCESS_LOG_STATUSES = [
  "sent",
  "delivered",
  "opened",
  "clicked",
] as const;

export async function countSuccessfulDispatchLogs(dispatchId: string): Promise<number> {
  return prisma.emailLog.count({
    where: {
      dispatchId,
      status: { in: [...DISPATCH_SUCCESS_LOG_STATUSES] },
    },
  });
}

/**
 * Isolated write (no transaction) to preserve totalSent when terminal commit fails.
 * D10 — never leave totalSent at 0 when EmailLog proves sends occurred.
 */
export async function persistDispatchTotalSentFallback(params: {
  dispatchId: string;
  sentCount: number;
  errorMessage?: string | null;
}): Promise<boolean> {
  const updated = await prisma.emailCampaignDispatch.updateMany({
    where: { id: params.dispatchId },
    data: {
      totalSent: params.sentCount,
      ...(params.errorMessage !== undefined ? { errorMessage: params.errorMessage } : {}),
    },
  });
  return updated.count === 1;
}

/** Deadlock retry inside transient connection retry for commitDispatchTerminalState (D10). */
export async function withDispatchTerminalCommitRetry<T>(
  operation: () => Promise<T>,
  options?: { onDeadlockRetry?: (attempt: number, error: unknown) => void }
): Promise<T> {
  return withPrismaRetry(
    () =>
      withDeadlockRetry(operation, {
        onRetry: options?.onDeadlockRetry,
      }),
    { label: "commitDispatchTerminalState", retries: 2 }
  );
}
