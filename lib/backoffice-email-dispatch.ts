export function getBackofficeEmailDispatchStatusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "Na fila"
    case "sent":
      return "Disparado"
    case "delivered":
      return "Entregue"
    case "opened":
      return "Aberto"
    case "clicked":
      return "Clicado"
    case "bounced":
      return "Recusado pelo provedor"
    case "complained":
      return "Marcado como spam"
    case "failed":
      return "Disparado com falha"
    case "delivery_delayed":
      return "Entrega atrasada"
    case "suppressed":
      return "Suprimido"
    default:
      return status
  }
}

export function getBackofficeEmailDispatchStatusBadgeClass(status: string): string {
  switch (status) {
    case "delivered":
    case "opened":
    case "clicked":
      return "border-semantic-success-border bg-semantic-success-surface text-semantic-success"
    case "sent":
    case "queued":
    case "delivery_delayed":
      return "border-semantic-info-border bg-semantic-info-surface text-semantic-info"
    case "failed":
    case "bounced":
    case "complained":
    case "suppressed":
      return "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger"
    default:
      return ""
  }
}

export function getBackofficeEmailRecipientKindLabel(kind: string): string {
  switch (kind) {
    case "account":
      return "Conta"
    case "google":
      return "Google"
    case "external":
      return "Externo"
    default:
      return kind
  }
}

export function getBackofficeEmailProviderLabel(provider: string): string {
  switch (provider) {
    case "resend":
      return "Resend"
    case "google_calendar":
      return "Google Calendar"
    default:
      return provider
  }
}

export function getBackofficeEmailCategoryLabel(category: string): string {
  switch (category) {
    case "access_invite":
      return "Convite de acesso"
    case "access_reset":
      return "Reset de senha"
    case "invoice_notification":
      return "Notificação de fatura"
    case "adhesion_invite":
      return "Convite de adesão"
    case "schedule_invite":
      return "Convite de agendamento"
    case "welcome":
      return "Boas-vindas"
    case "operator_invite":
      return "Convite de operador"
    case "meeting_invite":
      return "Convite de reunião"
    default:
      return "Outro"
  }
}
