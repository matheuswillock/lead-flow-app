import { WebPushServiceWorkerNotReadyError } from "./client";

export type WebPushUserErrorAction = "enable" | "disable";

const ENABLE_FALLBACK =
  "Não foi possível ativar as notificações no navegador. Tente recarregar a página.";
const DISABLE_FALLBACK =
  "Não foi possível desativar as notificações no navegador. Tente recarregar a página.";

function getErrorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error && typeof error.name === "string") {
    return error.name;
  }
  return "";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "";
}

function includesAny(haystack: string, needles: string[]): boolean {
  const normalized = haystack.toLowerCase();
  return needles.some((needle) => normalized.includes(needle.toLowerCase()));
}

export function resolveWebPushUserErrorMessage(
  error: unknown,
  action: WebPushUserErrorAction,
): string {
  const fallback = action === "enable" ? ENABLE_FALLBACK : DISABLE_FALLBACK;
  const name = getErrorName(error);
  const message = getErrorMessage(error);
  const combined = `${name} ${message}`.trim();

  if (error instanceof WebPushServiceWorkerNotReadyError) {
    return "O navegador ainda está preparando as notificações. Aguarde alguns segundos, recarregue a página e tente novamente.";
  }

  if (
    includesAny(combined, [
      "no active service worker",
      "service worker not ready",
    ])
  ) {
    return "O navegador ainda está preparando as notificações. Aguarde alguns segundos, recarregue a página e tente novamente.";
  }

  if (
    includesAny(combined, [
      "serviceworker script evaluation failed",
      "failed to register a serviceworker",
    ])
  ) {
    return "Não foi possível carregar as notificações neste navegador. Recarregue a página e tente de novo.";
  }

  if (
    name === "NotAllowedError" ||
    includesAny(message, ["permission denied", "not allowed", "permissão"])
  ) {
    return "Permissão de notificações bloqueada. Libere nas configurações do navegador.";
  }

  if (
    includesAny(combined, [
      "vapid",
      "applicationserverkey",
      "public key",
      "chave pública",
    ])
  ) {
    return "Configuração de notificações indisponível no momento. Tente novamente mais tarde.";
  }

  if (includesAny(message, ["inscrição push inválida", "inscricao push invalida"])) {
    return "Não foi possível concluir a inscrição. Tente novamente.";
  }

  return fallback;
}
