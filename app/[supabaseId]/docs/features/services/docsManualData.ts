import type { DocsChapter } from "../context/DocsTypes"

export const DOCS_MANUAL_CHAPTERS: DocsChapter[] = [
  {
    id: "inicio",
    indexLabel: "01",
    title: "Inicio",
    eyebrow: "Inicio",
    lead:
      "Entenda como usar esta documentacao, navegar pelos capitulos e acionar o suporte quando precisar de ajuda adicional.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "paragraph",
        title: "O que e este manual",
        content:
          "Esta documentação centraliza os principais fluxos do Corretor Studio, do cadastro inicial ate a operacao diaria do time. Cada capitulo foi organizado por modulo para facilitar consultas rapidas.",
      },
      {
        type: "features",
        title: "Como usar a documentacao",
        columns: 3,
        items: [
          {
            title: "Navegue pelo sidebar",
            description:
              "Use o menu lateral para abrir qualquer capitulo da documentação sem precisar percorrer uma lista longa.",
          },
          {
            title: "Leia um modulo por vez",
            description:
              "O painel principal mostra apenas a pagina ativa, com contexto completo e botoes de anterior e proximo no rodape.",
          },
          {
            title: "Acompanhe o roadmap",
            description:
              "Os modulos marcados como Beta ja podem ser testados em times autorizados. Os marcados como Em breve continuam em desenvolvimento e ainda nao ficam disponiveis na leitura detalhada.",
          },
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Nao encontrou a resposta?",
        content:
          "Abra o suporte pelo menu lateral sempre que algum fluxo nao estiver documentado, estiver desatualizado ou continuar gerando duvidas no dia a dia da equipe.",
      },
    ],
  },
  {
    id: "visao-geral",
    indexLabel: "02",
    title: "O que é o Corretor Studio",
    eyebrow: "Visão Geral",
    lead:
      "Um sistema completo de gestão comercial desenvolvido para corretores de planos de saúde, com foco em organização de leads, pipeline de vendas e colaboração de equipe.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "features",
        columns: 3,
        items: [
          {
            title: "CRM com Kanban",
            description:
              "Visualize e mova leads pelo funil de vendas em um quadro interativo, de qualquer dispositivo.",
          },
          {
            title: "Agendamento de reuniões",
            description:
              "Agende reuniões pelo lead e sincronize automaticamente com o Google Calendar.",
          },
          {
            title: "Dashboard e métricas",
            description:
              "Acompanhe conversão, reuniões realizadas, receita e performance por período.",
          },
          {
            title: "Gestão de equipe",
            description:
              "Adicione SDRs e Closers, distribua leads e acompanhe a performance de cada operador.",
          },
          {
            title: "Carteira de clientes",
            description:
              "Acesse contratos fechados em uma visão centralizada com filtros e histórico.",
          },
          {
            title: "Integrações via webhook",
            description:
              "Receba leads do site, n8n, Make ou qualquer outra plataforma via webhook.",
          },
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Perfis de acesso",
        content:
          "O produto combina niveis de acesso como Manager, Backoffice e Operator, funcoes operacionais como SDR e Closer, alem do ownership da conta e do time para identificar o perfil master.",
      },
    ],
  },
  {
    id: "criar-conta",
    indexLabel: "03",
    title: "Como criar sua conta",
    eyebrow: "Primeiros Passos",
    lead:
      "O cadastro é feito em dois momentos: preenchimento dos dados pessoais e confirmação do plano com pagamento.",
    availability: "available",
    audience: "manager",
    audienceNote:
      "Este fluxo se aplica ao manager responsável por criar a conta principal. Operadores entram no produto por convite.",
    blocks: [
      {
        type: "steps",
        items: [
          {
            title: "Acesse a página de cadastro",
            description:
              'Abra o site do Corretor Studio e clique em "Criar conta" na tela inicial.',
          },
          {
            title: "Preencha seus dados pessoais",
            description:
              'Informe nome completo, e-mail, telefone, CPF/CNPJ e senha, ou use "Continuar com Google" para iniciar com a sua conta Google.',
          },
          {
            title: "Escolha seu plano",
            description:
              'Selecione a opção desejada, mensal ou anual, e avance em "Continuar para o pagamento".',
          },
          {
            title: "Realize o pagamento",
            description:
              'Informe os dados do cartão e conclua em "Finalizar assinatura".',
          },
          {
            title: "Acesse sua conta",
            description:
              "Após a confirmação do pagamento, você é redirecionado para o login com o e-mail já preenchido.",
          },
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Cancelamento de checkout",
        content:
          "Se você fechar a janela de pagamento antes de concluir, a conta criada é removida automaticamente. Basta reiniciar o cadastro.",
      },
    ],
  },
  {
    id: "login",
    indexLabel: "04",
    title: "Como acessar a plataforma",
    eyebrow: "Login",
    lead:
      "Após criar a conta, o acesso é feito diretamente com o e-mail e a senha cadastrados.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "panel",
        title: "Tela de login",
        lines: [
          "Preencha o mesmo e-mail usado no cadastro.",
          "Informe a senha criada durante o registro.",
          'Clique em "Entrar" para ir ao Dashboard.',
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Login com Google",
        content:
          'Se o cadastro foi feito com Google, use "Continuar com Google". Não é necessário digitar senha.',
      },
      {
        type: "callout",
        tone: "warning",
        title: "Erro ao entrar?",
        content:
          "Revise o e-mail e a senha. Após múltiplas tentativas incorretas, aguarde alguns segundos antes de tentar novamente.",
      },
    ],
  },
  {
    id: "alterar-senha",
    indexLabel: "05",
    title: "Como alterar sua senha",
    eyebrow: "Senha",
    lead:
      "Atualize sua senha a qualquer momento pelas configurações da conta.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "steps",
        items: [
          {
            title: "Acesse Minha Conta",
            description:
              'Clique no avatar no canto superior direito e entre em "Minha Conta".',
          },
          {
            title: 'Vá para a aba "Senha"',
            description:
              'Na página de conta, selecione a aba "Senha".',
          },
          {
            title: "Preencha os campos",
            description:
              "Informe senha atual, nova senha e confirmação. Use o ícone de olho para revisar o que foi digitado.",
          },
          {
            title: "Salve as alterações",
            description:
              'Clique em "Salvar nova senha". Uma notificação confirma a atualização.',
          },
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Contas Google",
        content:
          "Se a conta foi criada via Google, a troca de senha deve ser feita diretamente em myaccount.google.com.",
      },
    ],
  },
  {
    id: "perfil",
    indexLabel: "06",
    title: "Configurar seu perfil",
    eyebrow: "Perfil",
    lead:
      "Mantenha seus dados atualizados para que o sistema e sua equipe possam identificá-lo corretamente.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "table",
        columns: ["Campo", "Descrição", "Status"],
        rows: [
          {
            cells: ["Nome completo", "Exibido para toda a equipe e nos leads", "Obrigatório"],
            badgeTone: "required",
          },
          {
            cells: ["E-mail", "E-mail de acesso, não pode ser alterado", "Obrigatório"],
            badgeTone: "required",
          },
          {
            cells: ["Telefone", "Contato principal para comunicação interna", "Opcional"],
            badgeTone: "optional",
          },
          {
            cells: ["CPF / CNPJ", "Documento para emissão de cobranças", "Opcional"],
            badgeTone: "optional",
          },
          {
            cells: ["CEP / Endereço", "Endereço completo para dados de cobrança", "Opcional"],
            badgeTone: "optional",
          },
          {
            cells: ["Foto de perfil", "Avatar em JPG, PNG ou WebP com até 5 MB", "Opcional"],
            badgeTone: "optional",
          },
          {
            cells: ["Função", "Selecione seu papel, como SDR, Closer ou outro", "Opcional"],
            badgeTone: "optional",
          },
        ],
      },
      {
        type: "steps",
        title: "Atualizar foto de perfil",
        items: [
          {
            title: "Acesse Minha Conta → Perfil",
            description:
              "Na seção de foto, você verá o avatar atual ou um círculo com sua inicial.",
          },
          {
            title: "Envie a imagem",
            description:
              "Use o ícone de câmera ou arraste o arquivo para a área indicada.",
          },
          {
            title: "Confirme o upload",
            description:
              "Um preview é exibido antes de salvar. Para remover, use o ícone de lixeira ao lado do avatar.",
          },
        ],
      },
    ],
  },
  {
    id: "google-calendar",
    indexLabel: "07",
    title: "Conectar o Google Calendar",
    eyebrow: "Integrações",
    lead:
      "Permita que o sistema crie eventos de reunião diretamente no seu Google Calendar com link do Google Meet.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "callout",
        tone: "success",
        title: "Por que conectar?",
        content:
          "Ao agendar uma reunião com um lead, o evento é criado no Google Calendar com link do Meet e todo o contexto fica registrado na ficha do lead.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Acesse Minha Conta → Google Calendar",
            description:
              "O status atual da integração aparece como conectado ou desconectado.",
          },
          {
            title: 'Clique em "Conectar Google Calendar"',
            description:
              "Um popup do Google OAuth será aberto para você escolher a conta correta.",
          },
          {
            title: "Autorize as permissões",
            description:
              "Permita a leitura e criação de eventos no seu calendário.",
          },
          {
            title: "Confirme a conexão",
            description:
              "Ao finalizar, o status da tela muda para conectado com o e-mail vinculado.",
          },
        ],
      },
      {
        type: "paragraph",
        title: "Desconectar",
        content:
          'Para desvincular a conta, use "Desconectar Google Calendar" na mesma aba. O sistema pedirá confirmação, mas eventos já criados continuarão na agenda do Google.',
      },
    ],
  },
  {
    id: "dashboard",
    indexLabel: "08",
    title: "Entendendo o Dashboard",
    eyebrow: "Dashboard",
    lead:
      "Tela inicial após o login. Ela reúne um panorama da operação comercial com métricas de período configurável.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "features",
        columns: 2,
        items: [
          {
            title: "Cards de métricas",
            description:
              "Visão operacional e financeira com fórmulas explícitas para vendas, conversão, churn, no-show e valores consolidados.",
          },
          {
            title: "Gráfico de funil",
            description:
              "Distribuição dos leads por etapa do funil ao longo do tempo.",
          },
          {
            title: "Próximas reuniões",
            description:
              "Lista dos próximos compromissos com data, horário e nome do prospect.",
          },
          {
            title: "Notificações",
            description:
              "Alertas sobre novos leads, reuniões próximas e mudanças de status.",
          },
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Filtro de período",
        content:
          "Use os atalhos 7d, 30d, 3m, 6m e 1a para ajustar o recorte das métricas. O padrão inicial é os últimos 30 dias.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Sub-índices dos cards",
        content:
          "Cada card abaixo tem sua explicação e fórmula. Todos os valores respeitam o filtro de período aplicado no topo do Dashboard.",
      },
      {
        type: "panel",
        title: "Receita Total",
        lines: [
          "O que é: valor de contrato efetivamente pago no período.",
          "Como funciona: considera apenas vendas que tiveram confirmação financeira.",
          "Fórmula: soma dos valores pagos no período.",
        ],
      },
      {
        type: "panel",
        title: "Valor da Venda",
        lines: [
          "O que é: valor de ticket quando o contrato é firmado no CRM.",
          "Como funciona: considera o ticket registrado nos leads fechados.",
          "Fórmula: soma dos tickets dos leads fechados no período.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Quando os dois ficam iguais",
        content:
          "Valor da Venda e Receita Total podem ficar com o mesmo número quando todos os contratos firmados também já foram pagos no período analisado. Nesse caso, o valor é igual, mas o momento de medição é diferente.",
      },
      {
        type: "panel",
        title: "Taxa de Conversão",
        lines: [
          "O que é: percentual de leads que avançaram para as etapas de conversão no período.",
          "Como funciona: considera leads com Proposta enviada, Boleto gerado, DPS e Contrato fechado.",
          "Fórmula: (Proposta + Boleto + DPS + Contrato fechado) / total de leads x 100.",
        ],
      },
      {
        type: "panel",
        title: "Potencial de Receita",
        lines: [
          "O que é: valor potencial da base de leads.",
          "Como funciona: soma o valor atual informado em cada lead.",
          "Fórmula: soma do valor potencial atual de todos os leads.",
        ],
      },
      {
        type: "panel",
        title: "Agendamentos",
        lines: [
          "O que é: total de leads que já tiveram agendamento no período.",
          "Como funciona: não depende do status atual do lead.",
          "Fórmula: contagem de leads que tiveram agendamento no período.",
        ],
      },
      {
        type: "panel",
        title: "Negociação",
        lines: [
          "O que é: volume de leads em fase de cotação ou negociação.",
          "Como funciona: soma os leads dessas etapas do funil.",
          "Fórmula: contagem de leads em Cotação + Negociação.",
        ],
      },
      {
        type: "panel",
        title: "Implementação",
        lines: [
          "O que é: volume de leads em etapas finais do processo.",
          "Como funciona: inclui proposta, contrato, boleto e documentos.",
          "Fórmula: contagem de leads nessas etapas de implementação.",
        ],
      },
      {
        type: "panel",
        title: "Vendas realizadas",
        lines: [
          "O que é: leads que geraram boleto mas ainda não tiveram o contrato fechado.",
          "Como funciona: considera o status de Boleto gerado.",
          "Fórmula: contagem de leads com status de boleto gerado no período.",
        ],
      },
      {
        type: "panel",
        title: "Vendas fechadas",
        lines: [
          "O que é: quantidade de negócios com contrato firmado no CRM.",
          "Como funciona: considera o status de Contrato fechado.",
          "Fórmula: contagem de leads com status de contrato fechado no período.",
        ],
      },
      {
        type: "panel",
        title: "Taxa de No-show",
        lines: [
          "O que é: percentual de ausência em reuniões.",
          "Como funciona: compara faltas com a base de quem foi agendado.",
          "Fórmula: (no-show / (agendamentos + no-show)) x 100.",
        ],
      },
      {
        type: "panel",
        title: "Perdidos e desqualificados",
        lines: [
          "O que é: percentual de leads perdidos ou desqualificados sobre o total.",
          "Como funciona: soma leads com status Perdido e Desqualificado.",
          "Fórmula: ((perdidos + desqualificados) / total de leads criados) x 100.",
        ],
      },
      {
        type: "panel",
        title: "Leads por Período",
        lines: [
          "O que é: evolução de entrada e fechamento de leads no tempo.",
          "Como funciona: compara leads criados e conversões no mesmo período.",
          "Fórmula: para cada período, exibir leads criados e leads fechados.",
        ],
      },
    ],
  },
  {
    id: "crm-kanban",
    indexLabel: "09",
    title: "CRM e Kanban de Leads",
    eyebrow: "CRM",
    lead:
      "O coração do sistema. Gerencie leads em um quadro Kanban visual ou em visão de pipeline com filtros avançados.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "statusFlow",
        title: "Estágios do funil",
        items: ["Novo Lead", "Contato Feito", "Reunião Agendada", "Proposta Enviada"],
        terminalItems: ["Vendido", "Perdido"],
      },
      {
        type: "features",
        title: "Modos de visualização",
        columns: 2,
        items: [
          {
            title: "Modo Kanban",
            description:
              "Organiza os leads em colunas por status e permite arrastar cards entre etapas no dia a dia operacional.",
          },
          {
            title: "Modo Pipeline",
            description:
              "Mostra a operação em tabela, facilitando análises e filtros em volumes maiores.",
          },
        ],
      },
      {
        type: "table",
        title: "Filtros disponíveis",
        columns: ["Filtro", "Função"],
        rows: [
          { cells: ["Busca por texto", "Pesquisa por nome, e-mail ou telefone do lead"] },
          { cells: ["Status", "Filtra por uma ou mais etapas do funil"] },
          { cells: ["SDR responsável", "Mostra leads atribuídos a um SDR específico"] },
          { cells: ["Closer responsável", "Filtra pelo closer vinculado ao lead"] },
          { cells: ["Período de entrada", "Restringe por data de criação do lead"] },
          { cells: ["Só reuniões realizadas", "Exibe apenas leads com reunião concluída"] },
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Personalizar cartões do Kanban",
        content:
          "No cabeçalho do quadro, use Configurações para escolher quais dados aparecem nos cards, como nome, data, agendamento, observações ou ID.",
      },
    ],
  },
  {
    id: "leads",
    indexLabel: "10",
    title: "Gerenciar Leads",
    eyebrow: "Leads",
    lead:
      "Criação, edição, atribuição e acompanhamento completo de cada lead desde a entrada até o fechamento ou perda.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "steps",
        title: "Adicionar lead manualmente",
        items: [
          {
            title: 'Clique em "+ Novo Lead"',
            description:
              "No topo do Kanban, abra o painel lateral para cadastrar um novo lead.",
          },
          {
            title: "Preencha os dados do lead",
            description:
              "Informe nome, e-mail, telefone e demais dados disponíveis para melhorar o acompanhamento.",
          },
          {
            title: "Atribua um responsável",
            description:
              "Selecione o SDR ou Closer da equipe. Se ninguém for escolhido, o lead permanece sem atribuição.",
          },
          {
            title: "Salve o lead",
            description:
              "Ao salvar, o lead entra na primeira coluna do funil com um código único gerado automaticamente.",
          },
        ],
      },
      {
        type: "table",
        title: "Campos da ficha de lead",
        columns: ["Campo", "Descrição", "Status"],
        rows: [
          { cells: ["Nome", "Nome completo do prospect", "Obrigatório"], badgeTone: "required" },
          {
            cells: ["E-mail / Telefone", "Contato principal do lead", "Opcional"],
            badgeTone: "optional",
          },
          { cells: ["CNPJ", "Usado em leads PME", "Opcional"], badgeTone: "optional" },
          {
            cells: ["Idades dos beneficiários", "Separadas por vírgula, por exemplo 36, 32, 13", "Opcional"],
            badgeTone: "optional",
          },
          {
            cells: ["Plano / Valor atual", "Operadora e mensalidade atual do lead", "Opcional"],
            badgeTone: "optional",
          },
          {
            cells: ["Hospital de referência", "Einstein, Sírio-Libanês, Rede D'Or e similares", "Opcional"],
            badgeTone: "optional",
          },
          {
            cells: ["Tratamento em andamento", "Exemplos: cardiologia, oncologia", "Opcional"],
            badgeTone: "optional",
          },
          {
            cells: ["Observações", "Campo livre para anotações relevantes", "Opcional"],
            badgeTone: "optional",
          },
          {
            cells: ["Ticket / Plano vendido", "Preenchido no momento do fechamento", "Opcional"],
            badgeTone: "optional",
          },
        ],
      },
      {
        type: "steps",
        title: "Registrar venda — Finalizar contrato",
        items: [
          {
            marker: "A",
            title: "Ticket",
            description: "Valor mensal do contrato fechado.",
          },
          {
            marker: "B",
            title: "Plano vendido",
            description: "Nome do plano ou operadora comercializada.",
          },
          {
            marker: "C",
            title: "Data de vigência",
            description: "Data de início do contrato com o cliente.",
          },
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Registrar perda",
        content:
          'Ao mover um lead para "Perdido", o sistema solicita o motivo da perda. Isso ajuda a analisar objeções e melhorar o processo comercial.',
      },
    ],
  },
  {
    id: "reunioes",
    indexLabel: "11",
    title: "Agendar Reuniões",
    eyebrow: "Reuniões",
    lead:
      "Agende reuniões com leads diretamente pela ficha, com sincronização automática no Google Calendar.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "steps",
        items: [
          {
            title: "Abra a ficha do lead",
            description:
              'No Kanban, clique no card e vá até a seção "Reunião" ou use "Agendar Reunião".',
          },
          {
            title: "Escolha data e horário",
            description:
              "Selecione a data e os horários disponíveis com base na agenda conectada.",
          },
          {
            title: "Adicione título e observações",
            description:
              'Defina um título claro, como "Apresentação de proposta", e registre observações relevantes.',
          },
          {
            title: "Confirme o agendamento",
            description:
              'Clique em "Agendar". O evento é criado no Google Calendar com link do Meet e o lead vai para a etapa correta.',
          },
          {
            title: "Registre o resultado",
            description:
              "Após a data, marque se a reunião foi realizada ou não, pois isso impacta as métricas do time.",
          },
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Reagendar reunião",
        content:
          'Para reagendar, abra a ficha do lead, use "Editar Reunião" e altere data ou hora. O evento no Google Calendar é atualizado automaticamente.',
      },
    ],
  },
  {
    id: "calendar",
    indexLabel: "12",
    title: "Módulo de Calendário",
    eyebrow: "Calendário",
    lead:
      "Visualize todas as reuniões agendadas em um calendário integrado e sincronizado com sua conta Google.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "paragraph",
        content:
          'Acesse "Calendário" no menu lateral para ver a agenda mensal ou semanal das reuniões criadas pelo sistema. Ao clicar em um evento, a ficha do lead correspondente é aberta diretamente.',
      },
      {
        type: "callout",
        tone: "info",
        title: "Pré-requisito",
        content:
          "O calendário funciona plenamente com o Google Calendar conectado. Sem a integração, as reuniões aparecem no sistema, mas não na agenda Google.",
      },
    ],
  },
  {
    id: "carteira",
    indexLabel: "13",
    title: "Carteira de Clientes",
    eyebrow: "Carteira",
    lead:
      "Centralize os contratos fechados em um modulo dedicado para acompanhar a carteira ativa da operacao.",
    availability: "comingSoon",
    audience: "manager",
    availabilityNotice: {
      title: "Funcionalidade em desenvolvimento",
      content:
        "Este modulo ainda nao esta disponivel. Ele sera liberado em breve para acompanhar contratos fechados, status e historico da carteira.",
      tone: "warning",
    },
    blocks: [
      {
        type: "paragraph",
        content:
          "Quando estiver disponivel, a Carteira vai reunir clientes convertidos com plano vendido, ticket, data de contrato, closer responsavel e situacao atual do relacionamento.",
      },
    ],
  },
  {
    id: "performance",
    indexLabel: "14",
    title: "Relatório de Performance",
    eyebrow: "Performance",
    lead:
      "Acompanhe a performance do time com indicadores individuais e comparativos por periodo.",
    availability: "comingSoon",
    audience: "manager",
    availabilityNotice: {
      title: "Funcionalidade em desenvolvimento",
      content:
        "Este modulo ainda nao esta disponivel. Ele sera liberado em breve com visao consolidada de conversao, reunioes e receita por operador.",
      tone: "warning",
    },
    blocks: [
      {
        type: "paragraph",
        content:
          "Quando estiver disponivel, o relatorio vai mostrar produtividade por SDR e closer, taxa de conversao, volume de reunioes e impacto em receita no periodo selecionado.",
      },
    ],
  },
  {
    id: "equipe",
    indexLabel: "15",
    title: "Gerenciar Equipe",
    eyebrow: "Equipe",
    lead:
      "Convide, edite e organize managers, backoffice e operators, definindo tambem funcoes como SDR e Closer dentro da operacao.",
    availability: "available",
    audience: "manager",
    audienceNote:
      "A area de gestao atende perfis manager, backoffice e master. O master concentra o ownership da conta e pode delegar permissoes extras apenas para managers.",
    blocks: [
      {
        type: "table",
        title: "Niveis de acesso",
        columns: ["Perfil", "Liberacoes", "Observacoes"],
        rows: [
          {
            cells: [
              "Master",
              "Ownership da conta e do time, cobranca, criacao e remocao de usuarios, gestao, delecao e transferencia de times.",
              "Nao e um role isolado do enum. O sistema usa isMaster e team.masterId para identificar esse ownership.",
            ],
          },
          {
            cells: [
              "Manager",
              "Acessa gestao de usuarios, configuracoes operacionais e edicao dos dados da equipe.",
              "Pode receber delegacoes do master para cadastrar usuarios e gerenciar times.",
            ],
          },
          {
            cells: [
              "Backoffice",
              "Acesso de gestao equivalente ao manager para a operacao administrativa da conta.",
              "Nao recebe privilegios de master nem as delegacoes extras de criacao de usuarios ou gestao de times.",
            ],
          },
          {
            cells: [
              "Operator",
              "Acesso operacional aos leads, atividades e rotinas do funil do time.",
              "Pode atuar com as funcoes SDR, Closer ou ambas, conforme configuracao.",
            ],
          },
        ],
      },
      {
        type: "features",
        title: "Funcoes operacionais",
        columns: 2,
        items: [
          {
            title: "SDR",
            description:
              "Pode visualizar, editar e agendar os leads dentro da operacao.",
          },
          {
            title: "Closer",
            description:
              "Mantem o mesmo acesso operacional do SDR nos leads, mas so ele pode fechar contratos.",
          },
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "O que e o master",
        content:
          "Master nao e um role separado na lista de niveis. O sistema usa o ownership da conta e do time para liberar cobranca, transferencia de time, remocao de membros e controles superiores de gestao.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Permissoes delegadas do master",
        content:
          "O master pode liberar duas permissoes extras apenas para managers: Pode cadastrar novos usuarios (canCreateAccountUsers) e Pode gerenciar times (canManageAccountTeams). Sem essa delegacao, managers continuam sem criar usuarios adicionais nem criar, editar ou deletar times.",
      },
      {
        type: "steps",
        title: "Fluxo de uso da tela",
        items: [
          {
            title: 'Acesse "Gerenciar Equipe"',
            description:
              "No menu lateral, abra a area de gestao de usuarios para ver managers, backoffice e operators ja cadastrados.",
          },
          {
            title: "Adicionar novo usuario",
            description:
              "Informe nome, e-mail, nivel de acesso e, quando fizer sentido, as funcoes operacionais do usuario.",
          },
          {
            title: "Defina o nivel de acesso correto",
            description:
              "Use os niveis Manager, Backoffice ou Operator. Se estiver criando um manager como master da conta, voce tambem pode ligar as delegacoes de cadastrar usuarios e gerenciar times.",
          },
          {
            title: "O usuario aceita o convite",
            description:
              "Apos aceitar o convite por e-mail e criar a senha, o membro passa a aparecer como ativo na tabela.",
          },
          {
            title: "Atualizar ou remover acessos",
            description:
              "Perfis de gestao podem editar dados e funcoes. A remocao de membros e o ownership da conta seguem a governanca do master.",
          },
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Convites pendentes",
        content:
          'Usuarios convidados que ainda nao aceitaram o acesso aparecem como "Pendente" e podem ser excluidos a qualquer momento.',
      },
    ],
  },
  {
    id: "times",
    indexLabel: "16",
    title: "Organizar em Times",
    eyebrow: "Times — Somente Assinantes Pagos",
    lead:
      "Crie times para separar leads, métricas e visualizações por grupo de trabalho dentro da mesma conta.",
    availability: "paid",
    audience: "master",
    audienceNote:
      "O acesso a times fica com o master da conta ou com managers que receberam a permissao delegada de gerenciar times. O status de master vem do ownership da conta e do time, nao de um role separado do enum.",
    availabilityNotice: {
      title: "Disponível apenas para assinantes pagos",
      content:
        "Este módulo é exclusivo para planos ativos. Contas sem o recurso liberado não conseguem criar múltiplos times.",
      tone: "warning",
    },
    blocks: [
      {
        type: "paragraph",
        content:
          'Ao criar múltiplos times, você pode separar estruturas como "Time SP" e "Time Campinas". Quando o time ativo muda, Kanban, Dashboard e filtros passam a refletir apenas aquele grupo.',
      },
      {
        type: "callout",
        tone: "info",
        title: "Transferencia de ownership",
        content:
          "Ao transferir um time, o novo master assume a cobranca e o gerenciamento daquele grupo. Managers delegados podem administrar times, mas nao transferem o ownership.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Boas práticas",
        content:
          "Use times para separar SDRs por região, produto ou campanha. Isso melhora a leitura de performance sem misturar contextos operacionais.",
      },
    ],
  },
  {
    id: "integracoes",
    indexLabel: "17",
    title: "Integrações e Webhooks",
    eyebrow: "Integrações",
    lead:
      "Receba leads de fontes externas e configure webhooks do Corretor Studio com controles de token, expiracao e logs.",
    availability: "beta",
    audience: "manager",
    audienceNote:
      "O modulo fica disponivel para perfis de gestao em times autorizados. Nesta fase beta, o acesso continua controlado para testes.",
    availabilityNotice: {
      title: "Funcionalidade em beta",
      content:
        "Este modulo ja pode ser usado em times autorizados para testar o formulario de captacao e o webhook generico de leads. Ajustes e expansoes continuam em andamento.",
      tone: "info",
    },
    blocks: [
      {
        type: "features",
        title: "O que ja esta disponivel",
        columns: 2,
        items: [
          {
            title: "Formulario de captacao de leads",
            description:
              "Compartilhe um link nativo para receber leads diretamente no board, incluindo cadastro e agendamento de reuniao com um closer do time.",
          },
          {
            title: "Webhook generico de leads",
            description:
              "Configure um endpoint HTTP POST para receber leads de ferramentas como Make, n8n, Meta Ads ou qualquer automacao externa.",
          },
          {
            title: "Contrato JSON pronto para copiar",
            description:
              "O modulo entrega um modelo com name, email e phone como campos obrigatorios, alem de opcionais como cnpj, ages, source e metadata.",
          },
          {
            title: "Logs recentes de recebimento",
            description:
              "A tela mostra os últimos 15 eventos recebidos, com status HTTP, endpoint utilizado, payload da requisicao e resposta.",
          },
        ],
      },
      {
        type: "table",
        title: "Configuracoes do Studio Webhook",
        columns: ["Opcao", "Como funciona"],
        rows: [
          {
            cells: [
              "Token manual",
              "Voce define o token que fara parte da URL do webhook e controla esse segredo fora da plataforma.",
            ],
          },
          {
            cells: [
              "Token automatico",
              "O sistema gera ou regenera o token conforme a configuracao salva na tela.",
            ],
          },
          {
            cells: [
              "Sem token",
              "Gera uma URL sem protecao por token. Use apenas quando fizer sentido para o ambiente de teste.",
            ],
          },
          {
            cells: [
              "Expiracao em 24 horas",
              "Mantem o token valido por um periodo curto, ideal para testes temporarios ou rotacoes rapidas.",
            ],
          },
          {
            cells: [
              "Expiracao em 6 meses",
              "Mantem o token ativo por um ciclo mais longo de operacao sem exigir rotacao frequente.",
            ],
          },
          {
            cells: [
              "Sem expiracao",
              "Mantem o token valido por tempo indeterminado ate uma nova reconfiguracao manual.",
            ],
          },
        ],
      },
      {
        type: "paragraph",
        title: "Fluxo recomendado",
        content:
          "Use o formulario nativo para captacao simples e o Studio Webhook quando precisar integrar outras fontes de leads ao Corretor Studio com mais controle de autenticacao e automacao.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Logs e contrato JSON",
        content:
          "A propria tela concentra o modelo JSON do webhook, os campos obrigatorios e os detalhes completos dos últimos recebimentos para acelerar validacoes e testes.",
      },
    ],
  },
  {
    id: "assinatura",
    indexLabel: "18",
    title: "Gerenciar sua Assinatura",
    eyebrow: "Assinatura",
    lead:
      "Acesse os detalhes do seu plano, histórico de pagamentos e opções de upgrade ou cancelamento.",
    availability: "available",
    audience: "manager",
    audienceNote:
      "A gestão financeira da conta fica concentrada no manager responsável pelo plano ativo.",
    blocks: [
      {
        type: "paragraph",
        content:
          'Na aba "Assinatura" da conta, você vê plano ativo, data de renovação, status do pagamento e as últimas faturas.',
      },
      {
        type: "table",
        columns: ["Ação", "Como fazer"],
        rows: [
          {
            cells: ["Ver plano ativo", "A aba mostra nome do plano, valor e data de renovação."],
          },
          {
            cells: ["Atualizar cartão", 'Use "Atualizar forma de pagamento" e informe os novos dados.'],
          },
          {
            cells: ["Baixar fatura", "No histórico de cobranças, use o ícone de download da fatura."],
          },
          {
            cells: ["Cancelar assinatura", "Cancele o plano e mantenha o acesso até o fim do período pago."],
          },
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Excluir conta permanentemente",
        content:
          'A exclusão definitiva fica em "Minha Conta → Zona de perigo → Excluir conta". A confirmação exige senha e não pode ser desfeita.',
      },
    ],
  },
  {
    id: "faq",
    indexLabel: "19",
    title: "Perguntas Frequentes",
    eyebrow: "FAQ",
    lead:
      "Respostas rápidas para as dúvidas mais comuns de quem usa o Corretor Studio no dia a dia.",
    availability: "available",
    audience: "all",
    blocks: [
      {
        type: "faq",
        items: [
          {
            question: "Posso usar o Corretor Studio no celular?",
            answer:
              "Sim. O sistema é responsivo e funciona bem em navegadores mobile, como Chrome e Safari. Ainda não existe app nativo.",
          },
          {
            question: "Como um operador faz login?",
            answer:
              "O operador recebe um convite por e-mail, cria a senha e depois acessa normalmente pela tela de login.",
          },
          {
            question: "É possível ter mais de um time na mesma conta?",
            answer:
              "Sim, para assinantes pagos com o recurso liberado. Cada time mantém Kanban e métricas separadas.",
          },
          {
            question: "O que acontece com meus leads se eu cancelar a assinatura?",
            answer:
              "O acesso continua até o fim do período pago. Os dados ficam retidos por um período de segurança, então é recomendável exportar leads antes do vencimento.",
          },
          {
            question: "Posso integrar o Corretor Studio com o Meta Ads?",
            answer:
              "Sim, normalmente via webhook. Um fluxo comum é Meta Ads → n8n → webhook do Corretor Studio.",
          },
          {
            question: "O Google Calendar é obrigatório para agendar reuniões?",
            answer:
              "Não. Sem a integração, você perde o link automático do Meet e a sincronização na agenda Google, mas ainda pode registrar reuniões manualmente.",
          },
          {
            question: "Como entro em contato com o suporte?",
            answer:
              "Use a opção de ajuda no menu lateral ou os canais indicados na área da sua conta. O atendimento ocorre em horário comercial.",
          },
          {
            question: "Quantos leads posso cadastrar?",
            answer:
              "O limite depende do plano contratado. Consulte a aba de assinatura para verificar os limites vigentes da conta.",
          },
        ],
      },
    ],
  },
  {
    id: "whatsapp-inbox", indexLabel: "20", title: "WhatsApp: conexão e Inbox", eyebrow: "WhatsApp", lead: "Conecte o número do time e atenda conversas com segurança no Inbox.", availability: "beta", audience: "all",
    audienceNote: "Managers e masters configuram a conexão. Operadores usam o atendimento diário.",
    blocks: [
      { type: "steps", title: "Primeiros passos", items: [
        { title: "Abra Configurações", description: "Manager ou master acessa WhatsApp → Configurações e cria ou reconecta a instância." },
        { title: "Leia o QR Code", description: "No WhatsApp do celular, use Aparelhos conectados para ler o QR Code exibido." },
        { title: "Confirme o status", description: "Conectado libera o Inbox; Processando indica sincronização de histórico; Desconectado pede reconexão." },
      ] },
      { type: "features", columns: 3, items: [
        { title: "Lista e busca", description: "Use busca, não lidas, minhas e arquivadas para encontrar uma conversa." },
        { title: "Identificação", description: "O Inbox mostra nome confiável, depois telefone formatado, ou Número não disponível." },
        { title: "Mídia e áudio", description: "Envie arquivos e grave áudio pelo microfone; mídia é privada e aberta somente para quem tem acesso." },
      ] },
      { type: "table", title: "Permissões", columns: ["Ação", "Manager/master", "Operator"], rows: [
        { cells: ["Conectar, quota e retenção", "Permitido", "Não permitido"] }, { cells: ["Atender, arquivar e gravar áudio", "Permitido", "Permitido"] }, { cells: ["Alterar regras", "Permitido", "Não permitido"] },
      ] },
      { type: "faq", items: [{ question: "O que significa mensagem pendente de confirmação?", answer: "O provedor não confirmou o resultado. Aguarde a atualização: o sistema não reenvia automaticamente para evitar duplicidade." }] },
    ],
  },
  {
    id: "whatsapp-regras", indexLabel: "21", title: "WhatsApp: regras de atendimento", eyebrow: "Atendimento", lead: "Organize responsáveis, handoff Bot/Humano, tags e vínculo com leads.", availability: "beta", audience: "all",
    blocks: [
      { type: "steps", items: [{ title: "Assuma ou atribua", description: "Use responsável para distribuir conversas não atribuídas ou assumir um atendimento." }, { title: "Escolha o handoff", description: "Humano pausa o bot nesta conversa; devolver ao bot permite as regras novamente." }, { title: "Vincule ao CRM", description: "Crie um lead pré-preenchido ou vincule um lead existente para manter as atividades no histórico." }] },
      { type: "callout", tone: "warning", title: "Evite atendimento duplicado", content: "Antes de responder, confira o responsável e o estado Bot ativo ou Atendimento humano no cabeçalho da conversa." },
      { type: "faq", items: [{ question: "Quem pode alterar a atribuição?", answer: "Managers e masters administram a fila; operadores atendem as conversas que têm permissão para visualizar." }] },
    ],
  },
  {
    id: "whatsapp-auto-respostas", indexLabel: "22", title: "WhatsApp: auto-respostas", eyebrow: "Automação", lead: "Configure boas-vindas, horário e palavras-chave com prioridade previsível.", availability: "beta", audience: "manager",
    audienceNote: "A configuração é restrita a manager e master; operadores visualizam o estado da conversa.",
    blocks: [
      { type: "steps", items: [{ title: "Crie a regra", description: "Em Auto-respostas, escolha boas-vindas, fora do horário ou palavra-chave." }, { title: "Defina prioridade", description: "A regra com prioridade mais alta vence; use textos claros e curtos." }, { title: "Simule antes de ativar", description: "Revise gatilho, horário e resposta antes de liberar para o time." }] },
      { type: "callout", tone: "info", title: "Proteções", content: "O bot não responde quando a conversa está em Atendimento humano e limites anti-loop evitam respostas em cadeia." },
      { type: "faq", items: [{ question: "Por que o bot não respondeu?", answer: "Verifique horário, palavras-chave, prioridade, pausa da conversa e se há atendimento humano ativo." }] },
    ],
  },
  {
    id: "whatsapp-permissoes", indexLabel: "23", title: "WhatsApp: permissões e solução", eyebrow: "Ajuda", lead: "Resolva microfone, conexão, falhas de envio e recuperação do Inbox.", availability: "available", audience: "all",
    blocks: [
      { type: "table", columns: ["Situação", "Como resolver"], rows: [
        { cells: ["Microfone bloqueado", "Permita o microfone nas configurações do navegador e recarregue a página em HTTPS."] }, { cells: ["Falha de envio", "Confira conexão e status; mensagens com falha podem ser revisadas antes de uma nova tentativa."] }, { cells: ["Desconectado", "Manager/master deve reconectar e ler o novo QR Code."] },
      ] },
      { type: "callout", tone: "warning", title: "Permissão de microfone", content: "Chrome, Edge e Safari mostram a permissão na barra de endereço. Se ela foi bloqueada, altere para Permitir e tente gravar novamente." },
      { type: "faq", items: [{ question: "O histórico desapareceu?", answer: "O carregamento pode estar Processando. Aguarde e atualize; o cron de recuperação trata eventos pendentes." }] },
    ],
  },
  {
    id: "whatsapp-privacidade", indexLabel: "24", title: "WhatsApp: privacidade e limites", eyebrow: "Privacidade", lead: "Use dados de clientes somente para atendimento legítimo e dentro dos limites do time.", availability: "available", audience: "all",
    blocks: [
      { type: "features", columns: 3, items: [{ title: "Retenção", description: "Mensagens e mídias são retidas por 90 dias; a auditoria mínima permanece por 365 dias." }, { title: "Mídia privada", description: "Arquivos não são públicos e links de leitura têm curta duração." }, { title: "Quota", description: "Acompanhe o consumo mensal nas configurações para evitar bloqueios operacionais." }] },
      { type: "callout", tone: "warning", title: "Dados de clientes", content: "Não compartilhe conversas, documentos ou números fora do atendimento autorizado. Use apenas contas e dispositivos aprovados pelo time." },
      { type: "faq", items: [{ question: "Posso baixar mídia antiga?", answer: "Após a retenção, a mídia é removida. Salve somente documentos necessários e autorizados nas áreas corretas do CRM." }] },
    ],
  },
]
