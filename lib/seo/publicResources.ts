export interface PublicResourceFaqItem {
  question: string;
  answer: string;
}

export interface PublicResourceStatistic {
  label: string;
  value: string;
  source?: string;
}

export interface PublicResourceComparisonTable {
  headers: string[];
  rows: string[][];
}

export interface PublicResourceEntry {
  slug: string;
  title: string;
  description: string;
  intent: string;
  heroTitle: string;
  heroSubtitle: string;
  introDefinition?: string;
  author?: { name: string; role?: string };
  proofTitle: string;
  proofPoints: string[];
  useCases: string[];
  statistics?: PublicResourceStatistic[];
  comparisonTable?: PublicResourceComparisonTable;
  faq: PublicResourceFaqItem[];
  keywords: string[];
  publishedTime: string;
  modifiedTime: string;
}

export const PUBLIC_RESOURCES_HUB_PATH = "/recursos";

const DEFAULT_AUTHOR: PublicResourceEntry["author"] = {
  name: "Equipe Corretor Studio",
  role: "Conteúdo Comercial",
};

export const PUBLIC_RESOURCE_ENTRIES: PublicResourceEntry[] = [
  {
    slug: "crm-corretores-saude",
    title: "CRM para corretores de saúde | Corretor Studio",
    description:
      "Entenda como um CRM para corretores de saúde organiza leads, acelera follow-up e aumenta taxa de fechamento com previsibilidade.",
    intent: "CRM para corretores de saúde",
    heroTitle: "CRM para corretores de saúde com foco em conversão",
    heroSubtitle:
      "Centralize oportunidades, histórico de atendimento e próximas ações para reduzir perdas no funil comercial.",
    introDefinition:
      "O que é um CRM para corretor de saúde? Um CRM (Customer Relationship Management) para corretor de saúde é um sistema que centraliza todos os leads, histórico de atendimento e próximas ações em um único lugar. Diferente de planilhas ou ferramentas genéricas, ele é projetado para o ciclo de venda de planos de saúde: da captação até o fechamento e renovação.",
    author: DEFAULT_AUTHOR,
    proofTitle: "Por que este modelo de CRM funciona para corretores",
    proofPoints: [
      "Visibilidade do funil em tempo real por etapa, operador e origem do lead.",
      "Rotina de follow-up mais disciplinada com menos esquecimentos.",
      "Decisões comerciais baseadas em dados de conversão, não em suposição.",
    ],
    useCases: [
      "Times que precisam padronizar atendimento entre SDR e Closer.",
      "Operações com alto volume de leads e baixa rastreabilidade histórica.",
      "Corretoras que querem reduzir tempo médio entre primeiro contato e fechamento.",
    ],
    statistics: [
      {
        label: "Aumento na taxa de conversão com CRM",
        value: "até 3×",
        source: "Salesforce State of Sales, 2023",
      },
      {
        label: "Redução de leads perdidos por falta de follow-up",
        value: "27%",
        source: "HubSpot Sales Statistics, 2024",
      },
    ],
    faq: [
      {
        question: "Qual a vantagem de usar um CRM específico para corretor de saúde?",
        answer:
          "A principal vantagem é ter um sistema com linguagem, etapas e indicadores alinhados à rotina de venda de planos de saúde — diferente de um CRM genérico que precisa ser adaptado. Na prática, isso significa etapas do funil com nomes que fazem sentido para o processo (qualificação, proposta enviada, aguardando decisão), campos específicos para o tipo de plano e indicadores de conversão por operador e origem de lead. Um corretor que usa CRM específico consegue identificar em minutos quais leads estão parados, qual etapa tem maior perda e onde concentrar esforço. O resultado direto é mais previsibilidade no fechamento e menos leads desperdiçados por falta de follow-up.",
      },
      {
        question: "Consigo acompanhar conversão por membro do time?",
        answer:
          "Sim. O acompanhamento individual de conversão é um dos recursos mais valiosos para gestores de corretoras. Com um CRM estruturado, é possível visualizar, para cada operador, quantos leads recebeu, em qual etapa estão, quantos avançaram e quantos foram perdidos — e em qual etapa ocorreu a perda. Esse nível de detalhe permite identificar padrões: um operador pode ter excelente taxa de abertura mas perder muito na etapa de proposta, enquanto outro fecha bem mas demora a fazer o primeiro contato. Com esse diagnóstico, o gestor pode calibrar treinamento, redistribuir leads e definir metas por etapa — criando base para coaching comercial efetivo.",
      },
      {
        question: "Um CRM ajuda a reduzir leads perdidos?",
        answer:
          "Sim. A perda de leads por falta de follow-up é um dos maiores problemas em operações de planos de saúde — e um CRM resolve isso de forma estrutural. Quando cada lead tem uma próxima ação definida com responsável e prazo, o risco de abandono cai drasticamente. O sistema deixa visível quais leads estão sem atividade há mais tempo, permitindo retomar o contato antes que o interesse esfrie. Além disso, o histórico completo de interações — ligações, mensagens, reuniões — elimina o problema de um lead ser atendido de forma desconexa por operadores diferentes. O resultado é um funil mais limpo, com menos perdas por esquecimento ou falta de contexto.",
      },
    ],
    keywords: [
      "crm para corretor de saúde",
      "crm corretora de planos",
      "gestão de leads corretor",
      "software para corretor de saúde",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
  {
    slug: "pipeline-planos-saude",
    title: "Pipeline comercial de planos de saúde | Corretor Studio",
    description:
      "Aprenda como estruturar um pipeline comercial de planos de saúde com etapas claras, metas por fase e previsão de receita.",
    intent: "pipeline comercial de planos de saúde",
    heroTitle: "Pipeline comercial para vender mais planos com previsibilidade",
    heroSubtitle:
      "Defina etapas objetivas, ganho de taxa de passagem e ação correta em cada fase da jornada comercial.",
    introDefinition:
      "O que é pipeline comercial de planos de saúde? Pipeline comercial é a estrutura que organiza visualmente cada oportunidade de venda em etapas definidas, do primeiro contato até o fechamento. Para corretoras de saúde, ter um pipeline bem estruturado significa saber exatamente onde cada lead está, qual a probabilidade de fechamento e qual ação tomar a seguir — transformando suposição em gestão baseada em dados.",
    author: DEFAULT_AUTHOR,
    proofTitle: "Sinais de um pipeline comercial saudável",
    proofPoints: [
      "Etapas com critérios claros para entrada e saída.",
      "Taxa de conversão monitorada por fase para diagnosticar gargalos.",
      "Prioridade comercial definida por urgência e potencial de fechamento.",
    ],
    useCases: [
      "Operações que sofrem com leads parados entre proposta e fechamento.",
      "Corretoras que precisam melhorar previsão de faturamento mensal.",
      "Gestores que querem reduzir improviso na tomada de decisão comercial.",
    ],
    statistics: [
      {
        label: "Melhoria na precisão do forecast com pipeline estruturado",
        value: "até 42%",
        source: "Gartner Sales Research, 2023",
      },
      {
        label: "Deals perdidos por ausência de processo comercial definido",
        value: "65%",
        source: "McKinsey B2B Sales Research, 2022",
      },
    ],
    faq: [
      {
        question: "Qual é o erro mais comum no pipeline comercial?",
        answer:
          "O erro mais comum é tratar o pipeline como uma lista de contatos em vez de um sistema de gestão de oportunidades. Isso acontece quando leads são movidos de etapa sem critério claro, quando não há distinção entre leads qualificados e não qualificados no início do funil, ou quando a mesma etapa acumula leads de perfis muito diferentes. O resultado é um pipeline poluído: as métricas de conversão ficam distorcidas e o forecast fica impreciso. A correção começa definindo critérios objetivos de entrada e saída para cada etapa — e aplicando esses critérios com consistência. Um pipeline disciplinado é mais enxuto, mas muito mais confiável para tomada de decisão.",
      },
      {
        question: "Como saber se uma etapa precisa ser ajustada?",
        answer:
          "O sinal mais claro é a combinação de baixa taxa de passagem com alto tempo médio na etapa. Se muitos leads entram em determinada fase e poucos avançam, algo no processo dessa etapa está falhando — pode ser o pitch, o prazo de resposta, o tipo de proposta ou o perfil dos leads que chegam até ali. Da mesma forma, se leads ficam parados por muito tempo, pode indicar falta de urgência no contato ou ausência de um gatilho claro para avançar. A análise deve ser feita por período e segmentada por operador, pois o problema pode estar na execução individual e não no processo. Ajustar uma etapa com base em dados é muito mais eficaz que fazer mudanças por intuição.",
      },
      {
        question: "Pipeline ajuda no forecast?",
        answer:
          "Sim, e de forma significativa. Com dados históricos de conversão por etapa, é possível calcular quantos leads em cada fase tendem a fechar e em quanto tempo. Se o pipeline mostra 40 leads na etapa de proposta e a taxa histórica de fechamento é de 30%, o gestor pode estimar aproximadamente 12 novos contratos no período. Esse cálculo fica ainda mais preciso quando o pipeline registra valor potencial por lead — permitindo não só forecast de quantidade, mas de receita. Corretoras com pipeline estruturado conseguem planejar melhor a capacidade da equipe, antecipar períodos de baixa e definir metas de entrada de leads para sustentar o crescimento.",
      },
    ],
    keywords: [
      "pipeline comercial planos de saúde",
      "funil de vendas corretor",
      "gestão de pipeline comercial",
      "etapas de vendas planos de saúde",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
  {
    slug: "gestao-equipe-comercial",
    title: "Gestão de equipe comercial para corretoras | Corretor Studio",
    description:
      "Veja como organizar times comerciais de corretoras de saúde com distribuição de leads, acompanhamento de performance e rotina de execução.",
    intent: "gestão de equipe comercial para corretoras",
    heroTitle: "Gestão de equipe comercial com ritmo e accountability",
    heroSubtitle:
      "Distribua melhor os leads, acompanhe desempenho e padronize a execução para elevar performance coletiva.",
    introDefinition:
      "O que é gestão de equipe comercial para corretoras? Gestão de equipe comercial em corretoras de saúde é o conjunto de práticas que garantem que cada operador saiba quais leads atender, como priorizar e quais métricas atingir. Envolve distribuição de carteira, acompanhamento de performance individual e padronização do processo de atendimento — transformando esforço individual em resultado previsível para a operação.",
    author: DEFAULT_AUTHOR,
    proofTitle: "Indicadores que fortalecem a gestão do time",
    proofPoints: [
      "Volume de atividades e taxa de resposta por operador.",
      "Conversão por perfil comercial e etapa do processo.",
      "Visão consolidada de produtividade por equipe e período.",
    ],
    useCases: [
      "Times com dificuldade de manter padrão de atendimento.",
      "Gestores que precisam equilibrar distribuição de carteira.",
      "Operações em crescimento com necessidade de governança comercial.",
    ],
    statistics: [
      {
        label: "Aumento na taxa de conversão com coaching baseado em dados",
        value: "+17%",
        source: "CSO Insights, 2023",
      },
      {
        label: "Probabilidade de qualificação com resposta em menos de 5 minutos",
        value: "21× maior",
        source: "Lead Response Management Study, MIT / InsideSales.com",
      },
    ],
    faq: [
      {
        question: "Como evitar sobrecarga em parte da equipe?",
        answer:
          "A sobrecarga acontece quando leads são distribuídos de forma irregular — seja por critério mal calibrado, por preferência manual do gestor ou simplesmente por falta de visibilidade sobre a carga de cada operador. A solução começa por tornar a distribuição transparente e baseada em regras claras: capacidade por operador, origem do lead, perfil do cliente ou região. Com um CRM, o gestor consegue ver em tempo real quantos leads ativos cada membro do time está gerenciando e qual o volume de atividades pendentes — permitindo redistribuir carteiras antes que a sobrecarga impacte a qualidade do atendimento. Equipes bem distribuídas respondem leads mais rápido, fazem mais follow-up e têm taxas de conversão mais consistentes.",
      },
      {
        question: "Quais métricas são essenciais para o gestor comercial?",
        answer:
          "As métricas mais relevantes para gestores de corretoras de saúde são: taxa de conversão por etapa (para identificar gargalos no funil), tempo médio de resposta ao primeiro contato (impacta diretamente a taxa de qualificação), volume de atividades por operador (indica ritmo de trabalho) e leads ativos por operador (mostra distribuição de carga). Além dessas, o acompanhamento de leads perdidos por motivo é fundamental — saber se a perda vem de preço, concorrência, falta de follow-up ou desqualificação permite ajustes direcionados. Gestores que monitoram essas métricas semanalmente conseguem identificar problemas antes que impactem o resultado mensal e criar base para coaching comercial mais preciso.",
      },
      {
        question: "É possível alinhar SDR e Closer no mesmo fluxo?",
        answer:
          "Sim. Operações que separam prospecção (SDR) e fechamento (Closer) ganham muito quando esse fluxo é gerenciado dentro de um mesmo CRM. A transição entre funções — o handoff — é um dos momentos mais críticos do processo: se feita sem registro adequado, o Closer recebe o lead sem contexto, repete perguntas já feitas e transmite falta de preparo ao cliente. Com um pipeline unificado, o SDR registra todas as informações relevantes — necessidade identificada, objeções levantadas, histórico de contatos — e o Closer assume com visibilidade completa. Checkpoints claros definem quando o lead está pronto para avançar, evitando que leads imaturos cheguem ao Closer antes da hora, reduzindo retrabalho e aumentando aproveitamento das oportunidades.",
      },
    ],
    keywords: [
      "gestão de equipe comercial",
      "time de vendas corretora de saúde",
      "desempenho comercial corretor",
      "rotina de equipe de vendas",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
  {
    slug: "integracoes-corretor-studio",
    title: "Integrações para corretoras de saúde | Corretor Studio",
    description:
      "Conheça as integrações para captação e operação comercial, incluindo formulários de lead, agenda e rotinas de notificação.",
    intent: "integrações para corretoras de saúde",
    heroTitle: "Integrações para acelerar captação e operação comercial",
    heroSubtitle:
      "Conecte pontos críticos do processo comercial para reduzir retrabalho e aumentar velocidade de atendimento.",
    introDefinition:
      "O que são integrações para corretoras de saúde? Integrações são conexões entre o CRM e outros sistemas ou canais usados pela corretora — como formulários de captação, agendas e notificações. Elas automatizam a entrada de leads e eliminam trabalho manual, reduzindo o tempo entre o primeiro interesse do cliente e o primeiro contato do corretor — que é um dos fatores com maior impacto na taxa de conversão.",
    author: DEFAULT_AUTHOR,
    proofTitle: "Valor prático das integrações no dia a dia",
    proofPoints: [
      "Entrada de leads mais organizada e padronizada.",
      "Menos retrabalho manual no fluxo de agenda e acompanhamento.",
      "Maior consistência operacional com dados centralizados.",
    ],
    useCases: [
      "Corretoras com múltiplos canais de entrada de leads.",
      "Times que precisam reduzir latência entre captação e primeiro contato.",
      "Gestores que querem histórico unificado para tomada de decisão.",
    ],
    statistics: [
      {
        label: "Aumento na probabilidade de qualificação com resposta em até 5 min",
        value: "21×",
        source: "Harvard Business Review / InsideSales.com",
      },
      {
        label: "Redução de trabalho manual de entrada de dados com integrações",
        value: "~40%",
        source: "Zapier State of Business Automation, 2023",
      },
    ],
    faq: [
      {
        question: "Integrações ajudam a responder leads mais rápido?",
        answer:
          "Sim, e a velocidade de resposta é diretamente proporcional à taxa de qualificação. Estudos mostram que leads respondidos em menos de 5 minutos têm probabilidade de conversão muito maior do que os respondidos após 30 minutos. Quando leads chegam de formulários externos e precisam ser copiados manualmente para um CRM, esse tempo aumenta — especialmente fora do horário comercial ou em períodos de alto volume. Com integrações que alimentam o CRM automaticamente, o lead aparece imediatamente para o operador responsável, com notificação ativa. Em segmentos competitivos como planos de saúde, onde o cliente costuma consultar mais de uma corretora ao mesmo tempo, esse ganho de velocidade representa diferença relevante em conversão.",
      },
      {
        question: "Preciso de equipe técnica para operar integrações?",
        answer:
          "Em geral, não. As integrações do Corretor Studio foram desenhadas para serem configuradas e operadas por pessoas sem perfil técnico — gestores comerciais, coordenadores de operação ou o próprio corretor. A lógica é simplificar o fluxo operacional sem criar dependência de equipe de TI para manutenção do dia a dia. Formulários de captação são conectados por meio de configuração visual, sem necessidade de código. A exceção são integrações customizadas com sistemas legados ou fluxos muito específicos da operação, que podem demandar suporte técnico pontual na configuração inicial. Para a grande maioria das corretoras, o modelo padrão é suficiente e pode ser ativado de forma autônoma.",
      },
      {
        question: "Integrações substituem processo comercial?",
        answer:
          "Não — e essa distinção é importante. Integrações automatizam tarefas operacionais repetitivas, como entrada de leads, distribuição inicial e notificações, mas não substituem o processo comercial em si. Um lead que entra automaticamente ainda precisa de qualificação humana, de um pitch bem estruturado e de follow-up consistente. O que as integrações fazem é remover o atrito operacional que atrasa esse processo: o corretor não precisa mais transferir dados entre sistemas ou criar contatos manualmente. Com menos trabalho manual, o operador tem mais tempo para o que realmente importa — o contato com o cliente. Integrações potencializam uma equipe bem treinada; não são atalho para compensar falhas no processo comercial.",
      },
    ],
    keywords: [
      "integrações crm corretor",
      "integração captação de leads",
      "automação comercial corretora de saúde",
      "integrações para corretora",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
  {
    slug: "faq-corretor-studio",
    title: "FAQ Corretor Studio | Dúvidas frequentes",
    description:
      "Respostas objetivas sobre CRM, pipeline, equipe comercial, integrações e assinatura do Corretor Studio para corretores de saúde.",
    intent: "faq corretor studio",
    heroTitle: "FAQ Corretor Studio: respostas diretas para decisão rápida",
    heroSubtitle:
      "Encontre respostas sobre implementação, rotina comercial, produtividade e operação da plataforma.",
    introDefinition:
      "O que é o Corretor Studio? O Corretor Studio é uma plataforma de CRM e gestão comercial desenvolvida exclusivamente para corretores e corretoras de planos de saúde no Brasil. Reúne pipeline Kanban, gestão de equipe, agenda de reuniões, métricas de conversão e campanhas de e-mail em um único sistema com foco no processo de venda de planos de saúde suplementar.",
    author: DEFAULT_AUTHOR,
    proofTitle: "Dúvidas mais comuns antes da adoção",
    proofPoints: [
      "Como iniciar rapidamente sem travar a operação atual.",
      "Como adaptar processo comercial ao modelo de funil.",
      "Como medir resultado após adoção da plataforma.",
    ],
    useCases: [
      "Gestores avaliando troca de ferramentas comerciais.",
      "Times que precisam de clareza sobre implantação.",
      "Operações que buscam previsibilidade de conversão.",
    ],
    statistics: [
      {
        label: "Crescimento anual do mercado de CRM no Brasil",
        value: "25%",
        source: "IDC Latin America, 2023",
      },
      {
        label: "ROI médio de implementação de CRM",
        value: "$8,71 por $1 investido",
        source: "Nucleus Research, 2021",
      },
    ],
    faq: [
      {
        question: "O Corretor Studio é apenas para grandes equipes?",
        answer:
          "Não. A plataforma atende desde corretores individuais que trabalham sozinhos até corretoras com times de dezenas de operadores. Para o corretor solo, o valor está em organizar os próprios leads, ter histórico de interações e nunca perder um follow-up. Para equipes maiores, o sistema adiciona camadas de gestão: distribuição de carteira, acompanhamento de performance por operador e métricas consolidadas. A arquitetura escala conforme a operação cresce — o corretor que começa sozinho não precisa mudar de sistema quando contratar os primeiros operadores. Organização e previsibilidade comercial não são exclusividade de grandes operações: qualquer corretor que quer crescer se beneficia de processo estruturado desde o início.",
      },
      {
        question: "Preciso parar minha operação para implementar?",
        answer:
          "Não. A implantação do Corretor Studio foi desenhada para acontecer em paralelo com a operação corrente, sem interrupção do fluxo de atendimento. O processo típico começa com a configuração do pipeline e etapas — o que leva poucas horas — seguido pela importação dos leads existentes. A equipe pode começar a usar o sistema com os novos leads enquanto os leads antigos são migrados gradualmente. Não há necessidade de um corte abrupto: a transição acontece de forma progressiva, com a equipe adaptando a rotina no ritmo da operação. Recomenda-se uma semana de uso paralelo para que o time ganhe confiança antes de desligar o método anterior.",
      },
      {
        question: "Consigo acompanhar indicadores de conversão em tempo real?",
        answer:
          "Sim. O painel do Corretor Studio exibe em tempo real as métricas mais relevantes para gestão comercial: volume de leads por etapa, taxa de conversão por fase do funil, tempo médio de resposta, leads ativos por operador e desempenho do período versus metas definidas. Essa visibilidade permite que o gestor tome decisões no momento certo — não só no fim do mês, quando os problemas já impactaram o resultado. Por exemplo, se a taxa de leads sem atividade está subindo no meio da semana, o gestor pode acionar a equipe antes que o período feche com resultado abaixo da meta. O acompanhamento em tempo real também muda a cultura da equipe em relação à atualização do CRM.",
      },
      {
        question: "Existe suporte em português?",
        answer:
          "Sim. O Corretor Studio foi desenvolvido exclusivamente para o mercado brasileiro de planos de saúde, e todo o suporte é em português. Isso inclui documentação, materiais de onboarding, atendimento via canal de suporte e comunicação sobre atualizações da plataforma. O suporte considera o contexto específico do setor: as perguntas e dificuldades mais comuns de corretores e gestores de planos de saúde já são conhecidas pela equipe, o que agiliza o atendimento. O produto também é atualizado com base no feedback de usuários brasileiros, garantindo que as funcionalidades evoluam conforme as necessidades reais do mercado nacional de saúde suplementar.",
      },
    ],
    keywords: [
      "faq corretor studio",
      "dúvidas crm corretor",
      "perguntas frequentes crm saúde",
      "ajuda corretor studio",
    ],
    publishedTime: "2026-04-10T00:00:00.000Z",
    modifiedTime: "2026-04-10T00:00:00.000Z",
  },
  {
    slug: "crm-vs-planilha",
    title: "CRM vs planilha para corretoras de saúde | Corretor Studio",
    description:
      "Compare CRM vs planilha na rotina de corretoras de saúde e veja impactos em produtividade, conversão e controle operacional.",
    intent: "crm vs planilha para corretoras de saúde",
    heroTitle: "CRM vs planilha: qual modelo escala melhor sua operação",
    heroSubtitle:
      "Entenda custos ocultos da planilha e ganhos de controle, colaboração e previsibilidade ao adotar CRM.",
    introDefinition:
      "CRM vs planilha: qual é a diferença real? A diferença fundamental está no nível de controle, rastreabilidade e colaboração. Uma planilha depende de disciplina manual para ser atualizada, não registra histórico de ações e torna difícil o trabalho em equipe. Um CRM automatiza o registro de interações, define responsáveis por cada lead e gera relatórios de conversão em tempo real — sem precisar consolidar arquivos ou perguntar para o operador o que aconteceu com cada lead.",
    author: DEFAULT_AUTHOR,
    proofTitle: "Comparativo prático para decisão comercial",
    proofPoints: [
      "Planilha depende de disciplina manual e gera mais risco de inconsistências.",
      "CRM melhora rastreabilidade, colaboração e governança comercial.",
      "Gestão por CRM acelera ajustes com base em dados reais de funil.",
    ],
    useCases: [
      "Times que cresceram e perderam controle em planilhas.",
      "Gestores com dificuldade de forecast e priorização.",
      "Corretoras que precisam padronizar execução entre operadores.",
    ],
    statistics: [
      {
        label: "Horas semanais gastas em tarefas administrativas com planilha",
        value: "6h por vendedor",
        source: "HubSpot Sales Productivity Study, 2023",
      },
      {
        label: "Crescimento de receita com CRM vs planilha em 3 anos",
        value: "+41%",
        source: "Salesforce ROI Report, 2023",
      },
    ],
    comparisonTable: {
      headers: ["Critério", "Planilha", "CRM"],
      rows: [
        ["Rastreabilidade", "Manual, sujeita a erros", "Automática, histórico completo"],
        ["Colaboração", "Conflitos de versão", "Multiusuário em tempo real"],
        ["Forecast", "Estimativa manual", "Baseado em dados de funil"],
        ["Escalabilidade", "Degrada com volume", "Escala sem perda de visibilidade"],
        ["Segurança dos dados", "Arquivo local ou compartilhado", "Backup automático na nuvem"],
        ["Custo inicial", "Zero", "A partir de plano básico"],
      ],
    },
    faq: [
      {
        question: "Planilha ainda funciona para equipes pequenas?",
        answer:
          "Pode funcionar no início, quando o volume de leads é baixo e há apenas um ou dois operadores. Nesse cenário, a planilha tem o mérito da simplicidade e do custo zero. O problema começa quando o volume cresce: atualizar a planilha vira trabalho administrativo que consome tempo de venda, erros de preenchimento se multiplicam e a visão do funil fica comprometida. Para equipes com mais de um operador, a colaboração em planilha gera conflitos de versão e perda de histórico. O ponto de virada costuma acontecer entre 50 e 100 leads ativos simultâneos. A pergunta relevante não é 'planilha funciona?', mas 'o custo oculto de usar planilha está me custando oportunidades?'",
      },
      {
        question: "CRM aumenta produtividade mesmo sem automação avançada?",
        answer:
          "Sim. Mesmo sem automações complexas, um CRM aumenta produtividade pela organização do fluxo: cada lead tem um responsável definido, uma etapa clara e uma próxima ação registrada. Isso elimina o tempo gasto procurando informações — 'onde está esse lead?', 'já mandei proposta?', 'qual foi o último contato?' — que em planilhas pode consumir minutos por lead. Multiplicado pelo volume de leads diários, esse ganho representa horas por semana. A visibilidade do pipeline também reduz o tempo de reuniões comerciais: o gestor entra com os dados já organizados. Para equipes que migram de planilha para CRM, o ganho de produtividade imediato — antes de qualquer automação — costuma ser a primeira surpresa positiva.",
      },
      {
        question: "A troca para CRM exige mudança cultural?",
        answer:
          "Sim, mas é menor do que parece. A resistência mais comum é o hábito de trabalhar com a planilha e o medo de perder dados na migração. Na prática, a curva de aprendizado de um CRM bem desenhado para o setor é curta — geralmente 3 a 5 dias de uso consistente para a equipe se sentir confortável. O fator mais importante para o sucesso da adoção é o engajamento do gestor: quando a liderança usa o CRM ativamente e cobra registro das interações, a equipe adere mais rapidamente. O ponto de virada cultural acontece quando os operadores percebem que o CRM os beneficia — menos leads esquecidos, histórico completo, menos cobrança por mensagem.",
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
