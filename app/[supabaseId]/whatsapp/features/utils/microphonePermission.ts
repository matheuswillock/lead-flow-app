export type MicrophoneErrorCode = "NotAllowedError" | "NotFoundError" | "NotSupportedError" | "Unknown"

export class MicrophoneAccessError extends Error {
  readonly code: MicrophoneErrorCode

  constructor(message: string, code: MicrophoneErrorCode) {
    super(message)
    this.name = "MicrophoneAccessError"
    this.code = code
  }
}

export const MICROPHONE_PERMISSION_DENIED_MESSAGE =
  "Permissão de microfone negada. Use o botão abaixo para solicitar acesso ou altere a permissão nas configurações do navegador."

export const MICROPHONE_PERMISSION_PROMPT_MESSAGE =
  "Para gravar áudio, permita o acesso ao microfone do seu dispositivo."

const MICROPHONE_NOT_FOUND_MESSAGE = "Nenhum microfone encontrado no dispositivo."

const MICROPHONE_INSECURE_CONTEXT_MESSAGE =
  "Gravação de áudio requer conexão segura (HTTPS)."

const MICROPHONE_GENERIC_ERROR_MESSAGE = "Não foi possível acessar o microfone."

export function isMicrophoneSupported(): boolean {
  if (typeof window === "undefined") return false
  if (!window.isSecureContext) return false
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

export function getMicrophoneUnsupportedMessage(): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return MICROPHONE_INSECURE_CONTEXT_MESSAGE
  }
  return MICROPHONE_GENERIC_ERROR_MESSAGE
}

export async function queryMicrophonePermission(): Promise<PermissionState | null> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return null
  }

  try {
    const result = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    })
    return result.state
  } catch {
    return null
  }
}

export function mapMicrophoneError(error: unknown): MicrophoneAccessError {
  if (!isMicrophoneSupported()) {
    return new MicrophoneAccessError(getMicrophoneUnsupportedMessage(), "NotSupportedError")
  }

  const name = error instanceof DOMException ? error.name : "Unknown"

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return new MicrophoneAccessError(MICROPHONE_PERMISSION_DENIED_MESSAGE, "NotAllowedError")
    case "NotFoundError":
    case "DevicesNotFoundError":
      return new MicrophoneAccessError(MICROPHONE_NOT_FOUND_MESSAGE, "NotFoundError")
    case "NotSupportedError":
    case "SecurityError":
      return new MicrophoneAccessError(MICROPHONE_INSECURE_CONTEXT_MESSAGE, "NotSupportedError")
    default:
      return new MicrophoneAccessError(MICROPHONE_GENERIC_ERROR_MESSAGE, "Unknown")
  }
}

export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (!isMicrophoneSupported()) {
    throw new MicrophoneAccessError(getMicrophoneUnsupportedMessage(), "NotSupportedError")
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (error) {
    throw mapMicrophoneError(error)
  }
}
