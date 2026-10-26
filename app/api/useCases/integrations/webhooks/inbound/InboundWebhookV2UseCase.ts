import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { ITeamWebhookInboundEventRepository } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookInboundEventRepository";
import { teamWebhookInboundEventRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookInboundEventRepository";
import type { ITeamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookRepository";
import { teamWebhookRepository } from "@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository";
import { Output } from "@/lib/output";
import { isStudioWebhookTokenExpired, safeStudioWebhookTokenEquals } from "@/lib/webhooks/studioWebhookSecurity";
import type { IInboundTeamPort } from "./InboundIntakePorts";
import { inboundTeamAdapter } from "./InboundTeamAdapter";

export type InboundV2AuthResult =
  | { status: "ok"; webhook: { id: string; teamId: string; scopes: string[] } }
  /** Token ausente, errado ou de time inexistente: resposta idêntica, sem confirmar nada. */
  | { status: "unauthorized" }
  | { status: "token_expired"; webhookId: string }
  | { status: "version_mismatch"; webhookId: string }
  | {
      status: "forbidden";
      reason: "webhook_inactive" | "missing_scope" | "account_restricted";
      webhookId: string;
    };

export type InboundV2ReceiveResult = { eventId: string; created: boolean; idempotencyKeyReused: boolean };

export type InboundWebhookV2Deps = {
  webhooks: Pick<ITeamWebhookRepository, "listInboundByTeamId">;
  events: Pick<ITeamWebhookInboundEventRepository, "receive">;
  teams: IInboundTeamPort;
};

/**
 * Recebimento síncrono do webhook v2 (SPEC 11, DA1, DA3, DA4 parte síncrona, DA5).
 *
 * Só decide o que protege a plataforma e o recebimento: quem é o webhook, se a versão e o escopo
 * batem, se a conta pode escrever e a idempotência do evento. Nada de regra de negócio aqui.
 */
export class InboundWebhookV2UseCase {
  constructor(private readonly deps: InboundWebhookV2Deps) {}

  /** `result` é um `InboundV2AuthResult`; `isValid` só quando `status === "ok"`. */
  async authenticate(input: { teamId: string; token: string }): Promise<Output> {
    const result = await this.resolveAuthentication(input);
    return new Output(result.status === "ok", [], result.status === "ok" ? [] : [result.status], result);
  }

  private async resolveAuthentication(input: { teamId: string; token: string }): Promise<InboundV2AuthResult> {
    const candidates = await this.deps.webhooks.listInboundByTeamId(input.teamId);
    const matched = candidates.find(
      (candidate) => candidate.tokenHash !== null && safeStudioWebhookTokenEquals(input.token, candidate.tokenHash),
    );
    if (!matched) return { status: "unauthorized" };

    if (matched.status === "disabled" || matched.status === "paused") {
      return { status: "forbidden", reason: "webhook_inactive", webhookId: matched.id };
    }
    if (isStudioWebhookTokenExpired(matched.expiresAt)) {
      return { status: "token_expired", webhookId: matched.id };
    }
    // DA1: a versão gravada no webhook é a fonte da verdade; o path só a espelha.
    if (matched.contractVersion !== 2) {
      return { status: "version_mismatch", webhookId: matched.id };
    }
    if (!(matched.scopes ?? []).includes("leads_create")) {
      return { status: "forbidden", reason: "missing_scope", webhookId: matched.id };
    }

    const team = await this.deps.teams.getTeam(matched.teamId);
    if (!team) return { status: "unauthorized" };
    if (!(await this.deps.teams.isAccountAllowed(team))) {
      return { status: "forbidden", reason: "account_restricted", webhookId: matched.id };
    }

    return { status: "ok", webhook: { id: matched.id, teamId: matched.teamId, scopes: matched.scopes ?? [] } };
  }

  /** Grava o evento (idempotente); `result` é um `InboundV2ReceiveResult` (o `event_id` do integrador). */
  async receive(input: {
    webhook: { id: string; teamId: string };
    rawBody: string;
    payload: Prisma.InputJsonValue;
    idempotencyKey: string | null;
  }): Promise<Output> {
    const received: InboundV2ReceiveResult = await this.deps.events.receive({
      webhookId: input.webhook.id,
      teamId: input.webhook.teamId,
      contractVersion: 2,
      idempotencyKey: input.idempotencyKey,
      requestHash: createHash("sha256").update(input.rawBody).digest("hex"),
      payload: input.payload,
    });
    return new Output(true, [], [], received);
  }
}

export const inboundWebhookV2UseCase = new InboundWebhookV2UseCase({
  webhooks: teamWebhookRepository,
  events: teamWebhookInboundEventRepository,
  teams: inboundTeamAdapter,
});
