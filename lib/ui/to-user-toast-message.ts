import { toast, type ExternalToast } from "sonner";
import { isApiRequestError } from "@/lib/http/api-request-error";

export const USER_TOAST_GENERIC_ERROR = "Ocorreu um erro.";

const TECHNICAL_SUBSTRINGS = [
  "json.parse",
  "syntaxerror",
  "prisma",
  "function_payload",
  "request entity too large",
  "payload too large",
  "entity too large",
  "fetch failed",
  "failed to fetch",
  "unexpected character",
  "unexpected token",
  "typeerror",
  "referenceerror",
  "cannot read properties",
  "cannot read property",
  "is not a function",
  "is not defined",
  "econnrefused",
  "enotfound",
  "etimedout",
  "networkerror",
  "unique constraint",
  "foreign key constraint",
  "invalid `prisma",
  "invalid prisma",
  "invocation in",
  "node_modules",
  "internal server error",
  "status code 5",
  "http 413",
  "413 payload",
] as const;

const PRODUCT_PORTUGUESE_MARKERS = [
  "não",
  "nao ",
  "erro ao",
  "falha ao",
  "falha no",
  "ocorreu um",
  "tente novamente",
  "já existe",
  "ja existe",
  "selecione",
  "informe",
  "não foi",
  "nao foi",
  "inválid",
  "obrigatór",
  "revise",
  "preencha",
  "mapeie",
  "nenhuma ",
  "usuário",
  "usuario",
] as const;

const PRISMA_ERROR_CODE = /\bP2\d{3}\b/;
const STACK_FRAME = /\n\s+at\s+/;

function readErrorText(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    const name = error.name && error.name !== "Error" ? error.name : "";
    const code =
      "code" in error && typeof error.code === "string" ? error.code : "";
    return [name, error.message, code].filter(Boolean).join(" ");
  }

  if (error && typeof error === "object") {
    if ("message" in error && typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }
    if (
      "errorMessages" in error &&
      Array.isArray(error.errorMessages) &&
      typeof error.errorMessages[0] === "string"
    ) {
      return error.errorMessages[0];
    }
  }

  return "";
}

function hasTechnicalErrorSignal(text: string): boolean {
  const normalized = text.toLowerCase();
  if (PRISMA_ERROR_CODE.test(text)) {
    return true;
  }
  if (STACK_FRAME.test(text)) {
    return true;
  }
  return TECHNICAL_SUBSTRINGS.some((token) => normalized.includes(token));
}

function hasProductPortugueseCopy(text: string): boolean {
  if (/[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(text)) {
    return true;
  }
  const normalized = text.toLowerCase();
  return PRODUCT_PORTUGUESE_MARKERS.some((marker) => normalized.includes(marker));
}

export function toUserToastMessage(error: unknown): string {
  const text = readErrorText(error).trim();
  if (!text) {
    return USER_TOAST_GENERIC_ERROR;
  }
  if (hasTechnicalErrorSignal(text)) {
    return USER_TOAST_GENERIC_ERROR;
  }
  if (hasProductPortugueseCopy(text)) {
    return text;
  }
  return USER_TOAST_GENERIC_ERROR;
}

export function toastUserError(error: unknown, data?: ExternalToast): void {
  if (!isApiRequestError(error)) {
    console.error(error);
  }
  toast.error(toUserToastMessage(error), data);
}
