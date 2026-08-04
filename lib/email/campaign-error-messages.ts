/**
 * Converte mensagens técnicas de erro da API de e-mail em mensagens amigáveis em português.
 * Erros técnicos são logados no console com todos os detalhes; apenas mensagens amigáveis
 * chegam ao frontend.
 */

const FRIENDLY_ERROR_MAP: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /idempoten(cy|t)/i,
    message:
      "Este lote já foi processado recentemente. Aguarde 24 horas ou tente reenviar com novos destinatários.",
  },
  {
    pattern: /rate[\s_-]?limit|too many requests|429/i,
    message: "Limite de envio atingido. Tente novamente em alguns minutos.",
  },
  {
    pattern: /5\d{2}|server error|internal error|service unavailable/i,
    message: "Erro temporário no serviço de e-mail. Tente reenviar o lote.",
  },
  {
    pattern: /authentication|unauthorized|forbidden|401|403/i,
    message: "Falha de autenticação com o serviço de e-mail. Verifique as configurações.",
  },
]

const FALLBACK_MESSAGE = "Falha no envio deste lote. Tente reenviar."

/**
 * Retorna uma mensagem amigável para exibir ao usuário.
 * Se o erro técnico bater em algum padrão conhecido, retorna a mensagem mapeada.
 * Caso contrário retorna a mensagem padrão de fallback.
 */
export function toFriendlyDispatchErrorMessage(technicalMessage: string | null | undefined): string {
  if (!technicalMessage) return FALLBACK_MESSAGE

  for (const { pattern, message } of FRIENDLY_ERROR_MAP) {
    if (pattern.test(technicalMessage)) return message
  }

  return FALLBACK_MESSAGE
}

/**
 * Verifica se a mensagem já é uma mensagem amigável (não técnica) do sistema.
 * Usada para evitar dupla transformação de mensagens já tratadas pelo backend.
 */
export function isAlreadyFriendlyMessage(message: string): boolean {
  return (
    message.startsWith("Limite de envio") ||
    message.startsWith("Erro temporário") ||
    message.startsWith("Falha no envio") ||
    message.startsWith("Este lote já foi processado") ||
    message.startsWith("Falha de autenticação") ||
    message.startsWith("Nenhum e-mail foi enviado") ||
    message.startsWith("Template sem HTML") ||
    message.startsWith("Sem assinatura") ||
    message.startsWith("Nenhum contato") ||
    message.startsWith("Nenhum perfil") ||
    message.startsWith("Disparo interrompido") ||
    message.startsWith("Variáveis sem valor")
  )
}
