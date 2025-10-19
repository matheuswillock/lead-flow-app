

A autenticação em nossa API é feita através do uso de uma **chave de API**. É através desta chave que nosso sistema identifica a sua conta e permite a comunicação conosco em nome da conta em questão.

Caso a chave de API seja inválida, não seja informada ou o header esteja incorreto, nossa API retornará `HTTP 401`.

A segurança da chave de API é de responsabilidade do cliente. Para reforçar sua segurança, recomendamos que você utilize também os demais mecanismos de proteção disponíveis. Considere definir endereços IP autorizados para adicionar uma camada extra de segurança. Para mais detalhes, consulte as medidas de segurança na documentação: [Mecanismos adicionais de segurança](https://docs.asaas.com/docs/mecanismos-de-seguranca).

> 🚧 **Atenção:**
>
> * Após a geração da chave de API em nossa interface, armazene-a diretamente em seu cofre de chaves, evitando que seja exposta em mensagens de qualquer tipo ou emails. **Nunca deixe a chave de API diretamente no código fonte de seus sistemas.**
> * **Não informe sua chave de API em atendimentos, a terceiros ou exponha no front-end da sua aplicação.** Garanta que sua aplicação não exponha a chave em logs de sistema.
> * Caso seu time de desenvolvimento utilize a **chave de API de Produção** nos ambientes de desenvolvimento ou homologação durante os testes finais da integração, é essencial renová-la antes da entrada em produção, garantindo que o menor número de pessoas possível tenha acesso a ela.
> * Utilize pelo menos um dos mecanismos adicionais de segurança [descritos aqui](https://docs.asaas.com/docs/mecanismos-de-seguranca).
> * A chave de API é irrecuperável, caso seja perdida, é necessário a geração de uma nova.

### Utilize os headers abaixo em todas as suas chamadas para a API

```json
"Content-Type": "application/json",
"User-Agent": "nome_da_sua_aplicação",
"access_token": "sua_api_key"
```

> 🚧 Importante
>
> É obrigatório enviar o `User-Agent` no header de todas as requisições em novas contas raiz criadas a partir de **13/06/2024**. Sugerimos enviar o nome da sua aplicação caso o seu framework não adicione um User-Agent padrão.
>
> O User-Agent é um cabeçalho que ajuda a identificar sua aplicação nas requisições à API. Personalizar esse valor facilita rastrear a origem das chamadas.
>
> Saiba mais sobre como definir seu User-Agent aqui: [Como posso definir meu user-agent?](https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o#como-posso-definir-meu-user-agent)

> 📘 Ambientes distintos (Sandbox e Produção)
>
> As Chaves de API são distintas entre os ambientes de Sandbox e Produção, portanto lembre-se de alterá-la quando mudar a URL.

> ❗️ ATENÇÃO: Para testar os endpoints direto nesta documentação você precisa de uma chave de API de Sandbox
>
> **Caso seja utilizada a chave de produção, obterá o erro[401 Unauthorized](https://docs.asaas.com/docs/erros-_comuns_-copy-1).**
>
> Todos os endpoints da documentação apontam para nosso Sandbox, o ambiente de testes do Asaas. Antes de começar você deve [criar uma conta de testes](https://sandbox.asaas.com/onboarding/createAccount?customerSignUpOriginChannel=HOME) e usar sua chave de API para testes.
>
> [Saiba mais sobre o Sandbox](https://docs.asaas.com/docs/sandbox)

Para obter sua Chave de API [acesse a área de integrações](https://www.asaas.com/customerApiAccessToken/index) em nossa **interface web**. Pelo aplicativo não tem a opção de gerar chave. Além disso, apenas usuários do tipo administrador, tem permissão para gerar a chave.

![](https://files.readme.io/f4b7e1df6a46013c6702d8c5fa18485eb7751ca3b4f4781f6521641257838e77-image.png)

<Callout icon="🔒" theme="default">
  ### Gerenciando suas chaves de API

  * Você pode criar até **10** chaves de API para uma conta Asaas.
  * As chaves podem ser nomeadas, para facilitar a identificação.
  * É possível definir uma data de expiração para cada chave.
  * Você pode desabilitar/habilitar uma chave a qualquer momento, sem de fato inválida-la.
  * Caso a chave seja **excluída**, não é possível restaura-la.
</Callout>

## URL de Produção e Sandbox

Após a criação da conta e geração da chave de API, utilize a URL específica para cada ambiente em suas chamadas, conforme listado abaixo:

| Ambiente | URL                                                                  |
| :------- | :------------------------------------------------------------------- |
| Produção | [https://api.asaas.com/v3](https://api.asaas.com/v3)                 |
| Sandbox  | [https://api-sandbox.asaas.com/v3](https://api-sandbox.asaas.com/v3) |

### Teste em ambiente Sandbox

* Durante o desenvolvimento da integração, teste as requisições em nosso ambiente de Sandbox utilizando dados fictícios e direcionando as requisições para o domínio “[https://api-sandbox.asaas.com/v3](https://api-sandbox.asaas.com/v3)", alterando para produção apenas após a validação de todas as funcionalidades.

<br />

# Armazenamento seguro para a Chave de API

A **Chave de API** do Asaas segue o modelo de chave “irrecuperável”, isto é, ela **será exibida apenas uma vez quando criada**. Sendo assim, você precisará copiá-la e salvá-la de modo seguro antes de sair da área de integrações.

* Nunca armazene chaves de API em texto claro dentro do código-fonte ou em arquivos de configuração acessíveis ao público.

* Utilize mecanismos de segurança, como variáveis de ambiente ou arquivos de configuração protegidos, para armazenar as chaves de API de forma segura.

* Utilize serviços de gerenciamento de segredos para armazenar e gerenciar as chaves de API de forma centralizada e segura, como AWS Secrets Manager, Google Cloud Secret Manager e Azure Key Vault, por exemplo.

# Transmissão segura da sua Chave de API

* Utilize exclusivamente protocolos de comunicação seguros, como HTTPS, evitando métodos não criptografados, como HTTP.

## Protocolo de segurança TLS (Transport Layer Security)

Atualmente nossos sistemas em produção aceitam TLS 1.2 e 1.3 para comunicação. Mas recomendamos o uso do TLS 1.3.

# Controle de acesso e rotação de chave

* O acesso à Chave de API deve ser concedido apenas a usuários ou sistemas autorizados que realmente necessitam de acesso aos recursos protegidos.
* Estabeleça um processo de monitoramento dos logs a fim de rastrear a origem e propósito das requisições, de modo a detectar atividades suspeitas ou uso indevido de sua Chave de API. Ferramentas como SIEM, Splunk, ELK Stack, AWS CloudWatch ou Azure Monitor podem auxiliar no processo.
* Estabeleça uma política de rotação regular das chaves de API para reduzir o impacto em caso de comprometimento ou vazamento.
* O armazenamento e segurança da chave apikey é de inteira responsabilidade do cliente, visto que o Asaas não detém dessa informação armazenada em nenhum local de nosso banco.

# Erros de autenticação

Uma resposta `401 Unauthorized` indica que sua requisição não pôde ser autenticada. Para te ajudar a diagnosticar o problema rapidamente, nossa API retorna um corpo de erro com uma mensagem específica para cada cenário.

Abaixo estão as causas mais comuns e as mensagens de erro correspondentes:

## Uso de chave em ambiente incorreto

```json
{
  "errors": [
    {
      "code": "invalid_environment",
      "description": "A chave de API informada não pertence a este ambiente"
    }
  ]
}

```

### Como resolver?

Verifique se você está usando sua chave de Produção (`$aact_prod_`...) nos endpoints de produção (`api.asaas.com`) e sua chave de Sandbox (`$aact_hmlg_`...) nos endpoints de Sandbox (`api-sandbox.asaas.com`).

## Cabeçalho de autenticação ausente

```json
{
  "errors": [
    {
      "code": "access_token_not_found",
      "description": "O cabeçalho de autenticação 'access_token' é obrigatório e não foi encontrado na requisição"
    }
  ]
}

```

### Como resolver?

Garanta que o cabeçalho `access_token` está sendo enviado corretamente em todas as suas requisições.

## Formato da chave incorreto

```json
{
  "errors": [
    {
      "code": "invalid_access_token_format",
      "description": "O valor fornecido não parece ser uma chave de API válida do Asaas. Verifique o formato da sua chave"
    }
  ]
}

```

### Como resolver?

Verifique se você não copiou espaços extras ou caracteres a mais. Chaves de produção começam com `$aact_prod_` e as de Sandbox com `$aact_hmlg_`.

## Chave de API inválida ou revogada

```json
{
  "errors": [
    {
      "code": "invalid_access_token",
      "description": "A chave de API fornecida é inválida"
    }
  ]
}

```

### Como resolver?

Confirme se o valor da chave de API que você está enviando está correto e se ela não foi desabilitada, expirada ou excluída no seu painel Asaas.



Além de chave de API que é usada para autenticar suas requisições, possuímos mecanismos adicionais que oferecem camadas extras de segurança para sua conta. Recomendamos utilizar pelo menos um deles, e se possível ambos. Conheça-os abaixo.

## Whitelist de IPs

Este mecanismo permite definir IPs a partir dos quais aceitaremos requisições utilizando sua chave de API. 

Qualquer requisição recebida de um IP não contido na whitelist será recusada com resposta HTTP 403. Desta forma, mesmo que sua chave seja comprometida, a menos que as requisições partam de sua infraestrutura, elas serão recusadas.

Você pode definir a sua lista de IPs autorizados acessando [Menu do usuário > Integrações > Mecanismos de segurança](https://www.asaas.com/customerConfigIntegrations/apiAccessControl).

![](https://files.readme.io/c4671ff-image.png)

> 📘 **Configuração de IPs por faixa**
>
> Você consegue adicionar um IP autorizado em uma faixa de IPs, usando o `x`, por exemplo: `192.168.1.x` irá pegar desde o IP `192.168.1.0` até `192.168.1.255`.

> 🚧 **Atenção ao configurar intervalos de IPs amplos**
>
> Embora a configuração de faixas de IP seja uma ferramenta flexível, a liberação de intervalos muito grandes pode comprometer a segurança da sua conta e anular o propósito desta funcionalidade.
>
> **Risco** 
>
> Uma faixa de IPs muito ampla, como a de um grande provedor de nuvem, pode incluir milhares de servidores que não estão sob o seu controle. Caso sua chave de API seja exposta, um atacante operando dentro dessa mesma faixa de IPs poderia realizar requisições válidas à sua conta.
>
> Lembre-se que o objetivo do Whitelist de IPs é restringir o acesso ao menor conjunto de endereços possível, seguindo o princípio do menor privilégio.
>
> **Recomendação para Servidores em Nuvem**
>
> Se sua aplicação roda em um ambiente com IPs de saída dinâmicos (como AWS, GCP, Azure, etc.), recomendamos fortemente a utilização de um serviço de NAT Gateway com um IP de saída estático. Isso permite que você adicione um único IP ou um pequeno e controlado conjunto de IPs à sua whitelist, garantindo o máximo de segurança para sua integração.

### Por que fixar IPs?

Fixar IPs para chamadas de API pode ser uma prática útil e necessária. 

Ao fixar IPs, você pode restringir o acesso às suas APIs, permitindo chamadas apenas de IPs específicos. Isso ajuda a bloquear acessos não autorizados ou indesejados.

No entanto, isso também exige a manutenção de uma lista de IPs autorizados e pode tornar o gerenciamento de acessos mais complexo, mas garantindo muito mais segurança em suas requisições ao Asaas, especialmente em operações White Label.

### Tem um cenário complexo e precisa de ajuda?

Entendemos que algumas arquiteturas podem ter desafios específicos para fixar um IP de saída. Se este for o seu caso e a solução de NAT Gateway não for aplicável, queremos entender melhor seu cenário.

Preencha [este formulário](https://forms.gle/UzvzStNa9Fdhr1X68) para que nossa equipe de produto possa analisar seu caso de uso e, futuramente, desenvolvermos alternativas de segurança que atendam à sua necessidade.

## Webhook de autorização de transferências

Ao habilitar este mecanismo, todas as transferências solicitadas em sua conta dispararão um webhook para o seu sistema afim de validar a legitimidade das mesmas. Desta forma, a menos que seu sistema reconheça a transferência como legítima, ela será cancelada. Para maiores detalhes no uso deste mecanismo acesso à [documentação](https://docs.asaas.com/docs/mecanismo-para-validacao-de-saque-via-webhooks).





O Asaas está constantemente investindo em segurança, e também criando métodos para tornar a sua operação conosco cada vez mais segura e confiável.

Nessa documentação, você encontrará o detalhamento do método de validação de transferências através de Webhooks.

### Ativando mecanismo via interface

Para ativar o mecanismo na sua conta, acesse o [Menu do usuário > Integrações > Mecanismos de segurança](https://www.asaas.com/apiAccessControl/index).

<Image align="center" className="border" border={true} src="https://files.readme.io/1151556f343ba745635c3bb784c6623b8aeff4cd640a5c15abed19054445672f-image_1.png" />

A configuração é bem simples, você precisa apenas adicionar qual será a URL do seu Webhook, o e-mail para receber notificações de erros e o token de autenticação, ele é opcional, porém sugerimos sempre utilizar. Este token será enviado no header `asaas-access-token` e você pode validá-lo para saber que se trata de uma requisição legítima do Asaas.

> 🚧 Atenção
>
> Ao realizar a configuração, todas as transferências e saques realizados via API serão tratadas por este mecanismo de segurança.

> 📘 Configuração para estornos Pix
>
> Para habilitar a configuração de estornos Pix, marque a opção "Ativar autorização de saque para estornos Pix". Vale ressaltar que essa configuração não é obrigatória para saques.

> 📘 Configuração para subcontas
>
> A configuração é feita automaticamente para todas as subcontas de acordo com a configuração realizada na conta raiz, sejam elas white label ou não.

Você tem a opção de validar também os saques via interface, dessa forma qualquer novo saque realizado na sua conta, seja via API ou via interface irá passar pelo fluxo de validação.

### Como o mecanismo funciona?

* Você solicitará a transferência via API e armazenará o ID ou mais dados do retorno em sua base de dados.
* O Asaas fará um `POST` cinco segundos após a criação da transferência para a URL configurada com o payload da transferência (os payloads sempre serão os mesmos enviados no retorno da criação).
* Essa requisição pode falhar no máximo três vezes, após a terceira falha a transferência será cancelada automaticamente.
* Você deve verificar se o payload recebido bate com o que possui armazenado.
* Responderá se aprova ou não a transferência.

### Exemplo de requisição que o Asaas irá realizar (Transferência)

```json
{
   "type":"TRANSFER",
   "transfer":{
      "object":"transfer",
      "id":"0bed986c-737d-49bf-a1cc-beca916797c4",
      "dateCreated":"2022-05-27",
      "status":"PENDING",
      "effectiveDate":null,
      "type":"BANK_ACCOUNT",
      "value":22,
      "netValue":22,
      "transferFee":0,
      "scheduleDate":"2022-05-27",
      "confirmedDate":null,
      "failReason":null,
      "bankAccount":{
         "bank":{
            "code":null,
            "ispb":"00000000",
            "name":null
         },
         "accountName":"ASAAS GESTAO FINANCEIRA S.A.",
         "ownerName":"ASAAS GESTAO FINANCEIRA S.A.",
         "cpfCnpj":"70609293000194",
         "agency":"4124",
         "agencyDigit":null,
         "account":"42142",
         "accountDigit":"1",
         "pixAddressKey":null
      },
      "transactionReceiptUrl":null,
      "operationType":"PIX",
      "description":null
   }
}
```

### Exemplo de requisição que o Asaas irá realizar (Pague Contas)

```json
{
   "type":"BILL",
   "bill":{
      "object":"bill",
      "id":623471,
      "status":"PENDING",
      "value":20.0,
      "discount":0,
      "interest":0,
      "fine":0,
      "identificationField":"23793381286001234107143000012345890460000002000",
      "dueDate":"2024-01-01",
      "scheduleDate":"2024-01-01",
      "paymentDate":null,
      "fee":0,
      "description":null,
      "companyName":null,
      "transactionReceiptUrl":null,
      "canBeCancelled":true,
      "failReasons":null,
      "bankId":4,
      "awaitingCriticalActionAuthorization":false,
      "bank":{
         "object":"bank",
         "id":4,
         "code":"237",
         "name":"Bradesco"
      }
   }
}
```

### Exemplo de requisição que o Asaas irá realizar (Pagamento de QRCode)

```json
{
   "type":"PIX_QR_CODE",
   "pixQrCode":{
      "id":"aa10c444-3f02-40e7-a248-2d00cff5a45d",
      "endToEndIdentifier":"E1954055020220714160403012347510",
      "finality":null,
      "value":2,
      "changeValue":null,
      "refundedValue":0,
      "effectiveDate":"2022-07-14 13:04:03",
      "scheduledDate":null,
      "status":"AWAITING_REQUEST",
      "type":"DEBIT",
      "originType":"STATIC_QRCODE",
      "conciliationIdentifier":null,
      "description":null,
      "transactionReceiptUrl":null,
      "refusalReason":null,
      "canBeCanceled":true,
      "originalTransaction":null,
      "externalAccount":{
         "ispb":18236120,
         "ispbName":"NU PAGAMENTOS S.A. - INSTITUI\u00c7\u00c3O DE PAGAMENTO",
         "name":"John Doe",
         "cpfCnpj":"***.123.456-**",
         "addressKey":"john.doe@teste.com",
         "addressKeyType":"EMAIL"
      },
      "qrCode":{
         "payer":null,
         "conciliationIdentifier":null,
         "originalValue":1.00,
         "dueDate":null,
         "interest":0,
         "fine":0,
         "discount":0,
         "expirationDate":null
      },
      "payment":null
   }
}
```

### Exemplo de requisição que o Asaas irá realizar (Recarga de telefone)

```json
{
   "type":"MOBILE_PHONE_RECHARGE",
   "mobilePhoneRecharge":{
      "id":"d29f7fdb-4cf9-4524-a44e-d1f3fd9ec0d3",
      "value":20,
      "phoneNumber":"47999999999",
      "status":"PENDING",
      "canBeCancelled":true,
      "operatorName":"Claro"
   }
}
```

<br />

### Exemplo de requisição que o Asaas irá realizar (Estorno Pix)

```json
{
  "type": "PIX_REFUND",
  "pixRefund": {
    "id": "06391ba9-cbf9-4926-8988-374ac5d71cae",
    "transferId": "f3956d6d-6dbb-4882-8146-9df82288d95b",
    "endToEndIdentifier": null,
    "finality": null,
    "value": 200,
    "changeValue": null,
    "refundedValue": 0,
    "dateCreated": "17/12/2024 15:27:42",
    "effectiveDate": "17/12/2024 15:27:42",
    "scheduledDate": null,
    "status": "AWAITING_REQUEST",
    "type": "CREDIT_REFUND",
    "originType": null,
    "conciliationIdentifier": null,
    "description": null,
    "transactionReceiptUrl": null,
    "chargedFeeValue": 0,
    "canBeRefunded": false,
    "refundDisabledReason": "O tipo desta transação não permite que ela seja estornada.",
    "refusalReason": null,
    "canBeCanceled": false,
    "originalTransaction": {
      "id": "b9852968-7825-4458-b069-d266ce8455c9",
      "endToEndIdentifier": "6709a838-7422-4198-94ed-76166a70c595",
      "value": 1000,
      "effectiveDate": "17/12/2024 15:26:57"
    },
    "externalAccount": {
      "ispb": 19540550,
      "ispbName": "ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTO S.A.",
      "name": "John Doe",
      "agency": "0",
      "account": "0000000",
      "accountDigit": "0",
      "accountType": "CHECKING_ACCOUNT",
      "cpfCnpj": "***.138.240-**",
      "addressKey": null,
      "addressKeyType": null
    },
    "qrCode": null,
    "payment": "pay_e4xnd1cc04w2n33n",
    "addressKey": null,
    "addressKeyType": null,
    "externalReference": null
  }
}
```

# Como validar uma transferência

Ao receber o `POST`, você precisará respondê-lo informando se reconhece a transferência como resposta do próprio `POST`. Para isso é necessário que você retorne um payload com um status.

Os possíveis status são:

**`APPROVED`**

**`REFUSED`**

Também é possível informar o motivo da recusa, retornando junto do payload o refuseReason, exemplo:

```json
{ 
    "status": "REFUSED", 
    "refuseReason": "Transferência não encontrada no nosso banco" 
}
```

Caso a transferência seja reconhecida e aprovada, é preciso responder da seguinte forma:

```json
{ 
    "status": "APPROVED" 
}
```

Caso não seja retornado nenhum dos dois status ou a requisição apresente falha por 3 vezes consecutivas, daremos a solicitação como falha e **a transferência será cancelada**.




# O que é PCI-DSS?

**PCI-DSS** é a sigla para "*Payment Card Industry Data Security Standard*", ou "*Padrão de Segurança de Dados da Indústria de Cartões de Pagamento*". 

Trata-se de um conjunto de normas e regras que gateways de pagamento, emissores de cartão, lojistas, merchants, ou qualquer agente que faça processamento, transmissão ou armazenamento de dados de cartão de crédito ou débito devem respeitar para garantir a proteção destes dados. O objetivo é claro: **garantir que os dados de cartão dos clientes estejam sempre seguros.**

Entre os padrões determinados no PCI-DSS, estão definidas algumas regras de boas práticas e requisitos para algumas áreas, como:

* Armazenamento de dados do titular do cartão
* Criptografia durante transmissão de dados
* Controle de acesso restrito
* Monitoramento contínuo de aplicações

Segundo a [NordVPN](https://nordvpn.com/pt-br/research-lab/malware-stolen-cards-study/), o Brasil é o segundo país mais afetado com o roubo de cartões de pagamento. O impacto desses ataques pode ser grande como: multa, danos à reputação e até mesmo a interrupção na operação da empresa. Por isso, é extremamente importante estar de acordo com os padrões estabelecidos para proteção e garantir a segurança de sua empresa.

> 📘 Esse documento deve ser usado apenas como um guia. O Asaas não realizará consultorias ou informativos sobre certificações PCI-DSS.

<br />

# A quem se aplica o PCI-DSS?

Como vimos, quando uma empresa processa, armazena e transmite dados ela está lidando com dados confidenciais, desta forma qualquer empresa independente do tamanho que opere dados de cartão precisa seguir as diretrizes do PCI DSS.

# O que é o SAQ e quais são os seus níveis e tipos?

O **SAQ (Self-Assessment Questionnaire)** é um questionário de autoavaliação do PCI DSS. Ele é usado por empresas que não fazem ou não possuem uma auditoria formal com um QSA (Qualified Security Assessor), mas que por transacionar operações com cartão de crédito, ainda precisam demonstrar conformidade com os requisitos de segurança para lidar com esse tipo de informação.

Como o nome indica, o SAQ é um questionário de auto-preenchimento, ou seja, é de inteira responsabilidade do cliente em responder e manter o SAQ armazenado em segurança, uma vez que em casos de auditoria externa (por emissores, bandeiras ou até pelo próprio gateway), esse documento poderá ser solicitado.

O PCI DSS definine quatro níveis de segurança com base na quantidade de transações de cartões, permitindo que, independente do porte, a empresa consiga manter um compromisso com a segurança e validar sua conformidade.

<br />

| Nível       | Critério                                         | Validação de conformidade                                                                                          |
| ----------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Nível 1** | Acima de 6 milhões de transações por ano         | Auditoria anual por uma empresa de Avaliadora de Segurança Qualificada (QSA) e scan trimestral de vulnerabilidades |
| **Nível 2** | Entre 1 milhão e 6 milhões de transações por ano | Questionário de autoavaliação (SAQ) e scan trimestral de vulnerabilidades                                          |
| **Nível 3** | Entre 20 mil e 1 milhão de transações por ano    | Questionário de autoavaliação (SAQ) e scan trimestral de vulnerabilidades                                          |
| **Nível 4** | Até 20 mil transações por ano                    | Questionário de autoavaliação (SAQ)                                                                                |

Com base no histórico de segurança, o PCI DSS pode exigir que os níveis 2 e 3 passem por uma auditoria formal, igualmente exigida para quem se encaixa no nível 1.

Veja a relação dos tipos de SAQ mais comuns em operações online:

| Tipo de SAQ | Indicado para                                                                                                           | Descrição breve                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **A**       | E-commerce que **terceiriza totalmente** o processamento de pagamentos (dados de cartão não são trafegados em back-end) | Não armazena, processa ou transmite dados de cartão |
| **A-EP**    | E-commerce que **não armazena dados**, mas **tem controle sobre a página de pagamento**                                 | Requer mais controles que o SAQ A                   |
| **D**       | Qualquer entidade que **não se encaixa nos critérios acima**                                                            | Mais completo e rigoroso                            |

Os questionários SAQ - Self Assessment Questionnaire, estão disponíveis para consulta na [biblioteca de documentos do PCI.](https://www.pcisecuritystandards.org/document_library/)

# O PCI-DSS no Asaas

O Asaas está certificado no Nível 1 do PCI-DSS.

Anualmente, o Asaas passa por uma auditoria externa para garantir que estejamos dentro do escopo de segurança necessário, uma vez que, como gateway de pagamento, precisamos zelar com segurança de todo e qualquer dado pessoal ou sensível transitado pela nossa plataforma.

Além do Asaas, a sua aplicação que se integrará conosco também precisa estar adequada de acordo com o tipo de transação que você realiza em nossa plataforma, seguindo a tabela abaixo:

<br />

| Formato de Transação    | **Tratamento de dados de Cartão**                    | **Adequação PCI-DSS** |
| ----------------------- | ---------------------------------------------------- | --------------------- |
| Checkout Asaas          | Não aplicável                                        | ❎                     |
| Fatura Asaas            | Não aplicável                                        | ❎                     |
| Link de Pagamento       | Não aplicável                                        | R                     |
| API Asaas               | Dados transmitidos via back-end                      | ✅ SAQ-D               |
| Tokenização Server-Side | Dados transmitidos via back-end                      | ✅ SAQ-D               |
| Tokenização Client-Side | Cartão tokenizado via front-end, enviado no back-end | ✅ SAQ-A               |

<br />

> 🚧 Atenção
>
> O Asaas não fornece a opção de "Tokenização Client-Side", via front-end. Desta forma, recomendamos que sua aplicação esteja certificada no SAQ-D, garantindo o tráfego seguro das informações de cartão de crédito entre a sua aplicação e o Asaas.
>
> As adequações citadas no quadro acima destacam exclusivamente as operações realizadas no Asaas. Se a sua empresa realiza operações de cartão também fora do Asaas, confira com o seu gateway de pagamento sobre as necessidades de adequação ao PCI-DSS necessárias nesta outra operação.

<br />

# Responsabilidades

A escolha do fornecedor pode impactar diretamente a segurança dos dados dos seus clientes, por isso, aqui no Asaas, **nos preocupamos em construir um ambiente seguro** que siga os requisitos do PCI DSS.

Somos certificados no PCI DSS. Isso significa mais segurança para os dados dos seus clientes e uma gestão financeira ainda mais confiável para o seu negócio.

## O Asaas e a responsabilidade compartilhada

O Asaas oferece alguns produtos para gestão financeira que opera dados de cartão, desta forma é importante compreender as responsabilidades a serem compartilhadas:

<br />

| Produto Asaas               | Responsabilidade do Asaas                                                                                        | Responsabilidade da Sua Empresa                                                                                                                                             | SAQ Indicado para Sua Empresa                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Checkout Asaas**          | Operação completa da página de pagamento, recepção, transmissão, operação e armazenamento dos dados do cartão.   | Sua empresa não manipula diretamente os dados do cartão. Responsável pela segurança geral do ambiente e correto direcionamento ao checkout.                                 | **SAQ-A**: Geralmente o mais indicado, pois o Asaas gerencia toda a interação com os dados do cartão.                                                |
| **Fatura Asaas**            | Operação e armazenamento dos dados do cartão. A interface de pagamento é gerenciada pelo Asaas.                  | Sua empresa não manipula diretamente os dados do cartão. Responsável por como a fatura é gerada e apresentada.                                                              | **SAQ-A**: Entrada dos dados do cartão ocorre em ambiente totalmente controlado pelo Asaas.                                                          |
| **Link de Pagamento**       | Operação e armazenamento dos dados do cartão. O cliente interage diretamente com a página de pagamento do Asaas. | Sua empresa não manipula diretamente os dados do cartão. Responsável por gerar e compartilhar o link de forma segura.                                                       | **SAQ-A**: Dados do cartão inseridos em ambiente seguro e externo à sua empresa.                                                                     |
| **API Asaas**               | Operação e armazenamento dos dados do cartão após o recebimento seguro.                                          | Responsável pela segurança na recepção e transmissão dos dados do cartão até o Asaas. Inclui proteção de servidor e comunicação.                                            | **SAQ-D** (se transmitir dados de cartão via back-end) ou **SAQ-A** (se usar tokenização client-side e não houver dados passando pelo seu servidor). |
| **Tokenização Server-Side** | Operação e armazenamento dos tokens e dados do cartão após o recebimento.                                        | Responsável pela segurança na transmissão dos dados do cartão do seu servidor para o Asaas para tokenização.                                                                | **SAQ-D**: Dados do cartão trafegam pelo back-end, mesmo que brevemente, antes de serem tokenizados.                                                 |
| **Tokenização Client-Side** | Operação e armazenamento dos tokens e dados do cartão após o recebimento.                                        | O cartão é tokenizado no navegador do cliente (front-end) antes de chegar ao back-end. Responsável por garantir a segurança do front-end e que apenas o token seja enviado. | **SAQ-A**: Ideal para minimizar o escopo, pois os dados sensíveis do cartão não tocam os seus servidores.                                            |

<br />

> ❗️ Os dados de autenticação confidenciais (CVV, Trilha Completa, PIN/bloco de PIN) não podem ser armazenados após a autorização, mesmo se criptografados.

<br />

No **Asaas**, estar conforme o PCI DSS vai muito além de atender requisitos técnicos.  É um **compromisso diário** com a **segurança**, sem abdicar da eficiência.

Automatizamos processos, aumentamos a produtividade e reduzimos burocracias. Tudo isso com uma base sólida: **segurança que protege, sem atrapalhar o ritmo do seu negócio.**

Com o PCI DSS, garantimos que cada transação, cada integração e cada etapa da cobrança estejam protegidas.

# Dúvidas?

Caso tenha dúvidas sobre a necessidade de adequação de sua empresa no PCI-DSS, recomendamos que busque uma **Consultoria PCI compliance** para lhe auxiliar no processo.



Sempre que sua conta recebe um pagamento, uma cobrança é atrelada a ele e a receita é adicionada ao seu extrato. A mesma coisa acontece para qualquer outra receita que entre na sua conta, onde o Asaas cria cobranças automaticamente.

> 📘
>
> É importante sempre estar atento no Webhook de Cobranças e preparar sua aplicação para diferenciar cada cobrança criada.

### Assinaturas

A assinatura é uma funcionalidade que cria novas cobranças. Quando é uma assinatura por cartão de crédito a cobrança é paga automaticamente, se for uma assinatura por boleto, por exemplo, uma cobrança é criada e enviada ao seu cliente. Um campo chamado `subscription` com o ID da assinatura será adicionado em todas as cobranças criadas provenientes de assinaturas.

### Link de pagamento

Ao finalizar um link de pagamento, uma cobrança também é criada. Quando o Link é pago no cartão de crédito cobrança é criada e paga automaticamente, o mesmo pode acontecer com o Pix. No boleto uma fatura é gerada para se paga conforme configurações. Nestes casos, o campo `paymentLink` será adicionado na cobrança criada com o ID do link de pagamento.

### QR Code estático para Pix

Você pode criar um QR Code estático, onde sua conta recebe pagamentos via Pix. Nestes casos uma cobrança também será criada, com o `billingType` como `PIX` e o campo `pixQrCodeId` conterá o ID do QR Code estático criado. 

No extrato será exibido a cobrança com a descrição "Cobrança criada automaticamente a partir de Pix recebido".

### Transferências

Da mesma forma, transferências recebidas, sejam por TED ou  Chave Pix também geram automaticamente a criação de uma cobrança, transferências TED recebem uma descrição "Cobrança gerada automaticamente a partir de TED recebido", já as de Pix recebem também o campo `pixTransaction` informando o ID da transação Pix.