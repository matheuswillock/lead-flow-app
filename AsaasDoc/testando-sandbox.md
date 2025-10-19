

# Introdução

Apesar de funcionar de forma muito parecida com o ambiente de produção, algumas funcionalidades precisam ser testadas de um jeito específico.

Nas páginas abaixo, você encontra instruções detalhadas de como testar cada uma dessas funcionalidades no sandbox:

* [Como realizar transferências.](https://docs.asaas.com/docs/testando-transfer%C3%AAncias#/)
* [Como simular contas a pagar.](https://docs.asaas.com/docs/testando-pagamento-de-contas#/)
* [Como testar pagamento com cartão de crédito.](https://docs.asaas.com/docs/testando-pagamento-com-cart%C3%A3o-de-cr%C3%A9dito#/)
* [Como testar um pagamento via QR Code.](https://docs.asaas.com/docs/testar-pagamento-de-qrcodes-pix#/)
* [Como testar ações críticas.](https://docs.asaas.com/docs/como-testar-a%C3%A7%C3%B5es-cr%C3%ADticas#/)
* [Tentar pagar QR Code Pix no Sandbox sem chave cadastrada = erro 404.](https://docs.asaas.com/docs/tentar-pagar-qr-code-pix-no-sandbox-sem-chave-cadastrada-erro-404#/)
* [Como gerar novas cobranças de uma assinatura.](https://docs.asaas.com/docs/como-gerar-novas-cobran%C3%A7as-de-uma-assinatura#/)

Confira também as funcionalidades que podem ser testadas em nosso sandbox [aqui](https://docs.asaas.com/docs/o-que-pode-ser-testado).

Além disso, você pode utilizar a nossa documentação para realizar chamadas diretamente no ambiente de sandbox. Veja como fazer isso aqui: <Anchor label="Como testar chamadas na documentação" target="_blank" href="https://docs.asaas.com/reference/como-testar-as-chamadas-aqui-na-documenta%C3%A7%C3%A3o">Como testar chamadas na documentação</Anchor>.




Para cobranças em cartão de crédito você pode usar cartões de teste para simular um pagamento direto pelos endpoints para criar cobrança com cartão de crédito. Aqui está um exemplo de um cartão válido:

> Cartão de crédito: `4444 4444 4444 4444`
>
> Vencimento: `Qualquer mês posterior a data de hoje`
>
> CCV: `123` _(ou outros 3 números aleatórios)_

Você também pode usar [geradores de cartão de crédito para testes](https://www.4devs.com.br/gerador_de_numero_cartao_credito). Todos esses irão funcionar e confirmar o pagamento.

Para testar pagamentos com erros, utilize os cartões abaixo:

> Mastercard: `5184019740373151`
>
> Visa: `4916561358240741`

Veja a chamada para realizar cobranças com cartão de crédito [aqui](https://docs.asaas.com/reference/criar-cobranca-com-cartao-de-credito).




Caso queira testar o pagamento de contas em Sandbox, é possível realizar a chamada usando a linha digitável de qualquer boleto que tenha sido gerado em sua própria conta Asaas no ambiente Sandbox.

Veja a chamada para realizar um pagamento de contas [aqui](https://docs.asaas.com/reference/criar-um-pagamento-de-conta).



# Introdução

O ambiente Sandbox do Asaas permite a simulação completa de transferências financeiras, possibilitando que você valide integrações com segurança, sem movimentar valores reais.

Este guia explica como realizar testes de transferências via Pix e transferências via TED, destacando os comportamentos esperados e os recursos disponíveis exclusivamente neste ambiente.

***

## Testando Transferências via Pix

### Opção 1: Utilizando Chaves Pix Fictícias do BACEN


O Banco Central fornece um conjunto de chaves Pix fictícias, especialmente para testes de transferências em ambientes homologatórios, como o Sandbox do Asaas.

Ao realizar uma transferência para qualquer uma dessas chaves fictícias, a operação:

* Será concluída imediatamente com sucesso.
* O valor será debitado da conta Sandbox.
* Não haverá compensação em nenhuma outra conta, pois são chaves fictícias.

Consulte a lista oficial de chaves Pix fictícias fornecidas pelo BACEN:

```
Nome: Joao Silva 
CPF/CNPJ 99991111140
Chave: cliente-a00001@pix.bcb.gov.br
BANCO Virtual Mensageria 04 (99999004)
AGÊNCIA 0001
CONTA 12345678 CACC)

Nome: Joao Silva Silva 
CPF/CNPJ 99992222263
Chave: cliente-a00002@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0002
CONTA 11345678 (CACC)

Nome: Jose Silva
CPF/CNPJ99993333387
Chave: cliente-a00003@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0003
CONTA 12145678(CACC)

Nome: Jose Silva Silva
CPF/CNPJ99994444409
Chave: cliente-a00004@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0004
CONTA 12315678(CACC)

Nome: Jose da Silva
CPF/CNPJ99995555514
Chave: cliente-a00005@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0004
CONTA 12341678(CACC)
```

<br />

### Opção 2: Utilizando Chaves Pix de Outras Contas Sandbox

Você pode criar uma chave Pix em sua própria conta Sandbox ou em outra conta Sandbox para realizar testes mais completos.

Nesse caso:

* O valor será debitado da conta origem.
* O valor será creditado na conta destino.
* Todo o fluxo ocorre dentro do ambiente Sandbox, permitindo validar cenários reais de débito e crédito.

**Exemplo de fluxo:**
Conta Sandbox A → realiza Pix → Chave Pix da Conta Sandbox B → Conta B recebe o crédito.

<Callout icon="❗️" theme="error">
  **Importante**

  * As transferências realizadas para chaves fictícias não geram registros de crédito em nenhuma conta.
  * As transferências entre contas reais do Sandbox simulam perfeitamente a movimentação entre contas bancárias no ambiente de produção.
</Callout>

<br />

***

## Testando Transferências via TED

Em ambiente Sandbox, as transferências via TED contam com controles manuais disponíveis exclusivamente na interface do Asaas (não disponíveis via API).

Após iniciar uma transferência TED, você terá duas opções na interface para simular o resultado da operação:

### Confirmar Transferência:

* Simula uma compensação bem-sucedida. O valor é debitado da conta Sandbox.
* O status da transferência muda para Concluída.

### Simular Falha:

* Simula uma falha na transferência.
* O valor não é debitado da conta.
* O status da transferência muda para Falhou.

<Callout icon="📘" theme="info">
  **ATENÇÃO:**

  * No Sandbox, nenhuma transferência resulta em movimentações financeiras reais.
  * Todos os testes podem ser feitos com segurança, sem risco de impacto em ambientes produtivos.
  * O uso de chaves Pix fictícias é recomendado para testar fluxos de sucesso sem necessidade de configurar múltiplas contas.
  * Para testar cenários de crédito e débito, utilize múltiplas contas Sandbox com chaves Pix reais.
</Callout>

O ambiente Sandbox do Asaas proporciona um ambiente seguro e controlado para validar todos os fluxos de transferências via Pix e TED, desde casos de sucesso até falhas, garantindo maior qualidade e segurança na integração antes da utilização em ambiente de produção.

Veja a chamada para realizar transferências [aqui](https://docs.asaas.com/reference/transferir-para-conta-de-outra-instituicao-ou-chave-pix).




# Introdução

O ambiente Sandbox do Asaas permite a simulação completa de transferências financeiras, possibilitando que você valide integrações com segurança, sem movimentar valores reais.

Este guia explica como realizar testes de transferências via Pix e transferências via TED, destacando os comportamentos esperados e os recursos disponíveis exclusivamente neste ambiente.

***

## Testando Transferências via Pix

### Opção 1: Utilizando Chaves Pix Fictícias do BACEN


O Banco Central fornece um conjunto de chaves Pix fictícias, especialmente para testes de transferências em ambientes homologatórios, como o Sandbox do Asaas.

Ao realizar uma transferência para qualquer uma dessas chaves fictícias, a operação:

* Será concluída imediatamente com sucesso.
* O valor será debitado da conta Sandbox.
* Não haverá compensação em nenhuma outra conta, pois são chaves fictícias.

Consulte a lista oficial de chaves Pix fictícias fornecidas pelo BACEN:

```
Nome: Joao Silva 
CPF/CNPJ 99991111140
Chave: cliente-a00001@pix.bcb.gov.br
BANCO Virtual Mensageria 04 (99999004)
AGÊNCIA 0001
CONTA 12345678 CACC)

Nome: Joao Silva Silva 
CPF/CNPJ 99992222263
Chave: cliente-a00002@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0002
CONTA 11345678 (CACC)

Nome: Jose Silva
CPF/CNPJ99993333387
Chave: cliente-a00003@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0003
CONTA 12145678(CACC)

Nome: Jose Silva Silva
CPF/CNPJ99994444409
Chave: cliente-a00004@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0004
CONTA 12315678(CACC)

Nome: Jose da Silva
CPF/CNPJ99995555514
Chave: cliente-a00005@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0004
CONTA 12341678(CACC)
```

<br />

### Opção 2: Utilizando Chaves Pix de Outras Contas Sandbox

Você pode criar uma chave Pix em sua própria conta Sandbox ou em outra conta Sandbox para realizar testes mais completos.

Nesse caso:

* O valor será debitado da conta origem.
* O valor será creditado na conta destino.
* Todo o fluxo ocorre dentro do ambiente Sandbox, permitindo validar cenários reais de débito e crédito.

**Exemplo de fluxo:**
Conta Sandbox A → realiza Pix → Chave Pix da Conta Sandbox B → Conta B recebe o crédito.

<Callout icon="❗️" theme="error">
  **Importante**

  * As transferências realizadas para chaves fictícias não geram registros de crédito em nenhuma conta.
  * As transferências entre contas reais do Sandbox simulam perfeitamente a movimentação entre contas bancárias no ambiente de produção.
</Callout>

<br />

***

## Testando Transferências via TED

Em ambiente Sandbox, as transferências via TED contam com controles manuais disponíveis exclusivamente na interface do Asaas (não disponíveis via API).

Após iniciar uma transferência TED, você terá duas opções na interface para simular o resultado da operação:

### Confirmar Transferência:

* Simula uma compensação bem-sucedida. O valor é debitado da conta Sandbox.
* O status da transferência muda para Concluída.

### Simular Falha:

* Simula uma falha na transferência.
* O valor não é debitado da conta.
* O status da transferência muda para Falhou.

<Callout icon="📘" theme="info">
  **ATENÇÃO:**

  * No Sandbox, nenhuma transferência resulta em movimentações financeiras reais.
  * Todos os testes podem ser feitos com segurança, sem risco de impacto em ambientes produtivos.
  * O uso de chaves Pix fictícias é recomendado para testar fluxos de sucesso sem necessidade de configurar múltiplas contas.
  * Para testar cenários de crédito e débito, utilize múltiplas contas Sandbox com chaves Pix reais.
</Callout>

O ambiente Sandbox do Asaas proporciona um ambiente seguro e controlado para validar todos os fluxos de transferências via Pix e TED, desde casos de sucesso até falhas, garantindo maior qualidade e segurança na integração antes da utilização em ambiente de produção.

Veja a chamada para realizar transferências [aqui](https://docs.asaas.com/reference/transferir-para-conta-de-outra-instituicao-ou-chave-pix).



# Contexto

Ao utilizar a rota:

```json
POST 

/v3/pix/qrCodes/pay
```

em ambiente **sandbox**, pode ocorrer um erro `404 Not Found` ao tentar pagar um QR Code Pix **gerado a partir de uma cobrança criada via interface**, **sem que haja uma chave Pix cadastrada na conta**.

Esse erro acontece porque, no ambiente de testes, **o payload do QR Code Pix não é registrado** quando a conta não possui chave Pix válida — ou quando a cobrança foi criada com a integração Pix do Bradesco (que não gera o payload no sandbox).

# Observação importante

Embora tecnicamente o erro 404 esteja correto (o payload realmente **não existe no sandbox**), entendemos que isso pode gerar confusão para quem está integrando com a API, já que:

* A rota usada é válida;
* O payload foi extraído corretamente da cobrança;
* A expectativa do cliente é que o QR Code funcione para testes.

# Como evitar o erro

Para garantir que o teste funcione no ambiente de homologação (sandbox), **é necessário cadastrar uma chave Pix na conta** e gerar uma nova cobrança com QR Code **associado a essa chave**.

Veja a chamada para realizar um pagamento de QRCode [aqui](https://docs.asaas.com/reference/pagar-um-qrcode).

<br />




No ambiente **Sandbox**, você pode validar o **token de ação crítica** utilizando o valor padrão “000000”.

Caso você necessite, nós podemos desabilitar o token para transferências em Sandbox. Porém, é importante que você saiba que o TOKEN é uma validação de segurança e, na ausência dele, a conta pode ficar mais suscetível às ações indevidas.

Levamos como sugestão, caso tenha algum IP ou alguns em específico que movimentam a conta, restringir para que apenas esses estejam liberados e que se o sistema do Asaas identificar ação de algum outro IP faça o bloqueio da ação. Você também pode utilizar o nosso mecanismo para validação de saques por Webhook, para uma maior segurança.

Para fazer essa solicitação, [envie um e-mail ao time de Sucesso de Integrações](https://docs.asaas.com/docs/entre-em-contato).

<br />




Caso queira testar a geração de novas cobranças de uma assinatura no ambiente Sandbox, é necessário gerar o carnê da assinatura.

Ao gerar o carnê, as cobranças da assinatura até a data final definida serão criadas automaticamente.
Por exemplo, se o carnê for gerado até dezembro, todas as cobranças da assinatura até dezembro serão geradas.

Veja a chamada para gerar o carnê da assinatura [aqui](https://docs.asaas.com/reference/gerar-carne-de-assinatura).

<br />


Pagar um QRCode

# OpenAPI definition
```json
{
  "_id": "/branches/3/apis/asaas.json",
  "openapi": "3.0.1",
  "info": {
    "title": "Asaas",
    "description": "API pública de integração com a plataforma Asaas.",
    "version": "3.0.0"
  },
  "servers": [
    {
      "url": "https://api-sandbox.asaas.com",
      "description": "Sandbox"
    }
  ],
  "security": [
    {
      "Authorization": []
    }
  ],
  "tags": [
    {
      "name": "Transações Pix"
    }
  ],
  "paths": {
    "/v3/pix/qrCodes/pay": {
      "post": {
        "tags": [
          "Transações Pix"
        ],
        "summary": "Pagar um QRCode",
        "description": "",
        "operationId": "pagar-um-qrcode",
        "parameters": [],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "required": [
                  "qrCode",
                  "value"
                ],
                "type": "object",
                "properties": {
                  "qrCode": {
                    "required": [
                      "payload"
                    ],
                    "type": "object",
                    "properties": {
                      "payload": {
                        "type": "string",
                        "description": "Payload do QRCode",
                        "nullable": false,
                        "deprecated": false,
                        "example": null
                      },
                      "changeValue": {
                        "type": "number",
                        "description": "Valor do troco (para QRCode Troco)",
                        "deprecated": false,
                        "example": null
                      }
                    },
                    "description": "Payload do QRCode para pagamento",
                    "nullable": false,
                    "deprecated": false,
                    "x-readme-ref-name": "PixTransactionQrCodeSaveRequestDTO"
                  },
                  "value": {
                    "type": "number",
                    "description": "Valor a ser pago",
                    "nullable": false,
                    "example": 100,
                    "deprecated": false
                  },
                  "description": {
                    "type": "string",
                    "description": "Descrição do pagamento",
                    "example": "Churrasco",
                    "deprecated": false
                  },
                  "scheduleDate": {
                    "type": "string",
                    "description": "Utilizada para realizar agendamento do pagamento",
                    "format": "date",
                    "example": "2022-03-15",
                    "deprecated": false
                  }
                },
                "x-readme-ref-name": "PixTransactionSaveRequestDTO"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Identificador único da transação Pix no Asaas",
                      "example": "35363f6e-93e2-11ec-b9d9-96f4053b1bd4",
                      "deprecated": false
                    },
                    "endToEndIdentifier": {
                      "type": "string",
                      "description": "Identificador da transação Pix no Banco Central",
                      "example": "E00416968202111161635q5bk0brYk2C",
                      "deprecated": false
                    },
                    "finality": {
                      "type": "string",
                      "description": "Usado para indicar se é um Saque ou Troco",
                      "example": "WITHDRAWAL",
                      "deprecated": false,
                      "enum": [
                        "WITHDRAWAL",
                        "CHANGE"
                      ],
                      "x-readme-ref-name": "PixTransactionGetResponsePixTransactionCashValueFinality"
                    },
                    "value": {
                      "type": "number",
                      "description": "Valor da transação ou de um Saque",
                      "example": 10,
                      "deprecated": false
                    },
                    "changeValue": {
                      "type": "number",
                      "description": "Valor do troco",
                      "deprecated": false,
                      "example": null
                    },
                    "refundedValue": {
                      "type": "number",
                      "description": "Valor estornado",
                      "example": 0,
                      "deprecated": false
                    },
                    "effectiveDate": {
                      "type": "string",
                      "description": "Data da transação",
                      "format": "date-time",
                      "example": "2022-01-13 10:49:59",
                      "deprecated": false
                    },
                    "scheduledDate": {
                      "type": "string",
                      "description": "Data do agendamento",
                      "format": "date",
                      "example": "2022-10-18",
                      "deprecated": false
                    },
                    "status": {
                      "type": "string",
                      "description": "Status da transação",
                      "example": "SCHEDULED",
                      "deprecated": false,
                      "enum": [
                        "AWAITING_BALANCE_VALIDATION",
                        "AWAITING_INSTANT_PAYMENT_ACCOUNT_BALANCE",
                        "AWAITING_CRITICAL_ACTION_AUTHORIZATION",
                        "AWAITING_CHECKOUT_RISK_ANALYSIS_REQUEST",
                        "AWAITING_CASH_IN_RISK_ANALYSIS_REQUEST",
                        "SCHEDULED",
                        "AWAITING_REQUEST",
                        "REQUESTED",
                        "DONE",
                        "REFUSED",
                        "CANCELLED"
                      ],
                      "x-readme-ref-name": "PixTransactionGetResponsePixTransactionStatus"
                    },
                    "type": {
                      "type": "string",
                      "description": "Tipos da transação",
                      "example": "DEBIT",
                      "deprecated": false,
                      "enum": [
                        "DEBIT",
                        "CREDIT",
                        "CREDIT_REFUND",
                        "DEBIT_REFUND",
                        "DEBIT_REFUND_CANCELLATION"
                      ],
                      "x-readme-ref-name": "PixTransactionGetResponsePixTransactionType"
                    },
                    "originType": {
                      "type": "string",
                      "description": "Indica qual foi a origem da transação",
                      "example": "DYNAMIC_QRCODE",
                      "deprecated": false,
                      "enum": [
                        "MANUAL",
                        "ADDRESS_KEY",
                        "STATIC_QRCODE",
                        "DYNAMIC_QRCODE",
                        "PAYMENT_INITIATION_SERVICE",
                        "AUTOMATIC_RECURRING"
                      ],
                      "x-readme-ref-name": "PixTransactionGetResponsePixTransactionOriginType"
                    },
                    "conciliationIdentifier": {
                      "type": "string",
                      "description": "Identificador do QrCode vinculado a transação",
                      "example": "dcabae5bbfb6nffbb87c693883656483",
                      "deprecated": false
                    },
                    "description": {
                      "type": "string",
                      "description": "Descrição sobre a transação",
                      "deprecated": false,
                      "example": null
                    },
                    "transactionReceiptUrl": {
                      "type": "string",
                      "description": "Comprovante de transação, estará disponível após a transação ser confirmada.",
                      "deprecated": false,
                      "example": null
                    },
                    "refusalReason": {
                      "type": "string",
                      "description": "Motivo pelo qual a transação foi recusada",
                      "deprecated": false,
                      "example": null
                    },
                    "canBeCanceled": {
                      "type": "boolean",
                      "description": "Indica se a transação pode ser cancelada",
                      "example": true,
                      "deprecated": false
                    },
                    "originalTransaction": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "description": "Identificador único da transação",
                          "deprecated": false,
                          "example": null
                        },
                        "endToEndIdentifier": {
                          "type": "string",
                          "description": "Identificador único da transação Pix no Banco Central",
                          "deprecated": false,
                          "example": null
                        },
                        "value": {
                          "type": "number",
                          "description": "Valor original da transação",
                          "deprecated": false,
                          "example": null
                        },
                        "effectiveDate": {
                          "type": "string",
                          "description": "Data da transação",
                          "format": "date",
                          "deprecated": false,
                          "example": null
                        }
                      },
                      "description": "Informações originais da transação caso tenha ocorrido um estorno",
                      "deprecated": false,
                      "x-readme-ref-name": "PixOriginalTransactionResponseDTO"
                    },
                    "externalAccount": {
                      "type": "object",
                      "properties": {
                        "ispb": {
                          "type": "string",
                          "description": "Identificador da Instituição de Pagamento",
                          "example": "416968",
                          "deprecated": false
                        },
                        "ispbName": {
                          "type": "string",
                          "description": "Nome da Instituição de pagamento",
                          "example": "Banco exemplo S.A",
                          "deprecated": false
                        },
                        "name": {
                          "type": "string",
                          "description": "Nome do recebedor",
                          "example": "John Doe",
                          "deprecated": false
                        },
                        "cpfCnpj": {
                          "type": "string",
                          "description": "Cpf ou Cnpj do recebedor",
                          "example": "***.456.789-**",
                          "deprecated": false
                        },
                        "addressKey": {
                          "type": "string",
                          "description": "Chave Pix",
                          "example": "12345678910",
                          "deprecated": false
                        },
                        "addressKeyType": {
                          "type": "string",
                          "description": "Tipo da chave Pix",
                          "example": "CPF",
                          "deprecated": false,
                          "enum": [
                            "CPF",
                            "CNPJ",
                            "EMAIL",
                            "PHONE",
                            "EVP"
                          ],
                          "x-readme-ref-name": "PixTransactionExternalAccountResponsePixAddressKeyType"
                        }
                      },
                      "description": "Informações sobre o recebedor",
                      "deprecated": false,
                      "x-readme-ref-name": "PixTransactionExternalAccountResponseDTO"
                    },
                    "qrCode": {
                      "type": "object",
                      "properties": {
                        "payer": {
                          "type": "object",
                          "properties": {
                            "name": {
                              "type": "string",
                              "description": "Nome do pagador",
                              "example": "Elon Musk",
                              "deprecated": false
                            },
                            "cpfCnpj": {
                              "type": "string",
                              "description": "CPF ou CNPJ do pagador",
                              "example": "***.456.789-**",
                              "deprecated": false
                            }
                          },
                          "description": "Informações sobre o pagador",
                          "deprecated": false,
                          "x-readme-ref-name": "PixTransactionQrCodePayerResponseDTO"
                        },
                        "conciliationIdentifier": {
                          "type": "string",
                          "description": "Identificador único de conciliação Pix com o Asaas",
                          "example": "dcabae5bbfb6nffbb87c693883656483",
                          "deprecated": false
                        },
                        "originalValue": {
                          "type": "number",
                          "description": "Valor original da transação",
                          "example": 99,
                          "deprecated": false
                        },
                        "dueDate": {
                          "type": "string",
                          "description": "Data de vencimento",
                          "format": "date",
                          "example": "2030-02-05",
                          "deprecated": false
                        },
                        "interest": {
                          "type": "number",
                          "description": "Valor dos juros",
                          "example": 1,
                          "deprecated": false
                        },
                        "fine": {
                          "type": "number",
                          "description": "Valor da multa",
                          "example": 3,
                          "deprecated": false
                        },
                        "discount": {
                          "type": "number",
                          "description": "Valor do desconto",
                          "example": 5,
                          "deprecated": false
                        },
                        "expirationDate": {
                          "type": "string",
                          "description": "Data de expiração",
                          "format": "date-time",
                          "example": "2030-02-10 11:00:00",
                          "deprecated": false
                        },
                        "description": {
                          "type": "string",
                          "description": "Descrição do QrCode",
                          "example": "Churrasco",
                          "deprecated": false
                        }
                      },
                      "description": "Informações sobre o QrCode",
                      "deprecated": false,
                      "x-readme-ref-name": "PixTransactionQrCodeResponseDTO"
                    },
                    "payment": {
                      "type": "string",
                      "description": "Identificador único da cobrança",
                      "example": "pay_0491859546906926",
                      "deprecated": false
                    },
                    "canBeRefunded": {
                      "type": "boolean",
                      "description": "Indica se a transação pode ser estornada",
                      "example": true,
                      "deprecated": false
                    },
                    "refundDisabledReason": {
                      "type": "string",
                      "description": "Motivo pelo qual o estorno foi desabilitado",
                      "deprecated": false,
                      "example": null
                    },
                    "chargedFeeValue": {
                      "type": "number",
                      "description": "Taxa de débito ou crédito referente a transação",
                      "example": 0.99,
                      "deprecated": false
                    },
                    "dateCreated": {
                      "type": "string",
                      "description": "Data de criação da transação",
                      "format": "date-time",
                      "example": "023-02-14 10:42:55",
                      "deprecated": false
                    },
                    "addressKey": {
                      "type": "string",
                      "description": "Chave Pix quando a transação é um crédito",
                      "deprecated": false,
                      "example": null
                    },
                    "addressKeyType": {
                      "type": "string",
                      "description": "Tipo da chave Pix",
                      "example": "CPF",
                      "deprecated": false,
                      "enum": [
                        "CPF",
                        "CNPJ",
                        "EMAIL",
                        "PHONE",
                        "EVP"
                      ],
                      "x-readme-ref-name": "PixTransactionGetResponsePixAddressKeyType"
                    },
                    "transferId": {
                      "type": "string",
                      "description": "Identificador da transferência",
                      "deprecated": false,
                      "example": null
                    },
                    "externalReference": {
                      "type": "string",
                      "description": "Campo livre para busca",
                      "deprecated": false,
                      "example": null
                    }
                  },
                  "x-readme-ref-name": "PixTransactionGetResponseDTO"
                }
              }
            }
          },
          "400": {
            "description": "Bad Request",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "errors": {
                      "type": "array",
                      "description": "Lista de objetos",
                      "deprecated": false,
                      "items": {
                        "type": "object",
                        "properties": {
                          "code": {
                            "type": "string",
                            "description": "Código do erro",
                            "deprecated": false,
                            "example": null
                          },
                          "description": {
                            "type": "string",
                            "description": "Descrição do erro",
                            "deprecated": false,
                            "example": null
                          }
                        },
                        "description": "Lista de objetos",
                        "deprecated": false,
                        "x-readme-ref-name": "ErrorResponseItemDTO"
                      }
                    }
                  },
                  "x-readme-ref-name": "ErrorResponseDTO"
                },
                "example": {
                  "errors": [
                    {
                      "code": "error_code",
                      "description": "Descrição do erro"
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "errors": {
                      "type": "array",
                      "description": "Lista de objetos",
                      "deprecated": false,
                      "items": {
                        "type": "object",
                        "properties": {
                          "code": {
                            "type": "string",
                            "description": "Código do erro",
                            "deprecated": false,
                            "example": null
                          },
                          "description": {
                            "type": "string",
                            "description": "Descrição do erro",
                            "deprecated": false,
                            "example": null
                          }
                        },
                        "description": "Lista de objetos",
                        "deprecated": false,
                        "x-readme-ref-name": "ErrorResponseItemDTO"
                      }
                    }
                  },
                  "x-readme-ref-name": "ErrorResponseDTO"
                },
                "example": {
                  "errors": [
                    {
                      "code": "invalid_access_token",
                      "description": "A chave de API fornecida é inválida"
                    }
                  ]
                }
              }
            }
          }
        },
        "deprecated": false
      }
    }
  },
  "components": {
    "securitySchemes": {
      "Authorization": {
        "type": "apiKey",
        "name": "access_token",
        "in": "header"
      }
    }
  }
}
```