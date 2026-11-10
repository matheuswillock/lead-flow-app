import type { LegalDocument } from "./legal-document-types"

// Gerado a partir dos documentos jurídicos oficiais do Corretor Studio (versão de 13/08/2026).
// Para atualizar, substitua o conteúdo mantendo a estrutura de blocos.

export const legalDocuments = {
  "privacy": {
    "title": "Política de Privacidade",
    "updatedAt": "13/08/2026",
    "blocks": [
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio respeita a privacidade dos seus usuários e está comprometido com a proteção dos dados pessoais tratados em sua plataforma."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Esta Política de Privacidade explica como coletamos, utilizamos, armazenamos, compartilhamos e protegemos informações relacionadas ao uso do Corretor Studio, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais – LGPD)."
          }
        ]
      },
      {
        "type": "h2",
        "text": "1. Quem somos"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio é uma plataforma SaaS voltada à gestão comercial de corretores e equipes de vendas de planos de saúde, permitindo o gerenciamento de leads, atividades, agendamentos, comunicações e demais processos relacionados à operação comercial."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Para dúvidas relacionadas à privacidade e proteção de dados, entre em contato pelo e-mail:"
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "suporte@corretorstudio.com",
            "bold": true
          }
        ]
      },
      {
        "type": "h2",
        "text": "2. Dados que coletamos"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Podemos coletar e tratar as seguintes categorias de dados:"
          }
        ]
      },
      {
        "type": "h3",
        "text": "Dados de cadastro"
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Nome completo;"
            }
          ],
          [
            {
              "text": "E-mail;"
            }
          ],
          [
            {
              "text": "Telefone;"
            }
          ],
          [
            {
              "text": "CPF ou CNPJ;"
            }
          ],
          [
            {
              "text": "Cargo e informações profissionais."
            }
          ]
        ]
      },
      {
        "type": "h3",
        "text": "Dados de endereço"
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "CEP;"
            }
          ],
          [
            {
              "text": "Endereço;"
            }
          ],
          [
            {
              "text": "Número;"
            }
          ],
          [
            {
              "text": "Complemento;"
            }
          ],
          [
            {
              "text": "Bairro;"
            }
          ],
          [
            {
              "text": "Cidade;"
            }
          ],
          [
            {
              "text": "Estado."
            }
          ]
        ]
      },
      {
        "type": "h3",
        "text": "Dados de autenticação e acesso"
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Credenciais de acesso;"
            }
          ],
          [
            {
              "text": "Registros de login;"
            }
          ],
          [
            {
              "text": "Endereço IP;"
            }
          ],
          [
            {
              "text": "Informações de dispositivo e navegador;"
            }
          ],
          [
            {
              "text": "Registros de atividade na plataforma."
            }
          ]
        ]
      },
      {
        "type": "h3",
        "text": "Dados operacionais"
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Leads cadastrados;"
            }
          ],
          [
            {
              "text": "Clientes;"
            }
          ],
          [
            {
              "text": "Agendamentos;"
            }
          ],
          [
            {
              "text": "Tarefas;"
            }
          ],
          [
            {
              "text": "Anotações;"
            }
          ],
          [
            {
              "text": "Histórico de interações;"
            }
          ],
          [
            {
              "text": "Informações inseridas pelos usuários autorizados da conta."
            }
          ]
        ]
      },
      {
        "type": "h3",
        "text": "Dados de integração"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Quando autorizadas pelo usuário:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Informações de calendário;"
            }
          ],
          [
            {
              "text": "Tokens de autenticação;"
            }
          ],
          [
            {
              "text": "Eventos criados ou sincronizados através de integrações."
            }
          ]
        ]
      },
      {
        "type": "h3",
        "text": "Dados financeiros"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Processados por parceiros especializados:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Informações relacionadas à assinatura;"
            }
          ],
          [
            {
              "text": "Histórico de cobranças;"
            }
          ],
          [
            {
              "text": "Situação de pagamentos;"
            }
          ],
          [
            {
              "text": "Dados necessários para faturamento."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio não armazena dados completos de cartão de crédito."
          }
        ]
      },
      {
        "type": "h2",
        "text": "3. Como utilizamos os dados"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Utilizamos os dados para:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Criar e administrar contas;"
            }
          ],
          [
            {
              "text": "Permitir acesso à plataforma;"
            }
          ],
          [
            {
              "text": "Gerenciar equipes, operadores e permissões;"
            }
          ],
          [
            {
              "text": "Organizar leads e oportunidades;"
            }
          ],
          [
            {
              "text": "Registrar atividades comerciais;"
            }
          ],
          [
            {
              "text": "Criar e sincronizar eventos de calendário;"
            }
          ],
          [
            {
              "text": "Processar cobranças e assinaturas;"
            }
          ],
          [
            {
              "text": "Prestar suporte técnico;"
            }
          ],
          [
            {
              "text": "Garantir a segurança da plataforma;"
            }
          ],
          [
            {
              "text": "Detectar fraudes e abusos;"
            }
          ],
          [
            {
              "text": "Cumprir obrigações legais e regulatórias;"
            }
          ],
          [
            {
              "text": "Melhorar funcionalidades e desempenho dos serviços."
            }
          ]
        ]
      },
      {
        "type": "h2",
        "text": "4. Dados de leads e clientes cadastrados pelos usuários"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Os dados de leads, clientes e contatos inseridos na plataforma pertencem ao cliente contratante."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Nessas situações:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "O cliente contratante atua como "
            },
            {
              "text": "Controlador dos Dados",
              "bold": true
            },
            {
              "text": ", nos termos da LGPD;"
            }
          ],
          [
            {
              "text": "O Corretor Studio atua como "
            },
            {
              "text": "Operador dos Dados",
              "bold": true
            },
            {
              "text": ", realizando apenas os tratamentos necessários para a prestação dos serviços contratados."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O cliente é responsável por garantir que possui base legal adequada para coletar, armazenar e utilizar os dados inseridos na plataforma."
          }
        ]
      },
      {
        "type": "h2",
        "text": "5. Campanhas de comunicação e integrações"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "A plataforma poderá disponibilizar funcionalidades relacionadas ao envio de comunicações, campanhas, notificações e integrações com serviços de terceiros."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O cliente é integralmente responsável:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Pela origem dos contatos utilizados;"
            }
          ],
          [
            {
              "text": "Pela observância das regras aplicáveis à LGPD;"
            }
          ],
          [
            {
              "text": "Pela obtenção de consentimentos quando exigidos;"
            }
          ],
          [
            {
              "text": "Pelo conteúdo das mensagens enviadas."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio não comercializa listas de contatos nem fornece bases de dados para campanhas."
          }
        ]
      },
      {
        "type": "h2",
        "text": "6. Bases legais para tratamento"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Os dados pessoais poderão ser tratados com fundamento em uma ou mais das seguintes bases legais:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Execução de contrato;"
            }
          ],
          [
            {
              "text": "Cumprimento de obrigação legal ou regulatória;"
            }
          ],
          [
            {
              "text": "Exercício regular de direitos;"
            }
          ],
          [
            {
              "text": "Legítimo interesse;"
            }
          ],
          [
            {
              "text": "Consentimento, quando aplicável;"
            }
          ],
          [
            {
              "text": "Demais hipóteses autorizadas pela LGPD."
            }
          ]
        ]
      },
      {
        "type": "h2",
        "text": "7. Compartilhamento de dados"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Os dados poderão ser compartilhados exclusivamente quando necessário para operação da plataforma e execução dos serviços contratados."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Entre os parceiros utilizados estão:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Supabase (infraestrutura, autenticação e banco de dados);"
            }
          ],
          [
            {
              "text": "Google (integrações de calendário e convites);"
            }
          ],
          [
            {
              "text": "Resend (envio de e-mails transacionais e de campanhas);"
            }
          ],
          [
            {
              "text": "Asaas (processamento de cobranças e assinaturas);"
            }
          ],
          [
            {
              "text": "Prestadores de serviços de hospedagem, monitoramento, comunicação e suporte tecnológico."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Os parceiros contratados estão sujeitos a obrigações de segurança e confidencialidade compatíveis com a legislação aplicável."
          }
        ]
      },
      {
        "type": "h2",
        "text": "8. Cookies e tecnologias similares"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Utilizamos cookies e tecnologias semelhantes para:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Autenticação;"
            }
          ],
          [
            {
              "text": "Manutenção de sessão;"
            }
          ],
          [
            {
              "text": "Segurança;"
            }
          ],
          [
            {
              "text": "Funcionamento da plataforma;"
            }
          ],
          [
            {
              "text": "Análise de desempenho e estabilidade."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "A desativação de determinados cookies poderá afetar funcionalidades essenciais do sistema."
          }
        ]
      },
      {
        "type": "h2",
        "text": "9. Segurança das informações"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados pessoais contra acesso não autorizado, perda, alteração, destruição ou divulgação indevida."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Essas medidas incluem, entre outras:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Criptografia em trânsito;"
            }
          ],
          [
            {
              "text": "Controle de acesso baseado em permissões;"
            }
          ],
          [
            {
              "text": "Autenticação de usuários;"
            }
          ],
          [
            {
              "text": "Monitoramento de segurança;"
            }
          ],
          [
            {
              "text": "Registros de auditoria;"
            }
          ],
          [
            {
              "text": "Backups periódicos;"
            }
          ],
          [
            {
              "text": "Segregação de ambientes e dados."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Embora adotemos práticas de mercado para proteção das informações, nenhum sistema é completamente imune a incidentes de segurança."
          }
        ]
      },
      {
        "type": "h2",
        "text": "10. Retenção dos dados"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Os dados serão mantidos pelo período necessário para:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Prestação dos serviços;"
            }
          ],
          [
            {
              "text": "Cumprimento de obrigações legais;"
            }
          ],
          [
            {
              "text": "Exercício regular de direitos;"
            }
          ],
          [
            {
              "text": "Prevenção a fraudes;"
            }
          ],
          [
            {
              "text": "Atendimento de exigências regulatórias."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Após o término da relação contratual, os dados poderão ser excluídos, anonimizados ou mantidos pelo prazo legal aplicável."
          }
        ]
      },
      {
        "type": "h2",
        "text": "11. Direitos dos titulares"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Nos termos da LGPD, o titular dos dados pode solicitar:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Confirmação da existência de tratamento;"
            }
          ],
          [
            {
              "text": "Acesso aos dados;"
            }
          ],
          [
            {
              "text": "Correção de dados incompletos ou desatualizados;"
            }
          ],
          [
            {
              "text": "Anonimização, bloqueio ou eliminação quando aplicável;"
            }
          ],
          [
            {
              "text": "Portabilidade dos dados;"
            }
          ],
          [
            {
              "text": "Informações sobre compartilhamentos realizados;"
            }
          ],
          [
            {
              "text": "Revogação do consentimento, quando aplicável."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "As solicitações poderão ser encaminhadas para:"
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "suporte@corretorstudio.com",
            "bold": true
          }
        ]
      },
      {
        "type": "h2",
        "text": "12. Alterações desta Política"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Esta Política poderá ser atualizada periodicamente para refletir alterações legais, regulatórias ou evoluções da plataforma."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "A versão mais recente estará sempre disponível nos canais oficiais do Corretor Studio."
          }
        ]
      },
      {
        "type": "h2",
        "text": "13. Contato"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Em caso de dúvidas sobre esta Política de Privacidade ou sobre o tratamento de dados pessoais realizado pelo Corretor Studio, entre em contato:"
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "suporte@corretorstudio.com",
            "bold": true
          }
        ]
      }
    ]
  },
  "terms": {
    "title": "Termos de Uso",
    "updatedAt": "13/08/2026",
    "blocks": [
      {
        "type": "p",
        "segments": [
          {
            "text": "Ao acessar ou utilizar o Corretor Studio, o usuário declara que leu, compreendeu e concorda com estes Termos de Uso."
          }
        ]
      },
      {
        "type": "h2",
        "text": "1. Objeto"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio é uma plataforma SaaS destinada à gestão comercial de corretores e equipes de vendas, oferecendo funcionalidades de gerenciamento de leads, pipeline comercial, atividades, agendamentos, integrações e demais recursos disponibilizados pela plataforma."
          }
        ]
      },
      {
        "type": "h2",
        "text": "2. Cadastro e Conta"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Para utilização dos serviços, poderá ser necessário realizar cadastro e fornecer informações verdadeiras, completas e atualizadas."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O usuário é responsável por:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Manter a confidencialidade de suas credenciais;"
            }
          ],
          [
            {
              "text": "Controlar o acesso dos membros de sua equipe;"
            }
          ],
          [
            {
              "text": "Atualizar seus dados cadastrais quando necessário;"
            }
          ],
          [
            {
              "text": "Notificar imediatamente qualquer uso não autorizado de sua conta."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O usuário responde integralmente pelas atividades realizadas por meio de sua conta."
          }
        ]
      },
      {
        "type": "h2",
        "text": "3. Planos, Assinaturas e Cobrança"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O acesso aos recursos da plataforma poderá depender da contratação de plano pago."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "As cobranças poderão ocorrer de forma mensal, anual ou em outra periodicidade definida no momento da contratação."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Os pagamentos são processados por parceiros especializados de cobrança."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O não pagamento poderá resultar em:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Suspensão temporária dos serviços;"
            }
          ],
          [
            {
              "text": "Restrição de funcionalidades;"
            }
          ],
          [
            {
              "text": "Cancelamento da conta após período de inadimplência."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Os valores pagos não são reembolsáveis, salvo quando exigido por lei ou expressamente previsto em oferta comercial específica."
          }
        ]
      },
      {
        "type": "h2",
        "text": "4. Uso Permitido"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O usuário compromete-se a utilizar a plataforma de forma lícita e compatível com sua finalidade."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "É proibido:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Violar legislação aplicável;"
            }
          ],
          [
            {
              "text": "Utilizar a plataforma para envio de conteúdos ilícitos;"
            }
          ],
          [
            {
              "text": "Tentar acessar áreas restritas ou dados de terceiros;"
            }
          ],
          [
            {
              "text": "Interferir no funcionamento dos sistemas;"
            }
          ],
          [
            {
              "text": "Compartilhar credenciais de forma indevida;"
            }
          ],
          [
            {
              "text": "Utilizar a plataforma para práticas de spam, fraude ou atividades abusivas."
            }
          ]
        ]
      },
      {
        "type": "h2",
        "text": "5. Dados de Leads e Clientes"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Os dados inseridos pelo cliente na plataforma permanecem sob sua titularidade e responsabilidade."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O cliente declara possuir legitimidade e base legal para coletar, armazenar e tratar os dados pessoais cadastrados no sistema."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio atua exclusivamente como operador dos dados necessários para prestação dos serviços contratados."
          }
        ]
      },
      {
        "type": "h2",
        "text": "6. Integrações com Terceiros"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "A plataforma poderá integrar-se a serviços de terceiros, incluindo sistemas de calendário, cobrança, comunicação e armazenamento."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O funcionamento dessas integrações poderá depender da disponibilidade dos respectivos fornecedores."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio não se responsabiliza por indisponibilidades, alterações ou interrupções causadas por serviços de terceiros."
          }
        ]
      },
      {
        "type": "h2",
        "text": "7. Disponibilidade do Serviço"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio empregará esforços razoáveis para manter a plataforma disponível e operacional."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Entretanto, poderão ocorrer interrupções decorrentes de:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Manutenções programadas;"
            }
          ],
          [
            {
              "text": "Atualizações técnicas;"
            }
          ],
          [
            {
              "text": "Falhas de infraestrutura;"
            }
          ],
          [
            {
              "text": "Eventos fora do controle razoável da plataforma."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Não é garantida disponibilidade contínua e ininterrupta dos serviços."
          }
        ]
      },
      {
        "type": "h2",
        "text": "8. Propriedade Intelectual"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Todos os direitos relacionados ao Corretor Studio, incluindo software, marca, identidade visual, funcionalidades, interfaces, códigos, conteúdos e documentação, pertencem exclusivamente ao Corretor Studio."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Nenhuma disposição destes Termos concede ao usuário qualquer direito de propriedade intelectual sobre a plataforma."
          }
        ]
      },
      {
        "type": "h2",
        "text": "9. Limitação de Responsabilidade"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Na máxima extensão permitida pela legislação aplicável, o Corretor Studio não será responsável por:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Lucros cessantes;"
            }
          ],
          [
            {
              "text": "Perda de oportunidades comerciais;"
            }
          ],
          [
            {
              "text": "Danos indiretos;"
            }
          ],
          [
            {
              "text": "Perda de receitas;"
            }
          ],
          [
            {
              "text": "Decisões tomadas pelos usuários com base em informações registradas na plataforma;"
            }
          ],
          [
            {
              "text": "Problemas decorrentes de serviços de terceiros."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "A responsabilidade total do Corretor Studio, quando aplicável, ficará limitada ao valor efetivamente pago pelo cliente nos 12 (doze) meses anteriores ao evento que originar eventual reclamação."
          }
        ]
      },
      {
        "type": "h2",
        "text": "10. Suspensão e Encerramento"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio poderá suspender ou encerrar contas que:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Descumpram estes Termos;"
            }
          ],
          [
            {
              "text": "Pratiquem atividades ilícitas;"
            }
          ],
          [
            {
              "text": "Representem risco à segurança da plataforma;"
            }
          ],
          [
            {
              "text": "Utilizem o sistema de forma abusiva."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O cliente poderá solicitar o cancelamento da assinatura a qualquer momento, observadas as condições comerciais vigentes."
          }
        ]
      },
      {
        "type": "h2",
        "text": "11. Privacidade e Proteção de Dados"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O tratamento de dados pessoais realizado pela plataforma segue as disposições descritas na Política de Privacidade."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Ao utilizar os serviços, o usuário declara estar ciente das práticas descritas nesse documento."
          }
        ]
      },
      {
        "type": "h2",
        "text": "12. Alterações dos Termos"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio poderá atualizar estes Termos periodicamente para refletir alterações legais, regulatórias, operacionais ou tecnológicas."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "A versão mais recente estará sempre disponível nos canais oficiais da plataforma."
          }
        ]
      },
      {
        "type": "h2",
        "text": "13. Legislação Aplicável e Foro"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Estes Termos são regidos pelas leis da República Federativa do Brasil."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Fica eleito o foro da comarca da sede da empresa responsável pelo Corretor Studio para dirimir eventuais controvérsias decorrentes destes Termos, ressalvadas as hipóteses de competência legal obrigatória."
          }
        ]
      }
    ]
  },
  "cookies": {
    "title": "Política de Cookies",
    "updatedAt": "13/08/2026",
    "blocks": [
      {
        "type": "p",
        "segments": [
          {
            "text": "Esta Política de Cookies explica como o Corretor Studio utiliza cookies e tecnologias similares para garantir o funcionamento da plataforma, melhorar a experiência dos usuários e fornecer recursos essenciais para operação dos serviços."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Ao utilizar o Corretor Studio, você concorda com o uso de cookies conforme descrito nesta Política."
          }
        ]
      },
      {
        "type": "h2",
        "text": "1. O que são cookies"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Cookies são pequenos arquivos de texto armazenados em seu navegador ou dispositivo quando você acessa um site ou aplicação."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Eles permitem reconhecer seu navegador, manter sessões ativas, lembrar preferências e coletar informações necessárias para o funcionamento e aprimoramento dos serviços."
          }
        ]
      },
      {
        "type": "h2",
        "text": "2. Como utilizamos cookies"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Utilizamos cookies e tecnologias similares para:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Manter usuários autenticados;"
            }
          ],
          [
            {
              "text": "Garantir a segurança da sessão;"
            }
          ],
          [
            {
              "text": "Armazenar preferências de uso;"
            }
          ],
          [
            {
              "text": "Melhorar a experiência na plataforma;"
            }
          ],
          [
            {
              "text": "Monitorar desempenho e estabilidade dos serviços;"
            }
          ],
          [
            {
              "text": "Identificar falhas técnicas e erros operacionais;"
            }
          ],
          [
            {
              "text": "Gerar métricas agregadas de utilização."
            }
          ]
        ]
      },
      {
        "type": "h2",
        "text": "3. Categorias de cookies utilizados"
      },
      {
        "type": "h3",
        "text": "Cookies Essenciais"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "São necessários para o funcionamento da plataforma."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Permitem, por exemplo:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Login e autenticação;"
            }
          ],
          [
            {
              "text": "Controle de sessão;"
            }
          ],
          [
            {
              "text": "Segurança da conta;"
            }
          ],
          [
            {
              "text": "Controle de acesso;"
            }
          ],
          [
            {
              "text": "Funcionamento de funcionalidades críticas."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "A desativação desses cookies poderá impedir o uso da plataforma."
          }
        ]
      },
      {
        "type": "h3",
        "text": "Cookies de Preferências"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Utilizados para lembrar configurações escolhidas pelo usuário, como preferências de interface e outras personalizações disponíveis."
          }
        ]
      },
      {
        "type": "h3",
        "text": "Cookies Analíticos"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Utilizados para compreender como os usuários interagem com a plataforma, permitindo melhorias contínuas de desempenho, usabilidade e estabilidade."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Sempre que possível, essas informações são analisadas de forma agregada e sem identificação direta do usuário."
          }
        ]
      },
      {
        "type": "h2",
        "text": "4. Cookies de terceiros"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Algumas funcionalidades podem utilizar serviços fornecidos por terceiros."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Esses provedores podem utilizar seus próprios cookies conforme suas respectivas políticas de privacidade e cookies."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Exemplos incluem:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Serviços de autenticação;"
            }
          ],
          [
            {
              "text": "Ferramentas de análise e monitoramento;"
            }
          ],
          [
            {
              "text": "Integrações com serviços externos."
            }
          ]
        ]
      },
      {
        "type": "h2",
        "text": "5. Gerenciamento de cookies"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "A maioria dos navegadores permite visualizar, bloquear ou remover cookies por meio das configurações do próprio navegador."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "A desativação de determinados cookies poderá impactar o funcionamento correto da plataforma e limitar funcionalidades essenciais."
          }
        ]
      },
      {
        "type": "h2",
        "text": "6. Alterações desta Política"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Esta Política poderá ser atualizada periodicamente para refletir alterações legais, regulatórias ou mudanças na utilização de tecnologias de rastreamento."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "A versão mais recente estará sempre disponível nos canais oficiais do Corretor Studio."
          }
        ]
      },
      {
        "type": "h2",
        "text": "7. Contato"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Em caso de dúvidas sobre esta Política de Cookies, entre em contato:"
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "suporte@corretorstudio.com",
            "bold": true
          }
        ]
      }
    ]
  }
} satisfies Record<
  "privacy" | "terms" | "cookies",
  LegalDocument
>
