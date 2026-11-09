import type { LegalDocument } from "./legal-document-types"

// Documentos da contratação do software (versão de 27 de agosto de 2026): Termos de Uso e
// Política de Privacidade, que já cobre cookies. Valem só para a tela de contratação (`/contratacao/*`);
// as páginas públicas do site (`/terms`, `/privacy-policy`) usam `legal-documents-data.ts`.

export const contractingDocuments = {
  "terms": {
    "title": "Termos de Uso",
    "updatedAt": "27 de agosto de 2026",
    "blocks": [
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio é uma plataforma de propriedade da Studio Marketing e Tecnologia Ltda, inscrita no CNPJ sob o nº 68.647.473/0001-19. Toda referência a Corretor Studio nestes documentos designa essa empresa."
          }
        ]
      },
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
        "text": "1. OBJETO"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "1.1. O Corretor Studio é uma plataforma SaaS destinada à gestão comercial de corretores e equipes de vendas, oferecendo funcionalidades de gerenciamento de leads, pipeline comercial, atividades, agendamentos, disparo de e-mail marketing, integrações e demais recursos disponibilizados."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "1.2. Determinados serviços, como geração de listas de prospecção, disparo de campanhas e criação de templates, podem ser prestados de forma assistida pela equipe do Corretor Studio, conforme o que estiver contratado."
          }
        ]
      },
      {
        "type": "h2",
        "text": "2. CADASTRO E CONTA"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "2.1. Para utilização dos serviços, poderá ser necessário realizar cadastro e fornecer informações verdadeiras, completas e atualizadas."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "2.2. O usuário é responsável por:"
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
            "text": "2.3. O usuário responde integralmente pelas atividades realizadas por meio de sua conta."
          }
        ]
      },
      {
        "type": "h2",
        "text": "3. PLANOS, ASSINATURAS E COBRANÇA"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "3.1. O acesso aos recursos da plataforma poderá depender da contratação de plano pago ou de contrato de prestação de serviços específico."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "3.2. As cobranças poderão ocorrer de forma mensal, trimestral, quadrimestral, anual ou em outra periodicidade definida no momento da contratação."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "3.3. Os pagamentos são processados por parceiros especializados de cobrança."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "3.4. O não pagamento poderá resultar em:"
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
            "text": "3.5. Os valores pagos não são reembolsáveis, salvo quando expressamente previsto em oferta comercial específica."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "3.6. Os serviços do Corretor Studio são destinados exclusivamente a pessoas jurídicas e profissionais no exercício de sua atividade comercial, não se caracterizando relação de consumo."
          }
        ]
      },
      {
        "type": "h2",
        "text": "4. USO PERMITIDO"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "4.1. O usuário compromete-se a utilizar a plataforma de forma lícita e compatível com sua finalidade."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "4.2. É proibido:"
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
              "text": "Utilizar a plataforma para práticas de spam, fraude ou atividades abusivas;"
            }
          ],
          [
            {
              "text": "Utilizar listas de contatos sem base legal adequada."
            }
          ]
        ]
      },
      {
        "type": "h2",
        "text": "5. DADOS INSERIDOS PELO CLIENTE"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "5.1. Os dados inseridos pelo cliente na plataforma permanecem sob sua titularidade e responsabilidade."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "5.2. Em relação a esses dados, o cliente atua como Controlador e o Corretor Studio atua como Operador, nos termos da Lei nº 13.709/2018."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "5.3. O cliente declara possuir legitimidade e base legal para coletar, armazenar e tratar os dados pessoais cadastrados no sistema."
          }
        ]
      },
      {
        "type": "h2",
        "text": "6. LISTAS DE PROSPECÇÃO FORNECIDAS PELO CORRETOR STUDIO"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "6.1. Quando expressamente contratado, o Corretor Studio poderá elaborar e entregar ao cliente listas de prospecção de pessoas jurídicas, segmentadas conforme o nicho de mercado indicado pelo cliente."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "6.2. Esse serviço é opcional e não integra automaticamente todos os planos ou contratos."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "6.3. As listas são construídas exclusivamente a partir de dados cadastrais de pessoas jurídicas obtidos no Portal de Dados Abertos da Receita Federal do Brasil, tais como razão social, nome fantasia, CNPJ, CNAE, natureza jurídica, porte, endereço fiscal, telefone e endereço eletrônico declarados no cadastro."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "6.4. As listas têm por objeto contatos profissionais de pessoas jurídicas. Eventuais registros equiparados a pessoa natural para fins da Lei nº 13.709/2018 que venham a compor a base são tratados com fundamento no legítimo interesse, assegurado o direito de oposição previsto no item 6.7."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "6.5. O Corretor Studio não comercializa, não adquire e não licencia bases de dados de terceiros, não utiliza dados obtidos por raspagem de plataformas privadas e não fornece dados pessoais sensíveis."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "6.6. Em relação aos dados que compõem essas listas, o Corretor Studio atua como Controlador, com fundamento no legítimo interesse previsto no art. 7º, inciso IX, da Lei nº 13.709/2018, observado o disposto na Política de Privacidade."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "6.7. Toda comunicação enviada por meio da plataforma deve conter identificação do remetente e mecanismo de descadastro visível e funcional. Pedidos de descadastro e de oposição devem ser atendidos e mantidos válidos para todas as campanhas futuras."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "6.8. O cliente é responsável pelo conteúdo das mensagens enviadas, pela oferta veiculada e pela observância das normas aplicáveis à sua atividade profissional, incluindo as regras da Superintendência de Seguros Privados e da Agência Nacional de Saúde Suplementar, quando aplicáveis."
          }
        ]
      },
      {
        "type": "h2",
        "text": "7. INTEGRAÇÕES COM TERCEIROS"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "7.1. A plataforma poderá integrar-se a serviços de terceiros, incluindo sistemas de calendário, cobrança, comunicação e armazenamento."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "7.2. O funcionamento dessas integrações poderá depender da disponibilidade dos respectivos fornecedores."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "7.3. O Corretor Studio não se responsabiliza por indisponibilidades, alterações ou interrupções causadas por serviços de terceiros."
          }
        ]
      },
      {
        "type": "h2",
        "text": "8. DISPONIBILIDADE DO SERVIÇO"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "8.1. O Corretor Studio empregará esforços razoáveis para manter a plataforma disponível e operacional."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "8.2. Poderão ocorrer interrupções decorrentes de manutenções programadas, atualizações técnicas, falhas de infraestrutura ou eventos fora do controle razoável da plataforma."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "8.3. Não é garantida disponibilidade contínua e ininterrupta dos serviços."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "8.4. O Corretor Studio não se responsabiliza por bloqueios, filtros de spam, políticas de entrega ou reputação de domínio impostos por provedores de e-mail alheios ao seu controle."
          }
        ]
      },
      {
        "type": "h2",
        "text": "9. PROPRIEDADE INTELECTUAL"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "9.1. Todos os direitos relacionados ao Corretor Studio, incluindo software, marca, identidade visual, funcionalidades, interfaces, códigos, conteúdos e documentação, pertencem exclusivamente à Studio Marketing e Tecnologia Ltda."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "9.2. Nenhuma disposição destes Termos concede ao usuário qualquer direito de propriedade intelectual sobre a plataforma."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "9.3. Os ativos gerados pela prestação de serviços, como templates, listas segmentadas e métricas de desempenho, pertencem ao cliente, não se confundindo com o software que os hospeda ou processa."
          }
        ]
      },
      {
        "type": "h2",
        "text": "10. LIMITAÇÃO DE RESPONSABILIDADE"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "10.1. O Corretor Studio não garante aumento de vendas, fechamento de contratos ou resultados financeiros específicos, tratando-se de obrigação de meio e não de resultado."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "10.2. Na máxima extensão permitida pela legislação aplicável, o Corretor Studio não será responsável por lucros cessantes, perda de oportunidades comerciais, danos indiretos, perda de receitas, decisões tomadas pelos usuários com base em informações registradas na plataforma ou problemas decorrentes de serviços de terceiros."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "10.3. A responsabilidade total do Corretor Studio fica limitada ao valor efetivamente pago pelo cliente nos 12 (doze) meses anteriores ao evento que originar eventual reclamação. Havendo contrato específico assinado entre as partes, prevalece o limite nele estabelecido."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "10.4. As limitações desta seção não se aplicam às hipóteses de dolo ou má-fé, nem afastam obrigações que a legislação declare irrenunciáveis."
          }
        ]
      },
      {
        "type": "h2",
        "text": "11. SUSPENSÃO E ENCERRAMENTO"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "11.1. O Corretor Studio poderá suspender ou encerrar contas que descumpram estes Termos, pratiquem atividades ilícitas, representem risco à segurança da plataforma ou utilizem o sistema de forma abusiva."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "11.2. O cliente poderá solicitar o cancelamento a qualquer momento, observadas as condições comerciais vigentes ou o contrato específico assinado."
          }
        ]
      },
      {
        "type": "h2",
        "text": "12. PRIVACIDADE E PROTEÇÃO DE DADOS"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "12.1. O tratamento de dados pessoais realizado pela plataforma segue as disposições descritas na Política de Privacidade, que integra estes Termos."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "12.2. Ao utilizar os serviços, o usuário declara estar ciente das práticas descritas naquele documento."
          }
        ]
      },
      {
        "type": "h2",
        "text": "13. ALTERAÇÕES DESTES TERMOS"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "13.1. O Corretor Studio poderá atualizar estes Termos para refletir alterações legais, regulatórias, operacionais ou tecnológicas."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "13.2. Alterações relevantes serão comunicadas ao cliente por e-mail ou por aviso na plataforma com antecedência mínima de 30 (trinta) dias da entrada em vigor."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "13.3. A versão mais recente estará sempre disponível nos canais oficiais da plataforma, com indicação da data de atualização."
          }
        ]
      },
      {
        "type": "h2",
        "text": "14. PREVALÊNCIA DO CONTRATO"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "14.1. Havendo contrato de prestação de serviços assinado entre o cliente e a Studio Marketing e Tecnologia Ltda, as disposições do contrato prevalecem sobre estes Termos em caso de divergência."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "14.2. Estes Termos permanecem aplicáveis em tudo o que não conflitar com o contrato assinado."
          }
        ]
      },
      {
        "type": "h2",
        "text": "15. LEGISLAÇÃO APLICÁVEL E FORO"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "15.1. Estes Termos são regidos pelas leis da República Federativa do Brasil."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "15.2. Fica eleito o foro da Comarca de Cajamar/SP para dirimir eventuais controvérsias, ressalvadas as hipóteses de competência legal obrigatória."
          }
        ]
      },
      {
        "type": "h2",
        "text": "16. CONTATO"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Dúvidas sobre estes Termos podem ser encaminhadas para suporte@corretorstudio.com."
          }
        ]
      }
    ]
  },
  "privacy": {
    "title": "Política de Privacidade",
    "updatedAt": "27 de agosto de 2026",
    "blocks": [
      {
        "type": "p",
        "segments": [
          {
            "text": "O Corretor Studio é uma plataforma de propriedade da Studio Marketing e Tecnologia Ltda, inscrita no CNPJ sob o nº 68.647.473/0001-19. Toda referência a Corretor Studio nestes documentos designa essa empresa."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Esta Política explica como coletamos, utilizamos, armazenamos, compartilhamos e protegemos informações relacionadas ao uso do Corretor Studio, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais)."
          }
        ]
      },
      {
        "type": "h2",
        "text": "1. QUEM SOMOS E COMO FALAR CONOSCO"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "1.1. O Corretor Studio é uma plataforma SaaS voltada à gestão comercial de corretores e equipes de vendas, permitindo o gerenciamento de leads, atividades, agendamentos, comunicações e demais processos relacionados à operação comercial."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "1.2. O canal oficial para assuntos de privacidade e proteção de dados, incluindo o exercício de direitos por titulares, é o e-mail suporte@corretorstudio.com."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "1.3. Esse canal cumpre a função de comunicação prevista no art. 41 da Lei nº 13.709/2018, observado o regime simplificado aplicável a agentes de tratamento de pequeno porte."
          }
        ]
      },
      {
        "type": "h2",
        "text": "2. NOSSOS DOIS PAPÉIS"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "2.1. O Corretor Studio atua em dois papéis distintos, e é importante que essa diferença fique clara."
          }
        ]
      },
      {
        "type": "h3",
        "text": "2.2. Como Operador"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Em relação aos dados que o cliente insere na plataforma, como sua carteira, seus leads, seus contatos e seu histórico comercial, o cliente é o Controlador e o Corretor Studio é o Operador. Tratamos esses dados apenas para prestar os serviços contratados."
          }
        ]
      },
      {
        "type": "h3",
        "text": "2.3. Como Controlador"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Em relação às listas de prospecção de pessoas jurídicas que nós mesmos elaboramos e entregamos ao cliente, quando esse serviço é contratado, o Corretor Studio atua como Controlador, pois define a origem, os critérios e a finalidade da coleta. As regras aplicáveis estão na seção 5."
          }
        ]
      },
      {
        "type": "h2",
        "text": "3. DADOS QUE COLETAMOS"
      },
      {
        "type": "h3",
        "text": "3.1. Dados de cadastro"
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
        "text": "3.2. Dados de endereço"
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "CEP, endereço, número, complemento, bairro, cidade e estado."
            }
          ]
        ]
      },
      {
        "type": "h3",
        "text": "3.3. Dados de autenticação e acesso"
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
        "text": "3.4. Dados operacionais inseridos pelo cliente"
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Leads, clientes, agendamentos, tarefas, anotações e histórico de interações;"
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
        "text": "3.5. Dados de integração"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Quando autorizadas pelo usuário: informações de calendário, tokens de autenticação e eventos criados ou sincronizados."
          }
        ]
      },
      {
        "type": "h3",
        "text": "3.6. Dados financeiros"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Processados por parceiros especializados: informações relacionadas à assinatura, histórico de cobranças, situação de pagamentos e dados necessários para faturamento. O Corretor Studio não armazena dados completos de cartão de crédito."
          }
        ]
      },
      {
        "type": "h2",
        "text": "4. COMO UTILIZAMOS OS DADOS"
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
              "text": "Elaborar listas de prospecção de pessoas jurídicas, quando contratado;"
            }
          ],
          [
            {
              "text": "Executar disparos de e-mail marketing aprovados pelo cliente;"
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
              "text": "Garantir a segurança da plataforma e detectar fraudes e abusos;"
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
        "text": "5. LISTAS DE PROSPECÇÃO DE PESSOAS JURÍDICAS"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "5.1. Quando contratado, elaboramos listas de prospecção de pessoas jurídicas segmentadas conforme o nicho de mercado indicado pelo cliente."
          }
        ]
      },
      {
        "type": "h3",
        "text": "5.2. Origem dos dados"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Os dados são obtidos exclusivamente no Portal de Dados Abertos da Receita Federal do Brasil, que divulga publicamente o cadastro nacional de pessoas jurídicas. Utilizamos campos como razão social, nome fantasia, CNPJ, CNAE, natureza jurídica, porte, situação cadastral, endereço fiscal, telefone e endereço eletrônico declarados no cadastro."
          }
        ]
      },
      {
        "type": "h3",
        "text": "5.3. O que não fazemos"
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Não compramos, não licenciamos e não revendemos bases de dados de terceiros;"
            }
          ],
          [
            {
              "text": "Não obtemos dados por raspagem de redes sociais ou plataformas privadas;"
            }
          ],
          [
            {
              "text": "Não coletamos CPF, telefone pessoal ou endereço residencial de sócios;"
            }
          ],
          [
            {
              "text": "Não tratamos dados pessoais sensíveis para essa finalidade;"
            }
          ],
          [
            {
              "text": "Não comercializamos listas de contatos."
            }
          ]
        ]
      },
      {
        "type": "h3",
        "text": "5.4. Registros equiparados a pessoa natural"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "As listas têm por objeto contatos profissionais de pessoas jurídicas. Determinadas figuras inscritas no cadastro nacional, como o microempreendedor individual e o empresário individual, são equiparadas a pessoa natural para fins da Lei nº 13.709/2018. Quando esses registros compuserem a base, o tratamento observa a base legal do item 5.5 e o direito de oposição do item 5.6."
          }
        ]
      },
      {
        "type": "h3",
        "text": "5.5. Base legal"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O tratamento se apoia no legítimo interesse previsto no art. 7º, inciso IX, da Lei nº 13.709/2018, aplicado a contato profissional com pessoas jurídicas, e no art. 7º, parágrafo 4º, quanto a dados tornados manifestamente públicos."
          }
        ]
      },
      {
        "type": "h3",
        "text": "5.6. Transparência e direito de oposição"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Toda comunicação enviada por meio da plataforma identifica o remetente e informa a origem do contato. Todo e-mail contém mecanismo de descadastro visível e funcional. Pedidos de descadastro e de oposição são atendidos e permanecem válidos para campanhas futuras."
          }
        ]
      },
      {
        "type": "h3",
        "text": "5.7. Responsabilidade do cliente"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "O cliente é responsável pelo conteúdo das mensagens enviadas, pela oferta veiculada e pela observância das normas aplicáveis à sua atividade profissional."
          }
        ]
      },
      {
        "type": "h2",
        "text": "6. BASES LEGAIS PARA TRATAMENTO"
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
              "text": "Demais hipóteses autorizadas pela Lei nº 13.709/2018."
            }
          ]
        ]
      },
      {
        "type": "h2",
        "text": "7. COMPARTILHAMENTO E TRANSFERÊNCIA INTERNACIONAL"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "7.1. Os dados poderão ser compartilhados exclusivamente quando necessário para operação da plataforma e execução dos serviços contratados. Entre os parceiros utilizados estão:"
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
              "text": "Prestadores de hospedagem, monitoramento, comunicação e suporte tecnológico."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "7.2. Alguns desses parceiros mantêm infraestrutura fora do território brasileiro. Isso significa que dados pessoais poderão ser transferidos e armazenados no exterior."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "7.3. Essas transferências ocorrem com fundamento nas hipóteses do art. 33 da Lei nº 13.709/2018, especialmente a necessidade de execução de contrato, e são acompanhadas de cláusulas contratuais de segurança e confidencialidade firmadas com os fornecedores."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "7.4. Não vendemos dados pessoais nem os utilizamos para finalidades distintas da execução dos serviços contratados, exceto quando houver obrigação legal ou autorização expressa."
          }
        ]
      },
      {
        "type": "h2",
        "text": "8. COOKIES E TECNOLOGIAS SIMILARES"
      },
      {
        "type": "h3",
        "text": "8.1. O que são cookies"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Cookies são pequenos arquivos de texto armazenados no navegador do visitante que permitem identificar e registrar informações sobre a navegação."
          }
        ]
      },
      {
        "type": "h3",
        "text": "8.2. Cookies na plataforma Corretor Studio"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Na plataforma, utilizamos cookies estritamente necessários para autenticação, manutenção de sessão, segurança e funcionamento do sistema. Esses cookies operam com base no legítimo interesse e não dependem de consentimento prévio."
          }
        ]
      },
      {
        "type": "h3",
        "text": "8.3. Cookies em formulários e páginas de captação"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Em formulários, landing pages e páginas de captação operados pelo Corretor Studio ou por seus clientes com uso da infraestrutura da plataforma, poderão ser utilizados cookies e tecnologias próprias de rastreamento para as seguintes finalidades:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Identificação do visitante e do dispositivo utilizado;"
            }
          ],
          [
            {
              "text": "Registro de dados de navegação, como endereço IP, tipo de navegador, sistema operacional, páginas visitadas, tempo de permanência e origem do acesso;"
            }
          ],
          [
            {
              "text": "Envio posterior de comunicações comerciais por e-mail com base no comportamento de navegação observado (remarketing por e-mail)."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "8.4. Esses cookies coletam dados de pessoa física, independentemente de o formulário ter sido direcionado a uma pessoa jurídica. Por isso, sua ativação depende de consentimento prévio, livre, informado e inequívoco do visitante, manifestado antes do início da coleta."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "8.5. O consentimento é coletado por meio de aceite expresso no próprio formulário ou página de captação, antes do envio dos dados. Nenhum cookie de rastreamento é ativado antes dessa manifestação."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "8.6. O visitante pode revogar o consentimento a qualquer momento por meio do mecanismo de descadastro presente em toda comunicação enviada ou pelo canal suporte@corretorstudio.com. A revogação interrompe o envio de novas comunicações e desativa os cookies de rastreamento vinculados àquele visitante."
          }
        ]
      },
      {
        "type": "h3",
        "text": "8.7. Dados coletados pelos cookies"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Os cookies de rastreamento podem coletar:"
          }
        ]
      },
      {
        "type": "ul",
        "items": [
          [
            {
              "text": "Endereço IP;"
            }
          ],
          [
            {
              "text": "Tipo e versão do navegador;"
            }
          ],
          [
            {
              "text": "Sistema operacional;"
            }
          ],
          [
            {
              "text": "Resolução de tela;"
            }
          ],
          [
            {
              "text": "Páginas visitadas e tempo de permanência;"
            }
          ],
          [
            {
              "text": "Origem do acesso (link direto, campanha de e-mail, busca orgânica);"
            }
          ],
          [
            {
              "text": "Data e horário do acesso."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "8.8. Esses dados são tratados exclusivamente para a finalidade de remarketing por e-mail e não são compartilhados com plataformas de publicidade de terceiros."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "8.9. Os dados de navegação coletados por cookies são mantidos pelo período necessário à finalidade comercial que motivou a coleta e eliminados mediante pedido de revogação do consentimento ou de oposição do titular."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "8.10. A desativação de cookies necessários poderá afetar funcionalidades essenciais do sistema."
          }
        ]
      },
      {
        "type": "h2",
        "text": "9. SEGURANÇA DAS INFORMAÇÕES"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "9.1. Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados pessoais contra acesso não autorizado, perda, alteração, destruição ou divulgação indevida, entre elas:"
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
            "text": "9.2. Embora adotemos práticas de mercado, nenhum sistema é completamente imune a incidentes de segurança."
          }
        ]
      },
      {
        "type": "h2",
        "text": "10. INCIDENTES DE SEGURANÇA"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "10.1. Identificado incidente de segurança que possa acarretar risco ou dano relevante aos titulares, comunicaremos o cliente afetado em prazo razoável a contar da ciência, informando a natureza do incidente, os dados envolvidos, as medidas adotadas e as recomendações aplicáveis."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "10.2. A comunicação à Autoridade Nacional de Proteção de Dados e aos titulares será realizada nos termos do art. 48 da Lei nº 13.709/2018."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "10.3. Quando atuarmos como Operador, apoiaremos o cliente, na qualidade de Controlador, no cumprimento de suas obrigações de comunicação."
          }
        ]
      },
      {
        "type": "h2",
        "text": "11. RETENÇÃO E EXCLUSÃO DOS DADOS"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "11.1. Os dados serão mantidos pelo período necessário à prestação dos serviços, ao cumprimento de obrigações legais, ao exercício regular de direitos, à prevenção a fraudes e ao atendimento de exigências regulatórias."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "11.2. Encerrada a relação contratual, os dados poderão ser mantidos por até 60 (sessenta) dias corridos, exclusivamente para possibilitar eventual reativação, cumprimento de obrigações legais ou regulatórias, prevenção de fraudes e exercício regular de direitos."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "11.3. Durante esse período de retenção, o cliente não terá acesso à plataforma nem aos dados nela armazenados, salvo mediante reativação e regularização de eventuais pendências."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "11.4. Decorrido o prazo, promoveremos a exclusão definitiva, permanente e irreversível dos dados, ressalvados os registros cuja conservação seja exigida por lei ou por determinação de autoridade competente."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "11.5. Registros de acesso a aplicações de internet são mantidos por 6 (seis) meses, nos termos do art. 15 da Lei nº 12.965/2014."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "11.6. Dados utilizados em listas de prospecção são mantidos pelo período necessário à finalidade comercial que motivou a coleta e eliminados quando essa finalidade se exaurir, ou antes disso mediante pedido de oposição do titular."
          }
        ]
      },
      {
        "type": "h2",
        "text": "12. DIREITOS DOS TITULARES"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "12.1. Nos termos da Lei nº 13.709/2018, o titular dos dados pode solicitar:"
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
              "text": "Correção de dados incompletos, inexatos ou desatualizados;"
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
              "text": "Revogação do consentimento, quando aplicável;"
            }
          ],
          [
            {
              "text": "Oposição ao tratamento fundado em legítimo interesse."
            }
          ]
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "12.2. As solicitações devem ser encaminhadas para suporte@corretorstudio.com."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "12.3. Responderemos em formato simplificado de forma imediata sempre que possível, e em até 15 (quinze) dias nos casos que exijam declaração completa, conforme o art. 19 da Lei nº 13.709/2018."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "12.4. Quando o pedido se referir a dados sob controle do cliente contratante, encaminharemos a solicitação a ele e prestaremos o apoio necessário."
          }
        ]
      },
      {
        "type": "h2",
        "text": "13. ALTERAÇÕES DESTA POLÍTICA"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "13.1. Esta Política poderá ser atualizada para refletir alterações legais, regulatórias ou evoluções da plataforma."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "13.2. Alterações relevantes serão comunicadas por e-mail ou por aviso na plataforma com antecedência mínima de 30 (trinta) dias."
          }
        ]
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "13.3. A versão mais recente estará sempre disponível nos canais oficiais, com indicação da data de atualização."
          }
        ]
      },
      {
        "type": "h2",
        "text": "14. CONTATO"
      },
      {
        "type": "p",
        "segments": [
          {
            "text": "Em caso de dúvidas sobre esta Política ou sobre o tratamento de dados pessoais realizado pelo Corretor Studio, entre em contato pelo e-mail suporte@corretorstudio.com."
          }
        ]
      }
    ]
  }
} satisfies Record<
  "terms" | "privacy",
  LegalDocument
>
