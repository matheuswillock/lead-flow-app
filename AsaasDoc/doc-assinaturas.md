

Assinaturas devem ser utilizadas quando a cobrança é feita periodicamente de forma recorrente, como por exemplo cobrar o cliente mensalmente pelo uso do seu software, cobrança mensal de aluguéis, etc. Além de mensal é possível escolher outras periodicidades como trimestral, semestral, entre outras.

<Embed url="https://www.youtube.com/watch?v=m-ahYNfK_UU" title="Como Criar Assinaturas na nossa API | Asaas Dev" favicon="https://www.google.com/favicon.ico" image="https://i.ytimg.com/vi/m-ahYNfK_UU/hqdefault.jpg" provider="youtube.com" href="https://www.youtube.com/watch?v=m-ahYNfK_UU" typeOfEmbed="youtube" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252Fm-ahYNfK_UU%253Ffeature%253Doembed%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253Dm-ahYNfK_UU%26image%3Dhttps%253A%252F%252Fi.ytimg.com%252Fvi%252Fm-ahYNfK_UU%252Fhqdefault.jpg%26key%3D7788cb384c9f4d5dbbdbeffd9fe4b92f%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />

### Diferença entre assinaturas e parcelamentos

Assinaturas são diferentes de cobranças parceladas: ao gerar uma cobrança parcelada, todas as parcelas são geradas de uma só vez. Já no caso da assinatura, uma cobrança será a cada mês (ou conforme a periodicidade selecionada) e enviada para o cliente. Caso a forma de pagamento da assinatura seja cartão de crédito, o cartão do cliente será cobrado automaticamente no data de vencimento da cobrança.

Assinaturas e parcelamentos diferem também quando são pagos com cartão de crédito: no caso de parcelamento, o valor total da compra é cobrado no cartão do cliente de uma só vez, parcelando conforme especificado. No caso de assinaturas, uma nova transação é lançada mensalmente (ou de acordo com a periodicidade selecionada) no cartão do cliente, até que a assinatura seja removida ou o cartão sendo utilizado se torne inválido (no caso expiração, cancelamento, etc).

### Fluxo de criação de cobranças de uma assinatura

Cobranças recorrentes pertencentes a uma assinatura são geradas **40 dias antes** do vencimento (`dueDate`). Dessa forma, uma assinatura que foi configurada para vencer 5 dias após sua criação, com vencimento mensal, já terá duas cobranças pertencentes a ela no sistema.

<Image align="center" src="https://files.readme.io/30ade80-fluxo_de_criao_de_assinaturas_1.png" />

No infográfico acima o cliente está com a configuração padrão de notificação de 10 dias antes do vencimento ativada. Dessa forma ao criar a assinatura, duas cobranças são criadas, mas somente as notificações do vencimento da primeira são enviadas ao cliente. A notificação da cobrança seguinte será enviada apenas 10 dias antes de seu vencimento.

### Prazo para geração de cobranças em assinaturas

As cobranças são geradas, por padrão, 40 dias antes do vencimento, para permitir maior liberdade a você oferecer ao seu cliente a cobrança quando achar mais viável. Porém, caso deseje, é possível alterar o prazo de geração 14 ou 7 dias antes da cobrança vencer. Nesse caso, basta entrar em contato com o seu Gerente de Contas e fazer a solicitação.



Para criar uma assinatura, basta chamar o endpoint de assinaturas.

> **POST** `/v3/subscriptions`\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-assinatura)

```json
{
  "customer": "cus_0T1mdomVMi39",
  "billingType": "BOLETO",
  "nextDueDate": "2023-10-15",
  "value": 19.9,
  "cycle": "MONTHLY",
  "description": "Assinatura Plano Pró",
}
```

O campo `nextDueDate` define quando será feita a primeira cobrança da assinatura, que irá seguir o ciclo conforme configurado. Os ciclos disponíveis são:

* `WEEKLY` - Semanal
* `BIWEEKLY` - Quinzenal (2 semanas)
* `MONTHLY` - Mensal
* `QUARTERLY` - Trimestral
* `SEMIANNUALLY` - Semestral
* `YEARLY` - Anual

A assinatura funciona como um agendador de criação de cobranças. No exemplo acima, uma nova cobrança do tipo boleto será criada mensalmente e enviada ao seu cliente, conforme [configurações de notificação](https://docs.asaas.com/reference/notificacoes).

Depois de criada, você terá em mãos o ID da assinatura que segue um padrão semelhante a este: `sub_VXJBYgP2u0eO`.

### Verificando se uma assinatura foi paga

Para saber se uma assinatura foi paga, você deve acompanhar o [webhook para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas). Quando uma nova cobrança é criada referente a sua assinatura, você receberá um evento `PAYMENT_CREATED` e o campo `subscription` conterá o ID da sua assinatura.

Assim que a cobrança relacionada a assinatura, você receberá o evento `PAYMENT_RECEIVED` em caso de pagamento por boleto, como no exemplo.

Você também poderá verificar as cobranças criadas de uma assinatura através do endpoint:

> GET `/v3/subscriptions/{id}/payments`\
> [Confira a referência completa deste endpoit](https://docs.asaas.com/reference/listar-cobrancas-de-uma-assinatura)

### Editar assinatura

É possível alterar todas as informações de uma assinatura do tipo `BOLETO` ou `PIX`. 

> **POST** `/v3/subscriptions/{id}`\
> [Veja a referência completa deste endpoint.](https://docs.asaas.com/reference/atualizar-assinatura-existente)

Ao atualizar o valor da assinatura ou forma de pagamento somente serão afetadas mensalidade futuras. Para atualizar as mensalidades já criadas mas não pagas com a nova forma de pagamento e/ou novo valor, é necessário passar o parâmetro `updatePendingPayments: true`.

### Recuperar cobranças da assinatura

Diferente de um parcelamento, em que no retorno da criação é devolvido o id da primeira cobrança, no caso de assinaturas, a cobrança é criada apenas depois da assinatura, e não junto, e por isso não é possível recuperar esse id no ato da criação.

Para ter acesso à primeira cobrança criada da assinatura, é necessário consumir a API uma segunda vez no endpoint:

> **GET** /v3/subscriptions/\{id}/payments\
> [Veja a referência completa deste endpoint.](https://docs.asaas.com/reference/listar-cobrancas-de-uma-assinatura)

Esse endpoint irá retornar todas as cobranças já criadas nesta assinatura, assim como seus status.



Assim como na cobrança, os dados do cartão e do portador podem ser enviados na requisição de criação da assinatura para que o pagamento já seja processado. A diferença é que no caso da cobrança o cartão do cliente é cobrado no momento da criação da mesma, já no caso da assinatura, o cartão será validado no momento da criação, porém a cobrança será feita somente no vencimento da primeira mensalidade. É importante ressaltar que a validação feita no momento a criação não garante que cobrança ocorrerá com sucesso no vencimento, pois neste meio-tempo o cartão pode ter sido cancelado, expirado, não ter limite, entre outros.

Para tal, ao executar a requisição de criação da assinatura, basta enviar os dados do cartão de crédito juntamente com os dados do titular através dos objetos `creditCard` e `creditCardHolderInfo`. Se a transação for autorizada a assinatura será criada e a API retornará `HTTP 200`. Caso contrário a assinatura não será persistida e será retornado `HTTP 400`.

> 📘 Dica!
>
> Caso você queira criar uma assinatura que a primeira cobrança será cobrada no ato da criação, informe o `nextDueDate` como a data atual.

Uma vez criada a assinatura com cartão de crédito, a cobrança será feita mensalmente (ou outra periodicidade definida) no cartão do cliente até que ele se torne inválido ou você remova a assinatura.

> 🚧 Atenção
>
> * Caso você opte por capturar na interface do seu sistema os dados do cartão do cliente, é obrigatório o uso de SSL (HTTPS), caso contrário sua conta pode ser bloqueada para transações via cartão de crédito.
> * Para se evitar timeouts e decorrentemente duplicidades na captura, recomendamos a configuração de um timeout mínimo de 60 segundos para este request.

> **POST** `/v3/subscriptions`\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-assinatura)

```json
{
  "customer": "cus_0T1mdomVMi39",
  "billingType": "CREDIT_CARD",
  "nextDueDate": "2023-10-15",
  "value": 19.9,
  "cycle": "MONTHLY",
  "description": "Assinatura Plano Pró",
  "creditCard": {
    "holderName": "marcelo h almeida",
    "number": "5162306219378829",
    "expiryMonth": "05",
    "expiryYear": "2021",
    "ccv": "318"
  },
  "creditCardHolderInfo": {
    "name": "Marcelo Henrique Almeida",
    "email": "marcelo.almeida@gmail.com",
    "cpfCnpj": "24971563792",
    "postalCode": "89223-005",
    "addressNumber": "277",
    "addressComplement": null,
    "phone": "4738010919",
    "mobilePhone": "47998781877"
  },
}
```

### Como alterar a data de vencimento ou o valor?

Para conseguir alterar o **valor ou vencimento** de uma assinatura, você precisa obrigatoriamente ter a tokenização ativa em sua conta.

Essa funcionalidade permite você cobrar de seus clientes recorrentemente sem a necessidade deles informarem todos os dados de cartão de crédito novamente. Tudo isso de forma segura por meio de um token.

> 🚧 Atenção
>
> * A funcionalidade de tokenização está previamente habilitada em Sandbox e você já pode testá-la. Para uso em produção, é necessário solicitar a habilitação da funcionalidade ao seu gerente de contas. A habilitação da funcionalidade está sujeita a análise prévia, podendo ser aprovada ou negada de acordo com os riscos da operação.
> * O token é armazenado por cliente, não podendo ser utilizado em transações de outros clientes.

Para editar a assinatura você não precisa informar o token, mas precisa que ele esteja ativado em sua conta.

> **POST** `/v3/subscriptions/{id}`\
> [Veja a referência completa deste endpoint.](https://docs.asaas.com/reference/atualizar-assinatura-existente)

Além disso, ao atualizar o valor da assinatura ou forma de pagamento somente serão afetadas mensalidade futuras. Para atualizar as mensalidades já criadas mas não pagas com a nova forma de pagamento e/ou novo valor, é necessário passar o parâmetro `updatePendingPayments: true`.

### Como alterar o cartão de crédito de uma assinatura?

Você pode atualizar o cartão de crédito de uma assinatura **sem realizar uma cobrança imediata**! Essa é a maneira recomendada para atualizar os dados do cartão em uma assinatura recorrente.

Atualizar sem cobrança imediata:

> **PUT** `/v3/subscriptions/{id}/creditCard`\
> [Veja a referência completa deste endpoint.](https://docs.asaas.com/reference/atualizar-cartao-de-credito-assinatura)

```json
{
  "creditCard": {
    "holderName": "John Doe",
    "number": "1234567890123456",
    "expiryMonth": "4",
    "expiryYear": "2025",
    "ccv": "123"
  },
  "creditCardHolderInfo": {
    "name": "John Doe",
    "email": "john.doe@asaas.com",
    "cpfCnpj": "12345678901",
    "postalCode": "12345678",
    "addressNumber": "123",
    "addressComplement": null,
    "phone": null,
    "mobilePhone": null
  },
  "creditCardToken": "a75a1d98-c52d-4a6b-a413-71e00b193c99",
  "remoteIp": "116.213.42.532"
}
```

### Como poderia fazer upgrade de um plano de assinatura?

Pode acontecer de você ter um cliente que fez uma assinatura mensal, mas no meio do período quer mudar o plano para um superior, mais caro, por exemplo ou migrar para o plano anual. Se você tiver a tokenização ativa na sua conta, poderá alterar o valor da assinatura e/ou data, caso contrário, o recomendado é remover a assinatura atual e criar uma nova em seguida.

Caso o seu cliente tenha valores proporcionais para acertar, recomendamos verificar as cobranças em aberto, calcular qual seria o valor extra, gerar uma nova cobrança do valor poporcional e depois editar sua assinatura para os novos valores e/ou data.



Ao criar uma configuração, o Asaas irá gerar automaticamente as notas fiscais para as cobranças desta assinatura utilizando com base os valores definidos nesta configuração.

> **POST** `/v3/subscriptions/{id}/invoiceSettings`\
> [Confira a referência completa deste endpoint.](https://docs.asaas.com/reference/criar-configuracao-para-emissao-de-notas-fiscais)

As notas serão geradas em conjunto com a criação das cobranças, tendo suas datas de emissão definidas a partir do valor enviado pelo parâmetro `effectiveDatePeriod`.

Caso a assinatura já possua cobranças, apenas serão geradas notas fiscais para as cobranças que se encaixam na configuração definida.

Os períodos de emissão disponíveis são:

* `ON_PAYMENT_CONFIRMATION` - Emissão apenas quando cada cobrança for paga.
* `ON_PAYMENT_DUE_DATE` - No dia do vencimento de cada cobrança.
* `BEFORE_PAYMENT_DUE_DATE` - 5, 10, 15, 30 ou 60 dias antes do vencimento.
* `ON_DUE_DATE_MONTH` - No 1º dia do mesmo mês do vencimento de cada cobrança.
* `ON_NEXT_MONTH` - No 1º dia do mês seguinte ao mês do vencimento de cada cobrança.

Você pode informar o serviço municipal desejado enviando o identificador único do serviço do seu município por meio do atributo `municipalServiceId`, este pode ser obtido por meio da nossa [seção de serviços municipais](https://docs.asaas.com/reference/listar-servicos-municipais).

Caso a lista de serviços não seja disponibilizada, você deve obtêr o código do serviço municipal desejado manualmente junto a sua prefeitura e envia-lo por meio do atributo `municipalServiceCode`.

> 🚧 Atenção
>
> * Caso seja selecionado o período `BEFORE_PAYMENT_DUE_DATE`, também deve ser enviado o parâmetro `daysBeforeDueDate`, que determina quantos dias antes do vencimento será gerado a nota fiscal.
> * Os valores validos para o parâmetro `daysBeforeDueDate` são os inteiros: 5, 10, 15, 30 ou 60.
> * O parâmetro `receivedOnly` é necessário apenas quando utilizado o período `ON_NEXT_MONTH`, caso não enviado será definido como valor padrão `false`.



Quando uma cobrança recorrente é criada ou uma cobrança de assinatura é recebida, é verificado se o valor total do split configurado para a assinatura é superior ao valor líquido a receber. Caso isso ocorra, a assinatura será bloqueada, o split desabilitado e a criação de novas cobranças recorrentes também será interrompida. Nesse cenário, uma notificação será enviada via webhook, informando, no corpo da mensagem (propriedade additionalInfo), sobre o bloqueio e concedendo um prazo de 2 dias úteis para ajustar o split ou o valor da assinatura.

Se o ajuste do split ou do valor da assinatura for realizado dentro do prazo e o novo valor total do split estiver igual ou inferior ao valor líquido da assinatura, o desbloqueio será efetuado, permitindo a liberação da assinatura e a geração de novas cobranças com o split atualizado.

No entanto, caso o ajuste não seja feito no prazo estipulado, o bloqueio será encerrado automaticamente por expiração, e o split permanecerá desabilitado. Nesse cenário, uma nova notificação será enviada via webhook para informar sobre a expiração do bloqueio. No corpo da notificação, na propriedade `additionalInfo`, será incluída uma mensagem detalhando a liberação da assinatura e a criação de cobranças recorrentes sem o split configurado.

Eventos do webhook utilizados para comunicação:

* Para o fluxo de bloqueio: `SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK`
* Para o fluxo de desbloqueio por expiração do prazo: `SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED`