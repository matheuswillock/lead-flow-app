"use client";

import { toast } from "sonner";

export type ManagerUsersOperation =
  | "loadUsers"
  | "createUser"
  | "updateUser"
  | "deleteUser"
  | "checkEmail"
  | "loadUserTeams"
  | "resendInvite"
  | "togglePermanentSubscription"
  | "deletePendingOperator"
  | "createPayment"
  | "checkPaymentStatus"
  | "confirmPayment"
  | "cancelPayment"
  | "copyCode"
  | "formValidation";

type ErrorInput = unknown | { errorMessages?: string[] };

interface NotifyOptions {
  operation: ManagerUsersOperation;
  error?: unknown;
  errorMessages?: string[];
  toastId?: string | number;
  context?: Record<string, unknown>;
}

interface LogPayload {
  operation: ManagerUsersOperation;
  rawMessage?: string;
  mappedMessage: string;
  context?: Record<string, unknown>;
}

const OPERATION_FALLBACK: Record<ManagerUsersOperation, string> = {
  loadUsers: "Não foi possível carregar os usuários.",
  createUser: "Não foi possível criar o usuário.",
  updateUser: "Não foi possível atualizar o usuário.",
  deleteUser: "Não foi possível remover o usuário.",
  checkEmail: "Não foi possível validar o e-mail.",
  loadUserTeams: "Não foi possível carregar os times do usuário.",
  resendInvite: "Não foi possível enviar o e-mail de reset.",
  togglePermanentSubscription: "Não foi possível alterar a assinatura permanente.",
  deletePendingOperator: "Não foi possível remover o operador pendente.",
  createPayment: "Não foi possível gerar o pagamento.",
  checkPaymentStatus: "Não foi possível verificar o pagamento.",
  confirmPayment: "Não foi possível confirmar o pagamento.",
  cancelPayment: "Não foi possível cancelar o pagamento.",
  copyCode: "Não foi possível copiar o código.",
  formValidation: "Verifique os campos obrigatórios.",
};

const ERROR_PATTERNS: Array<{ match: RegExp; message: string }> = [
  {
    match: /acesso negado|você só pode|header x-supabase-user-id|usuário não autenticado/i,
    message: "Você não tem permissão para realizar esta ação.",
  },
  {
    match: /user not authenticated|sessão expirada|session expired/i,
    message: "Sessão expirada. Faça login novamente.",
  },
  {
    match: /time não encontrado|usuário não encontrado|operador pendente não encontrado|registro não encontrado/i,
    message: "Registro não encontrado.",
  },
  {
    match: /email j[aá] est[aá] em uso/i,
    message: "Este e-mail já está em uso.",
  },
  {
    match: /apenas o master do time/i,
    message: "Apenas o master do time pode realizar esta ação.",
  },
  {
    match: /apenas o master pode|permissões delegadas|você não pode editar o master/i,
    message: "Você não tem permissão para realizar esta ação.",
  },
  {
    match: /forma de pagamento inv[aá]lida|forma de pagamento invalida/i,
    message: "Forma de pagamento inválida. Verifique os dados e tente novamente.",
  },
  {
    match: /dados do cart[aã]o/i,
    message: "Dados do cartão inválidos ou incompletos.",
  },
  {
    match: /nao foi possivel gerar o pagamento|não foi possível gerar o pagamento/i,
    message: "Não foi possível gerar o pagamento. Tente novamente.",
  },
  {
    match: /erro ao confirmar pagamento/i,
    message: "Não foi possível confirmar o pagamento. Tente novamente.",
  },
  {
    match: /nao foi possivel validar o pagamento|não foi possível validar o pagamento/i,
    message: "Não foi possível validar o pagamento.",
  },
  {
    match: /pagamento nao encontrado|pagamento não encontrado/i,
    message: "Pagamento não encontrado. Gere o pagamento novamente.",
  },
  {
    match: /id do operador pendente não encontrado/i,
    message: "Operador pendente não encontrado.",
  },
  {
    match: /selecione um time/i,
    message: "Selecione um time para continuar.",
  },
  {
    match: /não é possível deletar|nao e possivel deletar|não é possível remover/i,
    message: "Não é possível remover este usuário.",
  },
  {
    match: /fetch failed|network error|failed to fetch|timeout|tempo limite/i,
    message: "Falha de conexão. Verifique sua internet e tente novamente.",
  },
  {
    match: /erro interno do servidor|http error! status/i,
    message: "Erro inesperado. Tente novamente.",
  },
];

const SENSITIVE_KEYS = new Set([
  "email",
  "name",
  "fullName",
  "operatorEmail",
  "managerEmail",
  "userEmail",
]);

const LOG_ENDPOINT = "/api/v1/logs/client-error";

const extractRawMessage = (input?: ErrorInput, errorMessages?: string[]) => {
  const messageFromArray = errorMessages?.find((msg) => !!msg)?.trim();
  if (messageFromArray) return messageFromArray;

  if (typeof input === "string") return input.trim();

  if (input instanceof Error) return input.message?.trim() || "";

  if (input && typeof input === "object") {
    const typedInput = input as { errorMessages?: string[]; message?: string; error?: string; msg?: string };
    const fromMessages = typedInput.errorMessages?.find((msg) => !!msg)?.trim();
    if (fromMessages) return fromMessages;
    if (typedInput.message) return String(typedInput.message).trim();
    if (typedInput.error) return String(typedInput.error).trim();
    if (typedInput.msg) return String(typedInput.msg).trim();
  }

  return "";
};

const matchErrorMessage = (rawMessage: string) => {
  if (!rawMessage) return null;
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.match.test(rawMessage)) {
      return pattern.message;
    }
  }
  return null;
};

const sanitizeContext = (context?: Record<string, unknown>) => {
  if (!context || typeof context !== "object") return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    sanitized[key] = value;
  }
  return Object.keys(sanitized).length ? sanitized : undefined;
};

export const mapManagerUsersError = (
  input: ErrorInput,
  operation: ManagerUsersOperation,
  errorMessages?: string[]
) => {
  const rawMessage = extractRawMessage(input, errorMessages);
  const mappedMessage = matchErrorMessage(rawMessage);
  if (mappedMessage) return mappedMessage;
  return OPERATION_FALLBACK[operation] || "Ocorreu um erro inesperado.";
};

export const logManagerUsersError = ({ operation, rawMessage, mappedMessage, context }: LogPayload) => {
  if (typeof window === "undefined") return;

  const payload = {
    operation,
    rawMessage: rawMessage || undefined,
    mappedMessage,
    url: window.location.href,
    userAgent: navigator?.userAgent,
    timestamp: new Date().toISOString(),
    context: sanitizeContext(context),
  };

  const body = JSON.stringify(payload);

  try {
    if (navigator?.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(LOG_ENDPOINT, blob);
      return;
    }
  } catch {
    // fall through to fetch
  }

  fetch(LOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // ignore logging errors
  });
};

export const notifyManagerUsersError = ({
  operation,
  error,
  errorMessages,
  toastId,
  context,
}: NotifyOptions) => {
  const rawMessage = extractRawMessage(error ?? null, errorMessages);
  const mappedMessage = matchErrorMessage(rawMessage) || OPERATION_FALLBACK[operation];

  if (toastId !== undefined) {
    toast.error(mappedMessage, { id: toastId });
  } else {
    toast.error(mappedMessage);
  }

  logManagerUsersError({
    operation,
    rawMessage,
    mappedMessage,
    context,
  });

  return mappedMessage;
};
