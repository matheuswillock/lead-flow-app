export interface EmailBenefitData {
  title: string
  description: string
}

export const EMAIL_SPOTLIGHT_HEADING = "Campanhas de e-mail com o Radar no comando"
export const EMAIL_SPOTLIGHT_SUBHEADING =
  "Crie, agende e meça campanhas sem sair do Corretor Studio — com audiência vinda do Radar ou de listas CSV."

export const emailBenefitsData: EmailBenefitData[] = [
  {
    title: "Templates aprováveis",
    description: "Crie e-mails profissionais com editor HTML e fluxo de aprovação do time.",
  },
  {
    title: "Listas CSV ou segmentos do Radar",
    description: "Importe contatos ou dispare para audiência dinâmica unificada do CRM e da carteira.",
  },
  {
    title: "Agendamento automático",
    description: "Defina data e hora de disparo e o sistema envia no momento certo.",
  },
  {
    title: "Métricas de abertura, clique e entrega",
    description: "Acompanhe a performance de cada campanha e ajuste o próximo envio.",
  },
]
