export interface FeatureData {
  title: string
  description: string
  benefits?: string[]
  badge?: string
  size: "large" | "small"
}

export const FEATURES_SECTION_HEADING = "Tudo que você precisa para vender mais"
export const FEATURES_SECTION_SUBHEADING =
  "CRM completo com pipeline, Radar, campanhas de e-mail, agenda, métricas e gestão de equipe — tudo em um só lugar para sua corretora de saúde."

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
    title: "Radar",
    description:
      "Perfis unificados do CRM e da carteira, com segmentos prontos e customizados para alimentar campanhas de e-mail.",
    benefits: [
      "Perfis únicos com timeline e consentimento",
      "Segmentos prontos para renovação e engajamento",
      "Builder de segmentos sob medida",
      "Audiência dinâmica para campanhas",
    ],
    size: "large",
  },
  {
    title: "Campanhas de E-mail",
    description:
      "Campanhas segmentadas com templates, agendamento, analytics e audiência via lista CSV ou Radar.",
    benefits: [
      "Templates aprováveis",
      "Upload de listas via CSV",
      "Segmentos do Radar como audiência",
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
