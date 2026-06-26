export interface StepData {
  number: string
  title: string
  description: string
}

export const HOW_IT_WORKS_HEADING = "Como funciona o Corretor Studio"
export const HOW_IT_WORKS_SUBHEADING =
  "Um fluxo simples e visual para transformar leads em clientes de forma consistente."

export const howItWorksSteps: StepData[] = [
  {
    number: "01",
    title: "Capture Leads",
    description: "Adicione leads manualmente ou via integração com formulários externos.",
  },
  {
    number: "02",
    title: "Organize no Pipeline",
    description: "Leads aparecem no Kanban. Defina etapas: Novo, Contato, Proposta, Fechamento.",
  },
  {
    number: "03",
    title: "Agende Reuniões",
    description: "Marque reuniões direto do lead com integração ao Google Calendar.",
  },
  {
    number: "04",
    title: "Trabalhe em Times",
    description: "Separe operações por time, gerencie funções SDR/Closer por workspace.",
  },
  {
    number: "05",
    title: "Analise & Cresça",
    description: "Acompanhe métricas e indicadores para tomar decisões rápidas.",
  },
]
