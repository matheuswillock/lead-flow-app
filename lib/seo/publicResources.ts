export interface PublicResourceFaqItem {
  question: string;
  answer: string;
}

export interface PublicResourceEntry {
  slug: string;
  title: string;
  description: string;
  intent: string;
  heroTitle: string;
  heroSubtitle: string;
  proofTitle: string;
  proofPoints: string[];
  useCases: string[];
  faq: PublicResourceFaqItem[];
  keywords: string[];
  publishedTime: string;
  modifiedTime: string;
}

export const PUBLIC_RESOURCES_HUB_PATH = "/recursos";

export const PUBLIC_RESOURCE_ENTRIES: PublicResourceEntry[] = [
  {
    slug: "crm-corretores-saude",
    title: "CRM para corretores de saude | Corretor Studio",
    description:
      "Entenda como um CRM para corretores de saude organiza leads, acelera follow-up e aumenta taxa de fechamento com previsibilidade.",
    intent: "CRM para corretores de saude",
    heroTitle: "CRM para corretores de saude com foco em conversao",
    heroSubtitle:
      "Centralize oportunidades, historico de atendimento e proximas acoes para reduzir perdas no funil comercial.",
    proofTitle: "Por que este modelo de CRM funciona para corretores",
    proofPoints: [
      "Visibilidade do funil em tempo real por etapa, operador e origem do lead.",
      "Rotina de follow-up mais disciplinada com menos esquecimentos.",
      "Decisoes comerciais baseadas em dados de conversao, nao em suposicao.",
    ],
    useCases: [
      "Times que precisam padronizar atendimento entre SDR e Closer.",
      "Operacoes com alto volume de leads e baixa rastreabilidade historica.",
      "Corretoras que querem reduzir tempo medio entre primeiro contato e fechamento.",
    ],
    faq: [
      {
        question: "Qual a vantagem de usar um CRM especifico para corretor de saude?",
        answer:
          "A vantagem e organizar o processo comercial com linguagem, etapas e indicadores aderentes a rotina de venda de planos.",
      },
      {
        question: "Consigo acompanhar conversao por membro do time?",
        answer:
          "Sim. O acompanhamento por operador e por etapa do funil ajuda a identificar gargalos e oportunidades de melhoria.",
      },
      {
        question: "Um CRM ajuda a reduzir leads perdidos?",
        answer:
          "Sim. Com fluxo e proxima acao definida por lead, o risco de abandono por falta de follow-up cai de forma relevante.",
      },
    ],
    keywords: [
      "crm para corretor de saude",
      "crm corretora de planos",
      "gestao de leads corretor",
      "software para corretor de saude",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
  {
    slug: "pipeline-planos-saude",
    title: "Pipeline comercial de planos de saude | Corretor Studio",
    description:
      "Aprenda como estruturar um pipeline comercial de planos de saude com etapas claras, metas por fase e previsao de receita.",
    intent: "pipeline comercial de planos de saude",
    heroTitle: "Pipeline comercial para vender mais planos com previsibilidade",
    heroSubtitle:
      "Defina etapas objetivas, ganho de taxa de passagem e acao correta em cada fase da jornada comercial.",
    proofTitle: "Sinais de um pipeline comercial saudavel",
    proofPoints: [
      "Etapas com criterios claros para entrada e saida.",
      "Taxa de conversao monitorada por fase para diagnosticar gargalos.",
      "Prioridade comercial definida por urgencia e potencial de fechamento.",
    ],
    useCases: [
      "Operacoes que sofrem com leads parados entre proposta e fechamento.",
      "Corretoras que precisam melhorar previsao de faturamento mensal.",
      "Gestores que querem reduzir improviso na tomada de decisao comercial.",
    ],
    faq: [
      {
        question: "Qual e o erro mais comum no pipeline comercial?",
        answer:
          "Misturar etapas sem criterio e mover leads sem validacao, o que distorce previsao e dificulta melhoria continua.",
      },
      {
        question: "Como saber se uma etapa precisa ser ajustada?",
        answer:
          "Observe queda de taxa de passagem e aumento de tempo medio na etapa; esses sinais indicam necessidade de ajuste.",
      },
      {
        question: "Pipeline ajuda no forecast?",
        answer:
          "Sim. Com dados por fase e historico de conversao, o forecast fica mais confiavel para planejamento comercial.",
      },
    ],
    keywords: [
      "pipeline comercial planos de saude",
      "funil de vendas corretor",
      "gestao de pipeline comercial",
      "etapas de vendas planos de saude",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
  {
    slug: "gestao-equipe-comercial",
    title: "Gestao de equipe comercial para corretoras | Corretor Studio",
    description:
      "Veja como organizar times comerciais de corretoras de saude com distribuicao de leads, acompanhamento de performance e rotina de execucao.",
    intent: "gestao de equipe comercial para corretoras",
    heroTitle: "Gestao de equipe comercial com ritmo e accountability",
    heroSubtitle:
      "Distribua melhor os leads, acompanhe desempenho e padronize a execucao para elevar performance coletiva.",
    proofTitle: "Indicadores que fortalecem a gestao do time",
    proofPoints: [
      "Volume de atividades e taxa de resposta por operador.",
      "Conversao por perfil comercial e etapa do processo.",
      "Visao consolidada de produtividade por equipe e periodo.",
    ],
    useCases: [
      "Times com dificuldade de manter padrao de atendimento.",
      "Gestores que precisam equilibrar distribuicao de carteira.",
      "Operacoes em crescimento com necessidade de governanca comercial.",
    ],
    faq: [
      {
        question: "Como evitar sobrecarga em parte da equipe?",
        answer:
          "Com distribuicao transparente de leads, regras de prioridade e acompanhamento continuo de capacidade por membro.",
      },
      {
        question: "Quais metricas sao essenciais para o gestor comercial?",
        answer:
          "Conversao por etapa, tempo de resposta, atividades por lead e volume de oportunidades ativas por operador.",
      },
      {
        question: "E possivel alinhar SDR e Closer no mesmo fluxo?",
        answer:
          "Sim. Um processo unificado com checkpoints claros reduz retrabalho e melhora handoff entre funcoes.",
      },
    ],
    keywords: [
      "gestao de equipe comercial",
      "time de vendas corretora de saude",
      "desempenho comercial corretor",
      "rotina de equipe de vendas",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
  {
    slug: "integracoes-corretor-studio",
    title: "Integracoes para corretoras de saude | Corretor Studio",
    description:
      "Conheca as integracoes para captacao e operacao comercial, incluindo formularios de lead, agenda e rotinas de notificacao.",
    intent: "integracoes para corretoras de saude",
    heroTitle: "Integracoes para acelerar captacao e operacao comercial",
    heroSubtitle:
      "Conecte pontos criticos do processo comercial para reduzir retrabalho e aumentar velocidade de atendimento.",
    proofTitle: "Valor pratico das integracoes no dia a dia",
    proofPoints: [
      "Entrada de leads mais organizada e padronizada.",
      "Menos retrabalho manual no fluxo de agenda e acompanhamento.",
      "Maior consistencia operacional com dados centralizados.",
    ],
    useCases: [
      "Corretoras com multiplos canais de entrada de leads.",
      "Times que precisam reduzir latencia entre captacao e primeiro contato.",
      "Gestores que querem historico unificado para tomada de decisao.",
    ],
    faq: [
      {
        question: "Integracoes ajudam a responder leads mais rapido?",
        answer:
          "Sim. A automacao de entrada e distribuicao acelera o primeiro contato e reduz atraso operacional.",
      },
      {
        question: "Preciso de equipe tecnica para operar integracoes?",
        answer:
          "Em geral nao. O objetivo e simplificar o fluxo operacional sem exigir stack tecnica complexa no dia a dia.",
      },
      {
        question: "Integracoes substituem processo comercial?",
        answer:
          "Nao. Elas potencializam um processo bem definido, removendo tarefas manuais e melhorando consistencia.",
      },
    ],
    keywords: [
      "integracoes crm corretor",
      "integracao captacao de leads",
      "automacao comercial corretora de saude",
      "integracoes para corretora",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
  {
    slug: "faq-corretor-studio",
    title: "FAQ Corretor Studio | Duvidas frequentes",
    description:
      "Respostas objetivas sobre CRM, pipeline, equipe comercial, integracoes e assinatura do Corretor Studio para corretores de saude.",
    intent: "faq corretor studio",
    heroTitle: "FAQ Corretor Studio: respostas diretas para decisao rapida",
    heroSubtitle:
      "Encontre respostas sobre implementacao, rotina comercial, produtividade e operacao da plataforma.",
    proofTitle: "Duvidas mais comuns antes da adocao",
    proofPoints: [
      "Como iniciar rapidamente sem travar a operacao atual.",
      "Como adaptar processo comercial ao modelo de funil.",
      "Como medir resultado apos adocao da plataforma.",
    ],
    useCases: [
      "Gestores avaliando troca de ferramentas comerciais.",
      "Times que precisam de clareza sobre implantacao.",
      "Operacoes que buscam previsibilidade de conversao.",
    ],
    faq: [
      {
        question: "O Corretor Studio e apenas para grandes equipes?",
        answer:
          "Nao. A plataforma atende desde operacoes menores ate times com estrutura comercial mais ampla.",
      },
      {
        question: "Preciso parar minha operacao para implementar?",
        answer:
          "Nao. A implantacao pode ocorrer em paralelo, com transicao gradual de fluxo e dados.",
      },
      {
        question: "Consigo acompanhar indicadores de conversao em tempo real?",
        answer:
          "Sim. Os indicadores comerciais ajudam no ajuste continuo da operacao e tomada de decisao.",
      },
      {
        question: "Existe suporte em portugues?",
        answer:
          "Sim. O produto foi pensado para o contexto brasileiro com suporte em PT-BR.",
      },
    ],
    keywords: [
      "faq corretor studio",
      "duvidas crm corretor",
      "perguntas frequentes crm saude",
      "ajuda corretor studio",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
  {
    slug: "crm-vs-planilha",
    title: "CRM vs planilha para corretoras de saude | Corretor Studio",
    description:
      "Compare CRM vs planilha na rotina de corretoras de saude e veja impactos em produtividade, conversao e controle operacional.",
    intent: "crm vs planilha para corretoras de saude",
    heroTitle: "CRM vs planilha: qual modelo escala melhor sua operacao",
    heroSubtitle:
      "Entenda custos ocultos da planilha e ganhos de controle, colaboracao e previsibilidade ao adotar CRM.",
    proofTitle: "Comparativo pratico para decisao comercial",
    proofPoints: [
      "Planilha depende de disciplina manual e gera mais risco de inconsistencias.",
      "CRM melhora rastreabilidade, colaboracao e governanca comercial.",
      "Gestao por CRM acelera ajustes com base em dados reais de funil.",
    ],
    useCases: [
      "Times que cresceram e perderam controle em planilhas.",
      "Gestores com dificuldade de forecast e priorizacao.",
      "Corretoras que precisam padronizar execucao entre operadores.",
    ],
    faq: [
      {
        question: "Planilha ainda funciona para equipes pequenas?",
        answer:
          "Pode funcionar no inicio, mas tende a perder eficiencia conforme volume de leads e complexidade operacional crescem.",
      },
      {
        question: "CRM aumenta produtividade mesmo sem automacao avancada?",
        answer:
          "Sim. So a organizacao do fluxo, ownership de leads e visibilidade por etapa ja costuma elevar produtividade.",
      },
      {
        question: "A troca para CRM exige mudanca cultural?",
        answer:
          "Sim, mas com onboarding e rotina de acompanhamento, a adocao tende a ser rapida e sustentavel.",
      },
    ],
    keywords: [
      "crm vs planilha",
      "planilha de leads vs crm",
      "comparativo crm corretora",
      "migrar planilha para crm",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
];

export function getPublicResourceBySlug(slug: string): PublicResourceEntry | null {
  return PUBLIC_RESOURCE_ENTRIES.find((entry) => entry.slug === slug) ?? null;
}

export function getPublicResourceSlugs(): string[] {
  return PUBLIC_RESOURCE_ENTRIES.map((entry) => entry.slug);
}

export function isKnownPublicResourceSlug(slug: string): boolean {
  return PUBLIC_RESOURCE_ENTRIES.some((entry) => entry.slug === slug);
}

export function getPublicResourcePath(slug: string): string {
  return `${PUBLIC_RESOURCES_HUB_PATH}/${slug}`;
}
