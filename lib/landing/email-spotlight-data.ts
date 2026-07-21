export interface EmailBenefitData {
  title: string
  description: string
}

export const EMAIL_SPOTLIGHT_HEADING = "Campanhas de e-mail em breve no CRM"
export const EMAIL_SPOTLIGHT_SUBHEADING =
  "Estamos finalizando o módulo para você criar, agendar e medir campanhas sem sair do Corretor Studio."

export const emailBenefitsData: EmailBenefitData[] = [
  {
    title: "Templates com editor visual drag-and-drop",
    description: "Crie emails profissionais com o editor Maily ou diretamente em HTML.",
  },
  {
    title: "Importe listas de contatos via CSV",
    description: "Gerencie múltiplas listas, rastreie cancelamentos e bounces automaticamente.",
  },
  {
    title: "Programe campanhas com agendamento automático",
    description: "Defina data e hora de disparo e o sistema envia no momento certo.",
  },
  {
    title: "Métricas de abertura, clique e entrega em tempo real",
    description: "Acompanhe a performance de cada campanha com dashboard detalhado.",
  },
]
