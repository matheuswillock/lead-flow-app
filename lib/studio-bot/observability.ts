import { createLogger } from "@/lib/observability/logger";

export type StudioBotObservabilityContext = {
  flowId?: string | null;
  step?: string | null;
  errorCode?: string | null;
};

export function logStudioBotFlow(
  scope: string,
  ctx: StudioBotObservabilityContext,
  message: string
): void {
  createLogger(scope).info(message, {
    flowId: ctx.flowId ?? null,
    step: ctx.step ?? null,
    errorCode: ctx.errorCode ?? null,
  });
}
