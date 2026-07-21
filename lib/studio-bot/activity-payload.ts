export type StudioBotActivityMeta = {
  source: "studio_bot";
  userLinkId: string;
  flowId?: string | null;
  action: string;
};

export function buildStudioBotActivityPayload(
  userLinkId: string,
  action: string,
  flowId?: string | null
): StudioBotActivityMeta {
  return {
    source: "studio_bot",
    userLinkId,
    flowId: flowId ?? null,
    action,
  };
}
