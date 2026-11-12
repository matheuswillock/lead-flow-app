/**
 * Histórico de acesso de um usuário da conta: último login e os e-mails de acesso enviados a ele,
 * com o que aconteceu com cada um. Serve para o master/manager resolver sozinho o "não recebi o
 * e-mail" antes de pedir ajuda ao time de produto.
 */

/** Só e-mails de acesso entram no histórico: o master não vê e-mails de outras contas. */
export const ACCESS_HISTORY_CATEGORIES = ["access_invite", "access_reset", "operator_invite", "welcome"] as const
export type AccessHistoryCategory = (typeof ACCESS_HISTORY_CATEGORIES)[number]

export type AccessEmailDispatchStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"
  | "delivery_delayed"
  | "suppressed"

export type AccessHistoryEmail = {
  id: string
  category: AccessHistoryCategory
  recipientEmail: string
  status: AccessEmailDispatchStatus
  createdAt: string
  deliveredAt: string | null
  openedAt: string | null
  bouncedAt: string | null
}

export type TeamMemberAccessHistory = {
  email: string
  name: string
  /** null = a pessoa ainda não entrou na plataforma. */
  lastSignInAt: string | null
  emails: AccessHistoryEmail[]
}

export type AccessEmailTone = "success" | "warning" | "danger" | "neutral"

/** Situação de acesso de um usuário para o selo da tabela (uma linha por usuário). */
export type TeamMemberAccessSummary = {
  profileId: string
  lastSignInAt: string | null
  /** Último e-mail de acesso que esta conta enviou à pessoa. */
  lastEmail: { status: AccessEmailDispatchStatus; createdAt: string } | null
}

const UNDELIVERED: ReadonlySet<AccessEmailDispatchStatus> = new Set(["bounced", "complained", "suppressed", "failed"])

const SHORT_DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })

/**
 * Selo da coluna "Acesso": problema de entrega na frente (é o que pede ação), depois o último
 * acesso, depois "aguardando primeiro acesso".
 */
export function describeAccessSummary(summary: Pick<TeamMemberAccessSummary, "lastSignInAt" | "lastEmail">): {
  label: string
  tone: AccessEmailTone
} {
  const { lastEmail, lastSignInAt } = summary
  const emailAfterSignIn = !lastSignInAt || (lastEmail ? lastEmail.createdAt > lastSignInAt : false)
  if (lastEmail && UNDELIVERED.has(lastEmail.status) && emailAfterSignIn) {
    return { label: "E-mail não entregue", tone: "danger" }
  }
  if (lastSignInAt) {
    return { label: `Acessou em ${SHORT_DATE.format(new Date(lastSignInAt))}`, tone: "success" }
  }
  return { label: "Aguardando primeiro acesso", tone: "warning" }
}

export const ACCESS_EMAIL_KIND_LABEL: Readonly<Record<AccessHistoryCategory, string>> = {
  access_invite: "Primeiro acesso",
  operator_invite: "Primeiro acesso",
  access_reset: "Nova senha",
  welcome: "Boas-vindas",
}

/**
 * O que cada status significa para quem está tentando ajudar a pessoa a entrar: um rótulo curto
 * e, quando há algo a fazer, o próximo passo.
 */
export function describeAccessEmailStatus(status: AccessEmailDispatchStatus): {
  label: string
  tone: AccessEmailTone
  hint: string | null
} {
  switch (status) {
    case "clicked":
      return { label: "Link aberto", tone: "success", hint: null }
    case "opened":
      return { label: "Aberto", tone: "success", hint: null }
    case "delivered":
      return { label: "Entregue", tone: "success", hint: "Chegou na caixa de entrada. Se a pessoa não encontrar, peça para olhar o spam." }
    case "delivery_delayed":
      return { label: "Entrega atrasada", tone: "warning", hint: "O provedor da pessoa está segurando a mensagem. Costuma chegar em alguns minutos." }
    case "bounced":
      return { label: "Não entregue", tone: "danger", hint: "O endereço não existe ou recusou a mensagem. Confira o e-mail cadastrado." }
    case "complained":
      return { label: "Marcado como spam", tone: "danger", hint: "A pessoa marcou um e-mail nosso como spam. Peça para tirar da lista de spam e reenvie." }
    case "suppressed":
      return { label: "Bloqueado", tone: "danger", hint: "Este endereço recusou e-mails antes e foi bloqueado. Fale com o suporte para liberar." }
    case "failed":
      return { label: "Falhou", tone: "danger", hint: "O envio falhou. Tente reenviar." }
    case "queued":
    case "sent":
      return { label: "Enviado", tone: "neutral", hint: "Saiu daqui e está a caminho. Pode levar até 5 minutos." }
  }
}
