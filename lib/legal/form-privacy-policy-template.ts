import type { LegalBlock } from "./legal-document-types"

// Modelo de Política de Privacidade para formulários de captação dos clientes.
// Tokens: {{company}}, {{documentLabel}}, {{document}}, {{email}}, {{updatedAt}}.

export const FORM_PRIVACY_POLICY_TEMPLATE: LegalBlock[] = [
  {
    "type": "h2",
    "text": "1. QUEM SOMOS"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Esta página é operada por {{company}}, inscrita no {{documentLabel}} sob o nº {{document}}. A infraestrutura tecnológica, incluindo formulários, cookies e disparo de e-mails, é fornecida pelo Corretor Studio, plataforma de propriedade da Studio Marketing e Tecnologia Ltda (CNPJ 68.647.473/0001-19)."
      }
    ]
  },
  {
    "type": "h2",
    "text": "2. DADOS QUE COLETAMOS"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Ao preencher o formulário ou navegar nesta página, podemos coletar:"
      }
    ]
  },
  {
    "type": "h3",
    "text": "2.1. Dados informados por você"
  },
  {
    "type": "ul",
    "items": [
      [
        {
          "text": "Nome;"
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
          "text": "Empresa e cargo;"
        }
      ],
      [
        {
          "text": "Demais campos preenchidos no formulário."
        }
      ]
    ]
  },
  {
    "type": "h3",
    "text": "2.2. Dados coletados automaticamente por cookies"
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
          "text": "Origem do acesso (link de e-mail, busca orgânica, acesso direto);"
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
    "type": "h2",
    "text": "3. COMO USAMOS SEUS DADOS"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Os dados coletados são utilizados para:"
      }
    ]
  },
  {
    "type": "ul",
    "items": [
      [
        {
          "text": "Responder à sua solicitação ou pedido de contato;"
        }
      ],
      [
        {
          "text": "Enviar comunicações comerciais por e-mail relacionadas ao serviço solicitado;"
        }
      ],
      [
        {
          "text": "Acompanhar seu interesse com base no comportamento de navegação (remarketing por e-mail);"
        }
      ],
      [
        {
          "text": "Melhorar a experiência de navegação e o desempenho da página."
        }
      ]
    ]
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Não utilizamos seus dados para exibir anúncios em outras plataformas (Google, Facebook, Instagram ou similares)."
      }
    ]
  },
  {
    "type": "h2",
    "text": "4. COOKIES"
  },
  {
    "type": "h3",
    "text": "4.1. Cookies necessários"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "São ativados automaticamente para que a página funcione corretamente (sessão, segurança, carregamento). Não dependem de consentimento."
      }
    ]
  },
  {
    "type": "h3",
    "text": "4.2. Cookies de rastreamento"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Registram dados de navegação para permitir o envio de comunicações comerciais por e-mail com base no seu comportamento na página. Esses cookies só são ativados após o seu aceite expresso no formulário."
      }
    ]
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Nenhum cookie de rastreamento é instalado antes do seu consentimento."
      }
    ]
  },
  {
    "type": "h2",
    "text": "5. CONSENTIMENTO"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Ao marcar o checkbox de aceite e enviar o formulário, você autoriza:"
      }
    ]
  },
  {
    "type": "ul",
    "items": [
      [
        {
          "text": "A coleta dos dados informados;"
        }
      ],
      [
        {
          "text": "A ativação dos cookies de rastreamento;"
        }
      ],
      [
        {
          "text": "O envio de comunicações comerciais por e-mail;"
        }
      ],
      [
        {
          "text": "O tratamento dos dados de navegação para remarketing por e-mail."
        }
      ]
    ]
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Você pode revogar esse consentimento a qualquer momento, conforme a seção 7."
      }
    ]
  },
  {
    "type": "h2",
    "text": "6. COMPARTILHAMENTO"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Seus dados podem ser compartilhados com a {{company}} e com a Studio Marketing e Tecnologia Ltda (fornecedora da infraestrutura tecnológica), exclusivamente para a execução dos serviços descritos nesta Política."
      }
    ]
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Não vendemos, alugamos ou compartilhamos seus dados com terceiros para finalidades de publicidade."
      }
    ]
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Seus dados podem ser armazenados em servidores localizados fora do Brasil, por meio de parceiros de infraestrutura que adotam padrões de segurança compatíveis com a legislação brasileira."
      }
    ]
  },
  {
    "type": "h2",
    "text": "7. SEUS DIREITOS"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Nos termos da Lei nº 13.709/2018 (LGPD), você pode a qualquer momento:"
      }
    ]
  },
  {
    "type": "ul",
    "items": [
      [
        {
          "text": "Solicitar acesso aos seus dados;"
        }
      ],
      [
        {
          "text": "Corrigir dados incompletos ou desatualizados;"
        }
      ],
      [
        {
          "text": "Solicitar a exclusão dos seus dados;"
        }
      ],
      [
        {
          "text": "Revogar o consentimento dado;"
        }
      ],
      [
        {
          "text": "Solicitar o descadastro de comunicações por e-mail."
        }
      ]
    ]
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Para exercer qualquer desses direitos:"
      }
    ]
  },
  {
    "type": "ul",
    "items": [
      [
        {
          "text": "Clique no link de descadastro presente em qualquer e-mail recebido;"
        }
      ]
    ]
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Ou envie um e-mail para {{email}}."
      }
    ]
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Responderemos em até 15 (quinze) dias."
      }
    ]
  },
  {
    "type": "h2",
    "text": "8. RETENÇÃO"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Seus dados serão mantidos pelo período necessário à finalidade que motivou a coleta. Dados de navegação coletados por cookies são eliminados quando não houver mais finalidade comercial, ou antes disso mediante seu pedido de descadastro ou revogação do consentimento."
      }
    ]
  },
  {
    "type": "h2",
    "text": "9. SEGURANÇA"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda, alteração ou divulgação indevida."
      }
    ]
  },
  {
    "type": "h2",
    "text": "10. ALTERAÇÕES"
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Esta Política pode ser atualizada. A versão mais recente estará sempre disponível nesta página, com a data da última atualização."
      }
    ]
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Última atualização: {{updatedAt}}"
      }
    ]
  },
  {
    "type": "p",
    "segments": [
      {
        "text": "Infraestrutura tecnológica: Corretor Studio · Studio Marketing e Tecnologia Ltda · CNPJ 68.647.473/0001-19"
      }
    ]
  }
]
