import type { IBackofficeEmailUnsubscribeService } from "../services/IBackofficeEmailUnsubscribeService"
import { backofficeEmailUnsubscribeService } from "../services/BackofficeEmailUnsubscribeService"
import type { BackofficeEmailUnsubscribeState } from "./BackofficeEmailUnsubscribeTypes"

export function createInitialBackofficeEmailUnsubscribeState(
  token: string
): BackofficeEmailUnsubscribeState {
  return {
    token,
    loading: true,
    confirming: false,
    info: null,
    completed: false,
    error: null,
  }
}

export async function loadBackofficeEmailUnsubscribeInfo(
  service: IBackofficeEmailUnsubscribeService,
  token: string
): Promise<Pick<BackofficeEmailUnsubscribeState, "info" | "error" | "completed">> {
  const response = await service.getInfo(token)
  if (!response.isValid || !response.result) {
    return { info: null, error: "Link inválido ou expirado", completed: false }
  }

  const info = response.result as BackofficeEmailUnsubscribeState["info"]
  if (info?.alreadyUnsubscribed) {
    return { info, error: null, completed: true }
  }

  return { info, error: null, completed: false }
}

export async function confirmBackofficeEmailUnsubscribe(
  service: IBackofficeEmailUnsubscribeService,
  token: string
): Promise<Pick<BackofficeEmailUnsubscribeState, "completed" | "error">> {
  const response = await service.unsubscribe(token)
  if (!response.isValid) {
    return {
      completed: false,
      error: response.errorMessages[0] ?? "Não foi possível concluir o descadastro",
    }
  }
  return { completed: true, error: null }
}

export const defaultBackofficeEmailUnsubscribeService = backofficeEmailUnsubscribeService
