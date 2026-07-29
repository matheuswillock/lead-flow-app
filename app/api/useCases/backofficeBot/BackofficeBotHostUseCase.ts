import { createHash, timingSafeEqual } from "node:crypto";
import { Output } from "@/lib/output";
import {
  decryptHostEnvMap,
  encryptHostEnvMap,
  generateAgentToken,
  hashAgentToken,
} from "@/lib/studio-bot/host-cipher";
import {
  EVOLUTION_HOST_ENV_KEYS,
  N8N_HOST_ENV_KEYS,
  BETHANIA_INBOUND_WEBHOOK_INTERNAL_URL,
  buildOpsHostEnvFileContent,
  filterAllowedEnv,
  maskEnvMap,
  mergeEnvMaps,
} from "@/lib/studio-bot/host-env";
import { backofficeBotHostRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotHostRepository";
import {
  studioBotHostAgentClient,
  type IStudioBotHostAgentClient,
} from "@/app/api/services/backofficeBot/StudioBotHostAgentClient";
import { backofficeEvoApiService } from "@/app/api/services/backofficeBot/evo/BackofficeEvoApiService";
import type { IBackofficeBotHostUseCase } from "./IBackofficeBotHostUseCase";

type AgentAuth = { baseUrl: string; token: string };

// Token em memória só após rotate nesta sessão de processo (não persiste).
const agentTokenPlainBySettingsId = new Map<string, string>();

function requireMaster(fullAccess: boolean): Output | null {
  if (!fullAccess) {
    return new Output(false, [], ["Apenas MASTER pode executar esta ação"], null);
  }
  return null;
}

function resolveBethaniaWebhookUrl(n8nEnv: Record<string, string>): string {
  const base = n8nEnv.N8N_WEBHOOK_BASE_URL?.trim().replace(/\/$/, "");
  if (base) {
    return `${base}/webhook/bethania-inbound`;
  }
  return BETHANIA_INBOUND_WEBHOOK_INTERNAL_URL;
}

function resolveBethaniaInstanceName(n8nEnv: Record<string, string>): string {
  return (
    n8nEnv.EVO_BETHANIA_INSTANCE?.trim() ||
    process.env.EVO_BETHANIA_INSTANCE?.trim() ||
    "bethania"
  );
}

class BackofficeBotHostUseCase implements IBackofficeBotHostUseCase {
  constructor(
    private readonly repo = backofficeBotHostRepository,
    private readonly agent: IStudioBotHostAgentClient = studioBotHostAgentClient
  ) {}

  async getSettings() {
    const settings = await this.repo.getOrCreateSettings();
    const n8nEnv = decryptHostEnvMap(settings.n8nEnvEncrypted);
    const evolutionEnv = decryptHostEnvMap(settings.evolutionEnvEncrypted);

    return new Output(true, ["Configuração do host carregada"], [], {
      id: settings.id,
      agentBaseUrl: settings.agentBaseUrl,
      agentTokenConfigured: Boolean(settings.agentTokenHash),
      desiredHostVersion: settings.desiredHostVersion,
      appliedHostVersion: settings.appliedHostVersion,
      lastAppliedAt: settings.lastAppliedAt,
      lastApplyStatus: settings.lastApplyStatus,
      lastApplyError: settings.lastApplyError,
      n8nEnv: maskEnvMap(n8nEnv),
      evolutionEnv: maskEnvMap(evolutionEnv),
      updatedAt: settings.updatedAt,
    });
  }

  async updateSettings(
    input: {
      agentBaseUrl?: string | null;
      desiredHostVersion?: string | null;
      n8nEnv?: Record<string, string>;
      evolutionEnv?: Record<string, string>;
    },
    access: { profileId: string; fullAccess: boolean }
  ) {
    const denied = requireMaster(access.fullAccess);
    if (denied) return denied;

    const settings = await this.repo.getOrCreateSettings();
    const currentN8n = decryptHostEnvMap(settings.n8nEnvEncrypted);
    const currentEvo = decryptHostEnvMap(settings.evolutionEnvEncrypted);

    const n8nPatch = filterAllowedEnv(input.n8nEnv ?? {}, N8N_HOST_ENV_KEYS);
    const evoPatch = filterAllowedEnv(input.evolutionEnv ?? {}, EVOLUTION_HOST_ENV_KEYS);
    const nextN8n = mergeEnvMaps(currentN8n, n8nPatch);
    const nextEvo = mergeEnvMaps(currentEvo, evoPatch);

    const webhookSecret = nextN8n.BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET;
    if (webhookSecret) {
      await this.repo.updateChannelSecrets({
        webhookSecret,
        n8nOutboundSecret: webhookSecret,
      });
    }

    const updated = await this.repo.updateSettings(settings.id, {
      agentBaseUrl:
        input.agentBaseUrl === undefined ? undefined : input.agentBaseUrl?.trim() || null,
      desiredHostVersion:
        input.desiredHostVersion === undefined
          ? undefined
          : input.desiredHostVersion?.trim() || null,
      n8nEnvEncrypted: encryptHostEnvMap(nextN8n),
      evolutionEnvEncrypted: encryptHostEnvMap(nextEvo),
    });

    console.info("[BackofficeBotHostUseCase][updateSettings]", {
      profileId: access.profileId,
      n8nKeys: Object.keys(n8nPatch),
      evolutionKeys: Object.keys(evoPatch),
    });

    return new Output(true, ["Configuração salva"], [], {
      id: updated.id,
      agentBaseUrl: updated.agentBaseUrl,
      desiredHostVersion: updated.desiredHostVersion,
    });
  }

  async exportEnvFile(access: { profileId: string; fullAccess: boolean }) {
    const denied = requireMaster(access.fullAccess);
    if (denied) return denied;

    const settings = await this.repo.getOrCreateSettings();
    const n8nEnv = decryptHostEnvMap(settings.n8nEnvEncrypted);
    const evolutionEnv = decryptHostEnvMap(settings.evolutionEnvEncrypted);
    const agent = {
      agentBaseUrl: settings.agentBaseUrl,
      desiredHostVersion: settings.desiredHostVersion,
    };
    const content = buildOpsHostEnvFileContent({ agent, n8nEnv, evolutionEnv });

    console.info("[BackofficeBotHostUseCase][exportEnvFile]", {
      profileId: access.profileId,
      n8nKeys: Object.keys(n8nEnv).length,
      evolutionKeys: Object.keys(evolutionEnv).length,
      hasAgentBaseUrl: Boolean(agent.agentBaseUrl),
      hasDesiredHostVersion: Boolean(agent.desiredHostVersion),
    });

    return new Output(true, ["Arquivo de variáveis exportado"], [], {
      content,
      fileName: "bethania-ops-host-env.txt",
      agentBaseUrl: agent.agentBaseUrl,
      desiredHostVersion: agent.desiredHostVersion,
      n8nEnv,
      evolutionEnv,
    });
  }

  async rotateAgentToken(access: { profileId: string; fullAccess: boolean }) {
    const denied = requireMaster(access.fullAccess);
    if (denied) return denied;

    const settings = await this.repo.getOrCreateSettings();
    const token = generateAgentToken();
    await this.repo.updateSettings(settings.id, {
      agentTokenHash: hashAgentToken(token),
    });
    agentTokenPlainBySettingsId.set(settings.id, token);

    console.info("[BackofficeBotHostUseCase][rotateAgentToken]", {
      profileId: access.profileId,
      settingsId: settings.id,
    });

    return new Output(
      true,
      ["Token do agente gerado — copie agora; não será exibido novamente"],
      [],
      { agentToken: token, settingsId: settings.id }
    );
  }

  async listJobs() {
    const jobs = await this.repo.listJobs(40);
    return new Output(true, ["Jobs listados"], [], { jobs });
  }

  async health(access: { profileId: string; fullAccess: boolean }) {
    const denied = requireMaster(access.fullAccess);
    if (denied) return denied;

    const auth = await this.resolveAgentAuth();
    if (!auth.ok) return auth.output;

    const job = await this.repo.createJob({
      type: "HEALTH",
      requestedByProfileId: access.profileId,
      payload: { keys: [] },
    });
    await this.repo.updateJob(job.id, { status: "running", startedAt: new Date() });

    const result = await this.agent.health(auth.baseUrl, auth.token);
    await this.repo.updateJob(job.id, {
      status: result.ok ? "succeeded" : "failed",
      result,
      errorMessage: result.error ?? null,
      finishedAt: new Date(),
    });

    // Diferencia agente inacessível (timeout/erro de rede — sem "HTTP <status>"
    // no error) de agente alcançável mas respondendo com falha (HTTP não-2xx),
    // para o toast do frontend não mostrar sempre a mesma mensagem genérica.
    const unreachable = !result.ok && !result.error?.startsWith("HTTP ");
    const errorMessage = result.ok
      ? undefined
      : unreachable
        ? `Agente Ops inacessível: ${result.error ?? "erro desconhecido"}`
        : `Agente Ops respondeu com falha: ${result.error ?? "Falha no health"}`;

    return new Output(
      result.ok,
      result.ok ? ["Health obtido"] : [],
      result.ok ? [] : [errorMessage ?? "Falha no health"],
      { jobId: job.id, health: result }
    );
  }

  async fetchLogs(
    input: { service: "n8n" | "api"; tail?: number },
    access: { profileId: string; fullAccess: boolean }
  ) {
    const denied = requireMaster(access.fullAccess);
    if (denied) return denied;

    if (input.service !== "n8n" && input.service !== "api") {
      return new Output(false, [], ["service deve ser n8n ou api"], null);
    }

    const auth = await this.resolveAgentAuth();
    if (!auth.ok) return auth.output;

    const tail = Math.min(Math.max(input.tail ?? 200, 1), 1000);
    const result = await this.agent.logs(auth.baseUrl, auth.token, {
      service: input.service,
      tail,
    });

    console.info("[BackofficeBotHostUseCase][fetchLogs]", {
      profileId: access.profileId,
      service: input.service,
      tail,
      ok: result.ok,
      lineCount: result.lines?.length ?? 0,
    });

    return new Output(
      result.ok,
      result.ok ? ["Logs obtidos"] : [],
      result.ok ? [] : [result.error ?? "Falha ao obter logs"],
      result.ok
        ? {
            service: result.service ?? input.service,
            lines: result.lines ?? [],
            fetchedAt: result.fetchedAt ?? new Date().toISOString(),
          }
        : null
    );
  }

  async applyEnv(access: { profileId: string; fullAccess: boolean }) {
    const denied = requireMaster(access.fullAccess);
    if (denied) return denied;

    const auth = await this.resolveAgentAuth();
    if (!auth.ok) return auth.output;

    const settings = await this.repo.getOrCreateSettings();
    const n8nEnv = decryptHostEnvMap(settings.n8nEnvEncrypted);
    const evolutionEnv = decryptHostEnvMap(settings.evolutionEnvEncrypted);

    const job = await this.repo.createJob({
      type: "APPLY_ENV",
      requestedByProfileId: access.profileId,
      payload: {
        n8nKeys: Object.keys(n8nEnv),
        evolutionKeys: Object.keys(evolutionEnv),
      },
    });
    await this.repo.updateJob(job.id, { status: "running", startedAt: new Date() });

    const result = await this.agent.applyEnv(auth.baseUrl, auth.token, {
      n8nEnv,
      evolutionEnv,
      recreateServices: ["n8n", "api"],
    });

    await this.repo.updateSettings(settings.id, {
      lastAppliedAt: new Date(),
      lastApplyStatus: result.ok ? "succeeded" : "failed",
      lastApplyError: result.error ?? null,
    });
    await this.repo.updateJob(job.id, {
      status: result.ok ? "succeeded" : "failed",
      result: result.detail as object | undefined,
      errorMessage: result.error ?? null,
      finishedAt: new Date(),
    });

    return new Output(
      result.ok,
      result.ok ? ["Env aplicado na VPS"] : [],
      result.ok ? [] : [result.error ?? "Falha ao aplicar env"],
      { jobId: job.id, detail: result.detail }
    );
  }

  async restart(
    service: "n8n" | "api" | "all",
    access: { profileId: string; fullAccess: boolean }
  ) {
    const denied = requireMaster(access.fullAccess);
    if (denied) return denied;

    const auth = await this.resolveAgentAuth();
    if (!auth.ok) return auth.output;

    const job = await this.repo.createJob({
      type: "RESTART_SERVICE",
      requestedByProfileId: access.profileId,
      payload: { service },
    });
    await this.repo.updateJob(job.id, { status: "running", startedAt: new Date() });

    const result = await this.agent.restart(auth.baseUrl, auth.token, { service });
    await this.repo.updateJob(job.id, {
      status: result.ok ? "succeeded" : "failed",
      result: result.detail as object | undefined,
      errorMessage: result.error ?? null,
      finishedAt: new Date(),
    });

    return new Output(
      result.ok,
      result.ok ? [`Restart ${service} solicitado`] : [],
      result.ok ? [] : [result.error ?? "Falha no restart"],
      { jobId: job.id, detail: result.detail }
    );
  }

  async importWorkflows(access: { profileId: string; fullAccess: boolean }) {
    const denied = requireMaster(access.fullAccess);
    if (denied) return denied;

    const auth = await this.resolveAgentAuth();
    if (!auth.ok) return auth.output;

    const job = await this.repo.createJob({
      type: "IMPORT_WORKFLOWS",
      requestedByProfileId: access.profileId,
    });
    await this.repo.updateJob(job.id, { status: "running", startedAt: new Date() });

    const result = await this.agent.importWorkflows(auth.baseUrl, auth.token);
    await this.repo.updateJob(job.id, {
      status: result.ok ? "succeeded" : "failed",
      result: result.detail as object | undefined,
      errorMessage: result.error ?? null,
      finishedAt: new Date(),
    });

    return new Output(
      result.ok,
      result.ok ? ["Workflows importados"] : [],
      result.ok ? [] : [result.error ?? "Falha ao importar workflows"],
      { jobId: job.id, detail: result.detail }
    );
  }

  async resyncBethaniaWebhook(
    input: { confirm: boolean },
    access: { profileId: string; fullAccess: boolean }
  ) {
    const denied = requireMaster(access.fullAccess);
    if (denied) return denied;

    const settings = await this.repo.getOrCreateSettings();
    const n8nEnv = decryptHostEnvMap(settings.n8nEnvEncrypted);
    const instanceName = resolveBethaniaInstanceName(n8nEnv);
    const webhookUrl = resolveBethaniaWebhookUrl(n8nEnv);

    if (!input.confirm) {
      return new Output(true, ["Pré-visualização do webhook Bethânia"], [], {
        mode: "dry-run" as const,
        instanceName,
        webhookUrl,
        ok: true,
      });
    }

    console.info("[BackofficeBotHostUseCase][resyncBethaniaWebhook]", {
      profileId: access.profileId,
      instanceName,
      webhookUrl,
    });

    try {
      await backofficeEvoApiService.setWebhook({ instanceName, webhookUrl });
      return new Output(true, ["Webhook Bethânia reaplicado"], [], {
        mode: "apply" as const,
        instanceName,
        webhookUrl,
        ok: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao reaplicar webhook";
      console.error("[BackofficeBotHostUseCase][resyncBethaniaWebhook]", error);
      return new Output(false, [], [message], {
        mode: "apply" as const,
        instanceName,
        webhookUrl,
        ok: false,
        error: message,
      });
    }
  }

  async syncHost(
    input: { version: string; packBase64: string; packSha256: string },
    access: { profileId: string; fullAccess: boolean }
  ) {
    const denied = requireMaster(access.fullAccess);
    if (denied) return denied;

    const auth = await this.resolveAgentAuth();
    if (!auth.ok) return auth.output;

    const actualSha = createHash("sha256")
      .update(Buffer.from(input.packBase64, "base64"))
      .digest("hex");
    try {
      const ok = timingSafeEqual(
        Buffer.from(actualSha, "hex"),
        Buffer.from(input.packSha256, "hex")
      );
      if (!ok) {
        return new Output(false, [], ["SHA-256 do pack inválido"], null);
      }
    } catch {
      return new Output(false, [], ["SHA-256 do pack inválido"], null);
    }

    const settings = await this.repo.getOrCreateSettings();
    const job = await this.repo.createJob({
      type: "SYNC_HOST",
      requestedByProfileId: access.profileId,
      payload: { version: input.version, packSha256: input.packSha256 },
    });
    await this.repo.updateJob(job.id, { status: "running", startedAt: new Date() });

    const result = await this.agent.syncHost(auth.baseUrl, auth.token, input);
    if (result.ok) {
      await this.repo.updateSettings(settings.id, {
        desiredHostVersion: input.version,
        appliedHostVersion: input.version,
        lastAppliedAt: new Date(),
        lastApplyStatus: "succeeded",
        lastApplyError: null,
      });
    } else {
      await this.repo.updateSettings(settings.id, {
        lastApplyStatus: "failed",
        lastApplyError: result.error ?? "sync failed",
      });
    }

    await this.repo.updateJob(job.id, {
      status: result.ok ? "succeeded" : "failed",
      result: result.detail as object | undefined,
      errorMessage: result.error ?? null,
      finishedAt: new Date(),
    });

    return new Output(
      result.ok,
      result.ok ? ["Host sincronizado"] : [],
      result.ok ? [] : [result.error ?? "Falha no sync do host"],
      { jobId: job.id, detail: result.detail }
    );
  }

  private async resolveAgentAuth(): Promise<
    | { ok: true; baseUrl: string; token: string; output?: never }
    | { ok: false; output: Output; baseUrl?: never; token?: never }
  > {
    const settings = await this.repo.getOrCreateSettings();
    const baseUrl = settings.agentBaseUrl?.trim();
    if (!baseUrl) {
      return {
        ok: false,
        output: new Output(false, [], ["agentBaseUrl não configurado"], null),
      };
    }

    const tokenFromMemory = agentTokenPlainBySettingsId.get(settings.id);
    const tokenFromEnv = process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN?.trim();
    const token = tokenFromMemory || tokenFromEnv;
    if (!token || !settings.agentTokenHash) {
      return {
        ok: false,
        output: new Output(
          false,
          [],
          [
            "Token do agente indisponível. Gere um novo token no painel e configure BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN na Vercel (ou use o token retornado nesta sessão).",
          ],
          null
        ),
      };
    }

    if (hashAgentToken(token) !== settings.agentTokenHash) {
      return {
        ok: false,
        output: new Output(false, [], ["Token do agente não confere com o hash salvo"], null),
      };
    }

    return { ok: true, baseUrl, token };
  }
}

export const backofficeBotHostUseCase = new BackofficeBotHostUseCase();

export type { AgentAuth };
