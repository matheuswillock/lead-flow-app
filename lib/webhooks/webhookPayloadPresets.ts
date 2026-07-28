import type { TeamWebhookDestinationPreset, TeamWebhookEventKey } from "@prisma/client";

export type OutboundWebhookEnvelope = {
  id: string;
  type: TeamWebhookEventKey | "webhook_test";
  created_at: string;
  team_id: string;
  data: Record<string, unknown>;
};

export function buildGenericOutboundPayload(envelope: OutboundWebhookEnvelope): unknown {
  return envelope;
}

export function buildSlackOutboundPayload(envelope: OutboundWebhookEnvelope): unknown {
  const leadName =
    typeof envelope.data.lead === "object" &&
    envelope.data.lead &&
    "name" in (envelope.data.lead as object)
      ? String((envelope.data.lead as { name?: string }).name ?? "Lead")
      : "Evento";

  return {
    text: `[Corretor Studio] ${envelope.type}: ${leadName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${envelope.type}*\n${leadName}\n_${envelope.created_at}_`,
        },
      },
    ],
  };
}

export function buildTeamsOutboundPayload(envelope: OutboundWebhookEnvelope): unknown {
  const leadName =
    typeof envelope.data.lead === "object" &&
    envelope.data.lead &&
    "name" in (envelope.data.lead as object)
      ? String((envelope.data.lead as { name?: string }).name ?? "Lead")
      : "Evento";

  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    summary: `Corretor Studio — ${envelope.type}`,
    themeColor: "FF6900",
    title: envelope.type,
    text: `${leadName} · ${envelope.created_at}`,
  };
}

export function wrapOutboundPayloadForPreset(
  preset: TeamWebhookDestinationPreset,
  envelope: OutboundWebhookEnvelope
): unknown {
  switch (preset) {
    case "slack":
      return buildSlackOutboundPayload(envelope);
    case "teams":
      return buildTeamsOutboundPayload(envelope);
    case "zapier":
    case "generic":
      return buildGenericOutboundPayload(envelope);
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}
