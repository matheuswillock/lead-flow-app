export type EvoChannelErrorContext = "reconnect" | "disconnect" | "refresh";

const FALLBACK: Record<EvoChannelErrorContext, string> = {
  reconnect: "Erro ao reconectar canal",
  disconnect: "Erro ao desconectar canal WhatsApp",
  refresh: "Erro ao atualizar status da conexão",
};

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Maps Evolution API / network failures to actionable pt-BR messages for the backoffice UI.
 */
export function mapEvoChannelError(
  error: unknown,
  context: EvoChannelErrorContext = "reconnect"
): string {
  const message = errorText(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("webhook_instanceid_fkey") ||
    lower.includes("foreign key constraint") ||
    lower.includes("foreign key")
  ) {
    return "Instância WhatsApp inconsistente na Evolution. Delete a instância bethania (ver runbook) e tente conectar de novo.";
  }

  if (
    (lower.includes("does not exist") && lower.includes("instance")) ||
    (lower.includes("http 404") && lower.includes("instance"))
  ) {
    return "Instância bethania não existe na Evolution. Conecte de novo ou recrie a instância.";
  }

  if (lower.includes("already in use") || (lower.includes("http 403") && lower.includes("already"))) {
    return "Instância bethania já está em uso na Evolution. Tente conectar novamente em alguns segundos.";
  }

  if (lower.includes("qr code not available") || lower.includes("qrcode not available")) {
    return "QR ainda não disponível. Aguarde alguns segundos e tente novamente.";
  }

  if (
    lower.includes("econnrefused") ||
    lower.includes("fetch failed") ||
    lower.includes("network request failed") ||
    lower.includes("enotfound") ||
    lower.includes("etimedout")
  ) {
    return "Evolution inacessível. Verifique EVO_API_BASE_URL e se o serviço está no ar.";
  }

  return FALLBACK[context];
}
