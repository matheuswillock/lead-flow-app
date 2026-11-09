/**
 * Roteiro da nutrição do lead até a reunião: o objetivo de cada contato, a dica para o SDR e a
 * mensagem sugerida (enviada do WhatsApp do próprio SDR). Contatos extras usam o roteiro "custom".
 */

export type NurtureStep = "2d" | "1d" | "1h" | "custom"

export type NurturePlaybookEntry = {
  title: string
  tip: string
  buildMessage: (input: { firstName: string; meetingLabel: string; sdrName: string }) => string
}

const signOff = (sdrName: string) => (sdrName.trim() ? `\n\n${sdrName.trim()}` : "")

export const MEETING_NURTURE_PLAYBOOK: Record<NurtureStep, NurturePlaybookEntry> = {
  "2d": {
    title: "Gerar expectativa",
    tip: "Reforce o benefício da conversa e pergunte algo que mostre que você já está preparando a reunião (ex.: quem mais vai participar, operadora atual).",
    buildMessage: ({ firstName, meetingLabel, sdrName }) =>
      `Oi, ${firstName}! Tudo bem? Já estou preparando o estudo para a nossa reunião de ${meetingLabel}. ` +
      `Para deixar tudo sob medida: hoje você já tem algum plano de saúde ou seria a primeira contratação?${signOff(sdrName)}`,
  },
  "1d": {
    title: "Confirmar presença",
    tip: "Confirme dia e horário e peça um \"ok\". Se a pessoa não puder, ofereça remarcar na hora em vez de perder a reunião.",
    buildMessage: ({ firstName, meetingLabel, sdrName }) =>
      `Oi, ${firstName}! Passando para confirmar nossa reunião de ${meetingLabel}. ` +
      `Pode me responder com um "ok"? Se precisar mudar o horário, me avisa que a gente ajusta.${signOff(sdrName)}`,
  },
  "1h": {
    title: "Lembrete final",
    tip: "Mensagem curta, com o link ou o local da reunião. O objetivo é só evitar o esquecimento.",
    buildMessage: ({ firstName, meetingLabel, sdrName }) =>
      `${firstName}, nossa reunião é daqui a pouco (${meetingLabel}). Já está tudo pronto por aqui, até já!${signOff(sdrName)}`,
  },
  custom: {
    title: "Contato extra",
    tip: "Use para manter o lead aquecido: mande um conteúdo útil, tire uma dúvida ou relembre o motivo da reunião.",
    buildMessage: ({ firstName, meetingLabel, sdrName }) =>
      `Oi, ${firstName}! Separei algumas informações que vão deixar nossa conversa de ${meetingLabel} ainda mais produtiva. ` +
      `Posso te mandar por aqui?${signOff(sdrName)}`,
  },
}

/** Contato extra do SDR: a chave guarda o horário escolhido para não duplicar. */
export const CUSTOM_NURTURE_PREFIX = "custom:"

export function customNurtureKey(dueAtIso: string): string {
  return `${CUSTOM_NURTURE_PREFIX}${dueAtIso}`
}

export function nurtureStepOf(offsetKey: string): NurtureStep {
  if (offsetKey === "2d" || offsetKey === "1d" || offsetKey === "1h") return offsetKey
  return "custom"
}
