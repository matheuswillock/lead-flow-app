import type { IEmailUnsubscribeService } from "../services/IEmailUnsubscribeService"
import { emailUnsubscribeService } from "../services/EmailUnsubscribeService"
import type { EmailUnsubscribeState } from "./EmailUnsubscribeTypes"

export function createInitialEmailUnsubscribeState(token: string): EmailUnsubscribeState {
  return {
    token,
    loading: true,
    confirming: false,
    info: null,
    completed: false,
    error: null,
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
  if (info?.alreadyUnsubscribed) {
    return { info, error: null, completed: true }
  }

  return { info, error: null, completed: false }
}

export async function confirmEmailUnsubscribe(
  service: IEmailUnsubscribeService,
  token: string
): Promise<Pick<EmailUnsubscribeState, "completed" | "error">> {
  const response = await service.unsubscribe(token)
  if (!response.isValid) {
    return {
      completed: false,
      error: response.errorMessages[0] ?? "Não foi possível concluir o descadastro",
    }
  }
  return { completed: true, error: null }
}

export const defaultEmailUnsubscribeService = emailUnsubscribeService
