import { BackofficeBotHostRepository } from "@/app/api/infra/data/repositories/backofficeBot/BackofficeBotHostRepository"
import { verifyAgentToken } from "@/lib/studio-bot/host-cipher"

const DEFAULT_OPS_BASE_URL = "https://ops.corretorstudio.com"

export type OpsAgentAuthConfig =
  | { ok: true; webhookUrl: string; token: string }
  | { ok: false; error: string }

function buildBackupRunUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "")
  if (normalized.endsWith("/backup/run")) {
    return normalized
  }
  return `${normalized}/backup/run`
}

function buildBackupDownloadUrl(runUrl: string): string {
  return runUrl.replace(/\/backup\/run\/?$/, "/backup/download")
}

export async function resolveOpsAgentAuthForBackup(): Promise<OpsAgentAuthConfig> {
  const repo = new BackofficeBotHostRepository()
  const settings = await repo.getOrCreateSettings()

  const token =
    process.env.BACKUP_VPS_TOKEN?.trim() ||
    process.env.BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN?.trim()

  if (!token) {
    return {
      ok: false,
      error:
        "Token de backup não configurado (BACKUP_VPS_TOKEN ou BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN)",
    }
  }

  if (!settings.agentTokenHash) {
    return {
      ok: false,
      error:
        "Token do agente Ops não foi configurado. Gere um token em Studio Bot > Ops e configure BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN na Vercel.",
    }
  }

  if (!verifyAgentToken(token, settings.agentTokenHash)) {
    return {
      ok: false,
      error:
        "Token do agente não confere com o cadastrado no backoffice. Atualize BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN na Vercel e OPS_AGENT_TOKEN na VPS com o mesmo valor (ou rotacione o token no painel Ops).",
    }
  }

  const webhookUrl =
    process.env.BACKUP_VPS_WEBHOOK_URL?.trim() ||
    (settings.agentBaseUrl?.trim()
      ? buildBackupRunUrl(settings.agentBaseUrl)
      : buildBackupRunUrl(DEFAULT_OPS_BASE_URL))

  return { ok: true, webhookUrl, token }
}

export function mapVpsUnauthorizedError(status: number, payloadError?: string): string {
  if (status === 401 || payloadError === "unauthorized") {
    return "Token rejeitado pela VPS (OPS_AGENT_TOKEN). Confirme que OPS_AGENT_TOKEN na VPS é idêntico ao BACKOFFICE_STUDIO_BOT_OPS_AGENT_TOKEN da Vercel. Se existir BACKUP_VPS_TOKEN na Vercel, remova-o ou alinhe ao mesmo valor."
  }
  return payloadError || `HTTP ${status}`
}

export { buildBackupDownloadUrl }
