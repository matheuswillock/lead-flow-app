export type FeaturePanel = {
  id: string
  navLabel: string
  eyebrow: string
  title: string
  description: string
  bullets: string[]
  cta: string
  image: string
  imageAlt: string
  windowTitle: string
  colorClass: string
  accentClass: string
  hasCrmToggle?: boolean
  /** Preview HTML estático quando ainda não há screenshot do produto. */
  preview?: "radar"
}

export const featurePanelsData: FeaturePanel[] = [
  {
    id: "crm",
    navLabel: "CRM",
    eyebrow: "CRM Pipeline e Kanban",
    title: "Cada lead no lugar certo, do primeiro contato ao fechamento",
    description:
      "Um funil visual que a sua equipe realmente usa. Arraste cards entre etapas, veja o valor de cada negócio e nunca perca um follow-up.",
    bullets: [
      "Pipeline e kanban com etapas claras e objetivas",
      "Histórico, anexos e agendamentos por lead",
      "Status e responsáveis sempre visíveis",
    ],
    cta: "Ver o CRM na prática",
    image: "/images/landing/crm.webp",
    imageAlt: "Tela do CRM com pipeline de leads em tabela",
    windowTitle: "Pipeline · CRM",
    colorClass: "landing-feature-panel--orange",
    accentClass: "landing-feature-accent--orange",
    hasCrmToggle: true,
  },
  {
    id: "carteira",
    navLabel: "Carteira",
    eyebrow: "Carteira e Resultados",
    title: "Enxergue sua carteira e o que ela gera, em tempo real",
    description:
      "Acompanhe vidas, planos e receita recorrente. Saiba de onde vêm os fechamentos e onde investir seu tempo.",
    bullets: [
      "Acompanhe o valor da sua carteira em tempo real",
      "Receba alertas quando clientes mudarem de faixa etária",
      "Seja notificado sobre o fim da carência dos clientes e mantenha um atendimento proativo",
    ],
    cta: "Ver resultados",
    image: "/images/landing/carteira.webp",
    imageAlt: "Tela de Carteira com KPIs e clientes",
    windowTitle: "Carteira",
    colorClass: "landing-feature-panel--coral",
    accentClass: "landing-feature-accent--coral",
  },
  {
    id: "radar",
    navLabel: "Radar",
    eyebrow: "Radar",
    title: "Saiba quem merece o próximo e-mail — antes da concorrência",
    description:
      "O Radar une CRM, carteira e histórico de e-mail em perfis únicos. Monte segmentos prontos ou sob medida e dispare campanhas para quem realmente pode fechar.",
    bullets: [
      "Perfis unificados com timeline e consentimento por canal",
      "Segmentos prontos: aptos, renovação, abriram e não clicaram",
      "Builder de segmentos custom para a sua operação",
      "Audiência dinâmica ligada às campanhas de e-mail",
    ],
    cta: "Ver o Radar na prática",
    image: "/images/landing/campanhas.webp",
    imageAlt: "Segmentos do Radar com audiência para campanhas de e-mail",
    windowTitle: "Radar · Segmentos",
    colorClass: "landing-feature-panel--indigo",
    accentClass: "landing-feature-accent--indigo",
    preview: "radar",
  },
  {
    id: "campanhas",
    navLabel: "Campanhas",
    eyebrow: "E-mail e Campanhas",
    title: "Dispare campanhas para o público certo — com o Radar no comando",
    description:
      "Templates, agendamento e métricas no mesmo lugar. Escolha uma lista CSV ou um segmento do Radar e envie em minutos, sem exportar planilha.",
    bullets: [
      "Audiência via lista CSV ou segmento do Radar",
      "Templates aprováveis e personalização por destinatário",
      "Agendamento e disparo com limite controlado",
      "Analytics de abertura, clique, entrega e descadastro",
    ],
    cta: "Ver campanhas",
    image: "/images/landing/campanhas.webp",
    imageAlt: "Tela de Campanhas de e-mail",
    windowTitle: "Campanhas",
    colorClass: "landing-feature-panel--rose",
    accentClass: "landing-feature-accent--rose",
  },
  {
    id: "dashboard",
    navLabel: "Dashboard",
    eyebrow: "Dashboard",
    title: "Todos os indicadores da operação, em uma única tela",
    description: "Sem planilha, sem relatório manual: os números certos, sempre à mão.",
    bullets: [
      "Métricas de leads, conversão e receita em tempo real",
      "Ranking de SDRs e Closers atualizado automaticamente",
      "Visão consolidada por time, workspace e período",
    ],
    cta: "Ver dashboard",
    image: "/images/landing/dashboard-dark.webp",
    imageAlt: "Tela de Dashboard com métricas em tempo real",
    windowTitle: "Dashboard",
    colorClass: "landing-feature-panel--magenta",
    accentClass: "landing-feature-accent--magenta",
  },
  {
    id: "workspaces",
    navLabel: "Workspaces",
    eyebrow: "Times e Workspaces",
    title: "Uma operação por time, com troca de workspace num clique",
    description:
      "Separe carteiras, leads e campanhas por equipe. Alterne o workspace ativo instantaneamente, cada time enxerga apenas o que é seu.",
    bullets: [
      "Dados isolados por time — sem cruzar carteiras",
      "Troca de workspace ativo em um clique",
      "Metas e relatórios independentes por equipe",
    ],
    cta: "Ver workspaces",
    image: "/images/landing/times.webp",
    imageAlt: "Tela de Times e Workspaces",
    windowTitle: "Workspaces",
    colorClass: "landing-feature-panel--pink",
    accentClass: "landing-feature-accent--pink",
  },
  {
    id: "operadores",
    navLabel: "Operadores",
    eyebrow: "Gestão de Operadores",
    title: "Cadastre operadores, defina funções e controle acessos",
    description:
      "Monte seu time em minutos. Atribua papéis de SDR ou Closer, defina permissões e ative ou pause o acesso de cada operador quando precisar.",
    bullets: [
      "Papéis de SDR e Closer com permissões distintas",
      "Ative, pause ou revogue acessos a qualquer momento",
      "Distribuição de leads por operador",
    ],
    cta: "Ver operadores",
    image: "/images/landing/operadores.webp",
    imageAlt: "Tela de gestão de operadores e usuários",
    windowTitle: "Operadores",
    colorClass: "landing-feature-panel--purple",
    accentClass: "landing-feature-accent--purple",
  },
]
