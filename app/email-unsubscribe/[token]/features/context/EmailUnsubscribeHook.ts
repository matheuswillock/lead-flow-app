import type { IEmailUnsubscribeService } from "../services/IEmailUnsubscribeService"
import { emailUnsubscribeService } from "../services/EmailUnsubscribeService"
import type { EmailUnsubscribeScope, EmailUnsubscribeState } from "./EmailUnsubscribeTypes"
import { confirmUnsubscribeAction } from "../actions/confirmUnsubscribeAction"

export function createInitialEmailUnsubscribeState(token: string): EmailUnsubscribeState {
  return {
    token,
    loading: true,
    confirming: false,
    info: null,
    completed: false,
    error: null,
    removeFromCampaign: true,
    removeFromAll: false,
  }
}

export async function loadEmailUnsubscribeInfo(
  service: IEmailUnsubscribeService,
  token: string
): Promise<Pick<EmailUnsubscribeState, "info" | "error" | "completed">> {
  const response = await service.getInfo(token)
  if (!response.isValid || !response.result) {
    return { info: null, error: "Link inválido ou expirado", completed: false }
  }

  const info = response.result as EmailUnsubscribeState["info"]
  if (info?.alreadyUnsubscribed || info?.alreadyBlocked) {
    return { info, error: null, completed: true }
  }

  return { info, error: null, completed: false }
}

export async function confirmEmailUnsubscribe(
  _service: IEmailUnsubscribeService,
  token: string,
  scope: EmailUnsubscribeScope
): Promise<Pick<EmailUnsubscribeState, "completed" | "error">> {
  const result = await confirmUnsubscribeAction(token, scope)
  if (!result.success) {
    return {
      completed: false,
      error: result.errorMessage ?? "Não foi possível concluir o descadastro",
    }
  }
  return { completed: true, error: null }
}

export const defaultEmailUnsubscribeService = emailUnsubscribeService
