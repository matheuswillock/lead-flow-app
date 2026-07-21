export interface FeatureData {
  title: string
  description: string
  benefits?: string[]
  badge?: string
  size: "large" | "small"
}

export const FEATURES_SECTION_HEADING = "Tudo que você precisa para vender mais"
export const FEATURES_SECTION_SUBHEADING =
  "CRM completo com pipeline, agenda, métricas e gestão de equipe — tudo em um só lugar para sua corretora de saúde."

export const featuresData: FeatureData[] = [
  {
    title: "Pipeline Kanban + Tabela",
    description:
      "Organize o funil com duas visões: Kanban para mover etapas e tabela para revisar todos os leads.",
    benefits: [
      "Arraste e solte por etapa",
      "Visão em lista com filtros rápidos",
      "Status e responsáveis sempre visíveis",
      "Detalhes completos do lead em um clique",
    ],
    size: "large",
  },
  {
    title: "Calendário & Reuniões",
    description: "Agenda diária/semanal com agendamentos integrados ao Google Calendar.",
    size: "small",
  },
  {
    title: "Times / Workspaces",
    description: "Separe operações por time e alterne o workspace ativo com um clique.",
    size: "small",
  },
  {
    title: "Campanhas de E-mail",
    description:
      "Em breve: campanhas segmentadas para listas de contatos com editor visual, agendamento automático e analytics detalhados.",
    badge: "Em breve",
    benefits: [
      "Editor visual drag-and-drop (Maily)",
      "Upload de listas via CSV",
      "Agendamento de disparos",
      "Métricas de abertura, clique e entrega",
    ],
    size: "large",
  },
  {
    title: "Dashboard & Métricas",
    description: "KPIs, gráficos e indicadores para acompanhar a performance da equipe.",
    size: "small",
  },
  {
    title: "Gestão de Operadores",
    description: "Cadastre operadores, defina funções (SDR/Closer) e controle acessos.",
    size: "small",
  },
  {
    title: "Anexos por Lead",
    description: "Guarde contratos, imagens e documentos junto ao lead com acesso direto.",
    size: "small",
  },
]
