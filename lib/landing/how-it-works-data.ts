export interface StepData {
  number: string
  title: string
  description: string
}

export const HOW_IT_WORKS_HEADING = "Como funciona o Corretor Studio"
export const HOW_IT_WORKS_SUBHEADING =
  "Do lead ao e-mail certo: um fluxo visual para converter com consistência."

export const howItWorksSteps: StepData[] = [
  {
    number: "01",
    title: "Capture leads",
    description: "Cadastre manualmente, importe planilha ou receba leads por formulários e integrações.",
  },
  {
    number: "02",
    title: "Organize no pipeline",
    description: "Leads no Kanban e na tabela. Etapas claras: Novo, Contato, Proposta, Fechamento.",
  },
  {
    number: "03",
    title: "Unifique no Radar",
    description: "CRM e carteira viram perfis únicos. Segmente quem está apto, perto da renovação ou frio.",
  },
  {
    number: "04",
    title: "Dispare campanhas",
    description: "Escolha um segmento do Radar ou uma lista CSV, agende e envie sem sair da plataforma.",
  },
  {
    number: "05",
    title: "Analise e cresça",
    description: "Abertura, clique, entrega e indicadores do time — decida o próximo movimento com dados.",
  },
]
