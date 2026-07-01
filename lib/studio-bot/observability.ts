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
  console.info(`[${scope}]`, {
    flowId: ctx.flowId ?? null,
    step: ctx.step ?? null,
    errorCode: ctx.errorCode ?? null,
    message,
  });
}
