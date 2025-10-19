

Com nossa API você pode automatizar seus processos de cobrança, recebimento e pagamento de forma fácil e segura, utilizando várias formas de pagamento: PIX, boleto bancário, cartão de crédito e débito e TED

## Para iniciar no processo de criação de cobranças, siga esses passos iniciais

1. [Crie um cliente](https://docs.asaas.com/docs/criando-um-cliente), a partir dele você terá acesso ao ID do `customer`, essencial para criação de cobranças;
2. Crie sua cobrança, no formato que desejar, confira os guias:
   1. [Cobranças via boleto](https://docs.asaas.com/docs/cobrancas-via-boleto)
   2. [Cobranças via Pix](https://docs.asaas.com/docs/cobrancas-via-pix)
   3. [Cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito)
3. Você também pode criar cobranças onde o seu cliente escolhe a forma de pagamento
4. Você pode utilizar nossa integração de cobranças como checkout transparente, enviando todas as informações via back-end para a API, utilizando a tela de Fatura (assim podendo aceitar também pagamento com Cartão de Débito) ou utilizando a criação de [Link de Pagamento](https://docs.asaas.com/docs/link-de-pagamentos).
   1. Você também pode utilizar o [redirecionamento automático](https://docs.asaas.com/docs/redirecionamento-ap%C3%B3s-o-pagamento) após o pagamento em Faturas e Links de Pagamentos

## Notificações de cobranças

Como um passo opcional, você pode [configurar as notificações que seu cliente irá receber](https://docs.asaas.com/docs/notificacoes). É possível enviar notificações por e-mail, SMS e WhatsApp. Sendo elas:

1. Aviso de cobrança recebida
2. Aviso 10 dias antes do vencimento
3. Aviso no dia do vencimento
4. Aviso de cobrança vencida
5. Aviso a cada 7 dias após vencimento
6. Aviso de cobrança atualizada
7. Linha digitável no dia do vencimento




O primeiro passo para criar uma cobrança é ter o **identificador único do seu cliente**, você pode fazer isso criando um novo cliente ou consultando um que já foi criado anteriormente.

<Embed url="https://www.youtube.com/watch?v=mxt0OAP2AqY" title="Aprenda a Criar Clientes no Asaas | Asaas Dev" favicon="https://www.google.com/favicon.ico" image="https://i.ytimg.com/vi/mxt0OAP2AqY/hqdefault.jpg" provider="youtube.com" href="https://www.youtube.com/watch?v=mxt0OAP2AqY" typeOfEmbed="youtube" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252Fmxt0OAP2AqY%253Ffeature%253Doembed%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253Dmxt0OAP2AqY%26image%3Dhttps%253A%252F%252Fi.ytimg.com%252Fvi%252Fmxt0OAP2AqY%252Fhqdefault.jpg%26key%3D7788cb384c9f4d5dbbdbeffd9fe4b92f%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />

> **POST** **`/v3/customers`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-novo-cliente)

```json
{
      "name": "Marcelo Almeida",
      "cpfCnpj": "24971563792",
      "mobilePhone": "4799376637"
}
```

Ao criar um cliente, um objeto JSON será retornado com algumas informações e o mais importante, o identificador do seu cliente, que deve ser algo semelhante a isso: `cus_000005219613`. Com o identificador em mãos, já é possível criar uma cobrança.

> 🚧
>
> **É permitido a criação de clientes duplicados.** Caso não queira que isso aconteça, é necessário armazenar em sua aplicação os identificadores dos clientes criados, ou implementar uma busca antes de realizar a criação do cliente. Você pode consultar a existência do cliente no [Listar Clientes](https://docs.asaas.com/reference/listar-clientes).

## Referência da API

> 📘 Confira a referência completa do endpoint Clientes`(/v3/customers)`
>
> [Acesse nossa referência da API](https://docs.asaas.com/reference/criar-novo-cliente)




As cobranças são a principal forma de receber dinheiro em sua conta no Asaas. Com elas você pode receber pagamentos por Boleto, Cartão de crédito, Cartão de débito e Pix. Este primeiro guia irá te mostrar como criar um fluxo para boletos. [Conheça mais.](https://www.asaas.com/boleto-bancario)

<Embed url="https://www.youtube.com/watch?v=YCFgeFQwgJM" title="Como criar cobranças por boleto | Asaas Dev" favicon="https://www.google.com/favicon.ico" image="https://i.ytimg.com/vi/YCFgeFQwgJM/hqdefault.jpg" provider="youtube.com" href="https://www.youtube.com/watch?v=YCFgeFQwgJM" typeOfEmbed="youtube" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252FYCFgeFQwgJM%253Ffeature%253Doembed%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253DYCFgeFQwgJM%26image%3Dhttps%253A%252F%252Fi.ytimg.com%252Fvi%252FYCFgeFQwgJM%252Fhqdefault.jpg%26key%3D7788cb384c9f4d5dbbdbeffd9fe4b92f%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />

### Criando uma cobrança por boleto

Ao criar um cobrança, automaticamente um boleto será criado. Lembrando que a taxa referente ao pagamento de um boleto só é descontada da sua conta em caso de pagamento do mesmo.

> **POST`/v3/lean/payments`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)

```json
{
      "customer": "cus_000005219613",
      "billingType": "BOLETO",
      "value": 100.00,
      "dueDate": "2023-07-21"
}
```

Olhando para o objeto retornado, temos acesso a propriedade `bankSlipUrl` que é o arquivo PDF do boleto que acabou de ser gerado.

### Cobrança parcelada

Você também pode facilmente criar uma cobrança parcelada e recuperar o carnê desta cobrança com todos os boletos do parcelamento.

Primeiro, vamos criar nossa cobrança parcelada em 10 vezes.

> **POST`/v3/lean/payments`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)

```json
{
  "customer": "cus_000005219613",
  "billingType": "BOLETO",
  "value": 2000.00,
  "dueDate": "2023-07-21",
  "installmentCount": 10,
  "installmentValue": 200.00
}
```

No retorno feito pela API já podemos ver que o campo `installment` veio preenchido com o ID do parcelamento: `24ef7e81-7961-41b7-bd28-90e25ad2c3d7`.

### Carnê de pagamentos

Para gerar o carnê você só precisa fazer uma chamada `GET` para o seguinte endpoint:

> **GET`/v3/installments/24ef7e81-7961-41b7-bd28-90e25ad2c3d7/paymentBook`**
>
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/gerar-carne-de-parcelamento)

Note que foi usado o ID do parcelamento que acabamos de receber ao criar o mesmo, este endpoint retorna um arquivo em PDF com todos os boletos gerados.

### Boleto com descontos para pagamento antecipado

Para que o Asaas cobre juros e multa na hora que um boleto for pago em atraso, você deve informar isso na criação da cobrança. Por exemplo, se você desejar dar um desconto de 10% para quem pagar 5 dias antes do vencimento, basta enviar a criação da cobrança dessa forma:

> **POST`/v3/lean/payments`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)

```json
{
  "customer": "cus_000005219613",
  "billingType": "BOLETO",
  "value": 2000.00,
  "dueDate": "2023-07-21",
  "discount": {
     "value": 10,
     "dueDateLimitDays": 5,
     "type": "PERCENTAGE"
}
```

Após a cobrança ser paga, se você fizer uma busca pela mesma, poderá ver que existirá um campo `originalValue`, indicando que o campo `value` está diferente do valor definido originalmente. Essa informação também estará presente no retorno do Webhook.

### Boleto com juros e multas

Da mesma forma que você pode adicionar descontos para pagamentos antecipados, você pode definir juros e multas para pagamentos em atraso.

> **POST`/v3/lean/payments`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)

```json
{
  "customer": "cus_000005219613",
  "billingType": "BOLETO",
  "value": 2000.00,
  "dueDate": "2023-07-21",
  "interest": {
     "value": 1,
  },
  "fine": {
     "value": 2,
  },
}
```

Isso irá adicionar 1% de juros ao mês e 2% de multa em caso de atraso. A mesma informação sobre o `originalValue` se encaixa nesse formato também.

> 📘
>
> Após o boleto ser pago, no retorno do Webhook você terá acesso ao campo `interestValue`, que mostra a soma dos juros e multa que foram aplicadas na cobrança.

### Obter linha digitável do boleto

Se você precisar da linha digitável para exibir na tela ao seu cliente, é necessário fazer uma nova chamada na API.

> **GET`/v3/lean/payments/{id}/identificationField`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)

```json
{
  "identificationField": "00190000090275928800021932978170187890000005000",
  "nossoNumero": "6543",
  "barCode": "00191878900000050000000002759288002193297817"
}
```

> 🚧
>
> Caso a cobrança seja atualizada, a linha digitável também sofrerá alterações. O indicado é que a cada nova atualização da cobrança a linha digitável seja novamente recuperada, garantindo que você sempre estará exibindo a linha digitável atualizada.

### Como adicionar o QRCode do Pix no PDF do boleto?

Para que um QRCode de Pix apareça em todos os PDFs de boletos gerados pelo Asaas, basta você ter cadastrado uma chave Pix na sua conta.

## Referência da API

> 📘 **Confira a referência completa do endpoint Cobranças`(/v3/lean/payments)`**
>
> [Acesse nossa referêncida da API](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)




O Asaas aceita diversas bandeiras de cartão de forma fácil e sem mensalidade. Você pode fazer vendas à vista, parceladas e recorrentes. [Conheça mais](https://www.asaas.com/cobranca-cartao).

<Embed url="https://www.youtube.com/watch?v=PmKjDXgTLa4" favicon="https://www.google.com/favicon.ico" image="http://i.ytimg.com/vi/PmKjDXgTLa4/hqdefault.jpg" provider="youtube.com" href="https://www.youtube.com/watch?v=PmKjDXgTLa4" typeOfEmbed="youtube" title="undefined" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252FPmKjDXgTLa4%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253DPmKjDXgTLa4%26image%3Dhttp%253A%252F%252Fi.ytimg.com%252Fvi%252FPmKjDXgTLa4%252Fhqdefault.jpg%26key%3D7788cb384c9f4d5dbbdbeffd9fe4b92f%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />

### Criando uma cobrança por cartão de crédito

É possível seguir dois passos, um deles é criar uma cobrança do tipo cartão de crédito e redirecionar o usuário para a tela de fatura para fazer o pagamento.

> **POST`/v3/lean/payments`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)

```json
{
      "customer": "cus_000005219613",
      "billingType": "CREDIT_CARD",
      "value": 109.90,
      "dueDate": "2023-07-21"
}
```

Ao criar uma cobrança com a forma de pagamento cartão de crédito, você redireciona o cliente para a URL da fatura (`invoiceUrl`) afim de que ele informe os dados do cartão através da interface do Asaas.

### É possível gerar uma cobrança que aceite cartão de débito?

Enviando os dados do cartão pela API, infelizmente não. 

Mas você pode enviar o cliente para a `invoiceUrl` como descrito acima, se o `billingType` for `CREDIT_CARD` ou `UNDEFINED` a opção de Cartão de Débito estará habilitada na fatura. 

### Criar uma cobrança com cartão de crédito e já realizar o pagamento

O segundo passo é já enviar os dados do cartão de crédito na hora da criação da cobrança. Dessa forma é possível processar o pagamento na hora da criação da cobrança.

Para tal, ao executar a requisição de criação da cobrança, basta enviar os dados do cartão de crédito juntamente com os dados do titular através dos objetos `creditCard` e `creditCardHolderInfo`. É importante que os dados do titular sejam exatamente os mesmos cadastrados no banco emissor do cartão, caso contrário a transação poderá ser negada por suspeita de fraude.

Se a transação for autorizada a cobrança será criada e a API retornará `HTTP 200`. Caso contrário a cobrança não será persistida e será retornado `HTTP 400`.

Se estiver em Sandbox, [você pode usar números de cartão de crédito para teste](https://docs.asaas.com/docs/sandbox#testando-pagamento-com-cart%C3%A3o-de-cr%C3%A9dito).

> **POST`/v3/lean/payments`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)

```json
{
      "customer": "cus_000005219613",
      "billingType": "CREDIT_CARD",
      "value": 100.00,
      "dueDate": "2023-07-21",
      "creditCard": {
        "holderName": "marcelo h almeida",
        "number": "5162306219378829",
        "expiryMonth": "05",
        "expiryYear": "2024",
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
      "remoteIp": "116.213.42.532"
}
```

> 📘
>
> * Independente da data de vencimento informada, a captura (cobrança no cartão do cliente) será efetuada no momento da criação da cobrança.* Caso você opte por capturar na interface do seu sistema os dados do cartão do cliente, é obrigatório o uso de SSL (HTTPS), caso contrário sua conta pode ser bloqueada para transações via cartão de crédito.* Para se evitar timeouts e decorrentemente duplicidades na captura, recomendamos a configuração de um timeout mínimo de 60 segundos para este request.

### Tokenização de cartão de crédito

Ao realizar uma primeira transação para o cliente com cartão de crédito, a resposta da API lhe devolverá o atributo `creditCardToken`.

Em posse dessa informação, nas próximas transações, o atributo `creditCardToken` pode substituir os objetos `creditCard` e `creditCardHolderInfo` e ser informado diretamente na raiz da requisição, não necessitando assim que os objetos sejam informados novamente.

> **POST`/v3/lean/payments`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)

```json
{
      "customer": "cus_000005219613",
      "billingType": "CREDIT_CARD",
      "value": 100.00,
      "dueDate": "2023-07-21",
      "creditCardToken": "76496073-536f-4835-80db-c45d00f33695",
      "remoteIp": "116.213.42.532"
}
```

Você também pode criar um token a qualquer momento. Tendo em mão os dados dos clientes, basta enviar para o endpoint de tokenização e você receberá o `creditCardToken`.

> **POST`/v3/creditCard/tokenize`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/tokenizacao-de-cartao-de-credito)

```json
{
      "customer": "cus_000005219613",
      "creditCard": {
        "holderName": "marcelo h almeida",
        "number": "5162306219378829",
        "expiryMonth": "05",
        "expiryYear": "2024",
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
      "remoteIp": "116.213.42.532"
}
```

A API retornará para você os últimos 4 dígitos do cartão `creditCardNumber` e a bandeira `creditCardBrand` do cartão (caso você queira exibir em tela, por exemplo), além do `creditCardToken`.

Essa funcionalidade é interessante caso você desenvolva uma funcionalidade de "Salvar dados de pagamentos" na sua aplicação.

> 🚧
>
> * A funcionalidade de tokenização está previamente habilitada em Sandbox e você já pode testá-la. Para uso em produção, é necessário solicitar a habilitação da funcionalidade ao seu gerente de contas. A habilitação da funcionalidade está sujeita a análise prévia, podendo ser aprovada ou negada de acordo com os riscos da operação.* O token é armazenado por cliente, não podendo ser utilizado em transações de outros clientes.

### Parcelamento no cartão

Você também pode facilmente criar uma cobrança parcelada diretamente no cartão de crédito do cliente.

> **POST`/v3/lean/payments`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)

```json
{
  "customer": "cus_000005219613",
  "billingType": "CREDIT_CARD",
  "value": 2000.00,
  "dueDate": "2023-07-21",
  "installmentCount": 10,
  "installmentValue": 200,
  "creditCard": {
      "holderName": "marcelo h almeida",
      "number": "5162306219378829",
      "expiryMonth": "05",
      "expiryYear": "2024",
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
    "remoteIp": "116.213.42.532"
}
```

<br />

> 🚧 Atenção
>
> * É permitido a criação de parcelamentos no cartão de crédito em **até 21x para cartões de bandeira Visa e Master.**\
>   Anteriormente, era suportado parcelamentos de até 12 parcelas para todas as bandeiras.\
>   **Para outras bandeiras, exceto Visa e Master, o limite continua sendo de 12 parcelas.**

<br />

> ❗️ Importante
>
> Para cobranças avulsas (1x) não deve-se usar os atributos do parcelamento: **`installmentCount`**, **`installmentValue`** e **`totalValue`**. Se for uma cobrança em 1x, usa-se apenas o **`value`**. 
>
> **Somente cobranças com 2 ou mais parcelas usa-se os atributos do parcelamento.**

### Retorno de erros para pagamentos e tokenização de cartão de créditos.

Por padrão, caso não haja nada de errado com os dados informados do cartão e ocorra algum problema na transação, a API retornará um erro genérico para você.

```json
{
    "errors": [
        {
            "code": "invalid_creditCard",
            "description": "Transação não autorizada. Verifique os dados do cartão de crédito e tente novamente."
        }
    ]
}
```

Atuamos dessa forma por motivos de segurança para que pessoas mal intencionadas não usem o Asaas para testar cartões de crédito extraviados

> 🚧
>
> Você pode ter acesso ao erro real que as transações apresentam solicitando ao seu gerente de contas que essa funcionalidade seja habilitada. Será feito uma análise prévia para a liberação. A recomendação é que esse erro real nunca seja mostrado para o usuário final.

## Referência da API

> 📘 **Confira a referência completa do endpoint Cobranças`(/v3/lean/payments)`**
>
> [Acesse nossa referêncida da API](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)




Para criar uma cobrança parcelada, ao invés de enviar o parâmetro `value`, envie `installmentCount`\
e `installmentValue`, que representam o **número de parcelas** e o **valor da cada parcela** respectivamente.

```json Request
{
  "customer": "{CUSTOMER_ID}",
  "billingType": "BOLETO",
  "installmentCount": 6,
  "installmentValue": 20,
  "dueDate": "2017-06-10",
  "description": "Pedido 056984",
  "externalReference": "056984",
  "discount": {
    "value": 10,
    "dueDateLimitDays": 0
  },
  "fine": {
    "value": 1
  },
  "interest": {
    "value": 2
  }
}
```
```json Response
{
  "object": "payment",
  "id": "pay_080225913252",
  "dateCreated": "2017-03-10",
  "customer": "cus_G7Dvo4iphUNk",
  "paymentLink": null,
  "installment": "5a2c890b-dd63-4b5a-9169-96c8d7828f4c",
  "dueDate": "2017-06-10",
  "value": 20,
  "netValue": 15,
  "billingType": "BOLETO",
  "canBePaidAfterDueDate": true,
  "pixTransaction": null,
  "status": "PENDING",
  "description": "Pedido 056984",
  "externalReference": "056984",
  "originalValue": null,
  "interestValue": null,
  "originalDueDate": "2017-06-10",
  "paymentDate": null,
  "clientPaymentDate": null,
  "installmentNumber": 3,
  "transactionReceiptUrl": null,
  "nossoNumero": "6453",
  "invoiceUrl": "https://www.asaas.com/i/080225913252",
  "bankSlipUrl": "https://www.asaas.com/b/pdf/080225913252",
  "invoiceNumber": "00005101",
  "discount": {
    "value": 10,
    "dueDateLimitDays": 0
  },
  "fine": {
    "value": 1
  },
  "interest": {
    "value": 2
  },
  "deleted": false,
  "postalService": false,
  "anticipated": false,
  "anticipable": false,
  "refunds": null
}
```

Caso prefira informar apenas o valor total do parcelamento, envie o campo `totalValue` no lugar do `installmentValue` com o valor desejado. Se não for possível a divisão exata dos valores de cada parcela, a diferença sera compensada na última parcela.

Por exemplo, um parcelamento com o valor total de R$ 350,00 divido em 12 vezes geraria 11 parcelas no valor de R$: 29,16, sendo a décima segunda parcela no valor de R$: 29,24, totalizando R$: 350.00.

A resposta em caso de sucesso será a primeira cobrança do parcelamento. Caso queira recuperar todas as parcelas basta executar a seguinte requisição com o `installment` retornado :

> `GET https://api.asaas.com/v3/installments/{installment_id}/payments`

Outras ações sobre o parcelamento podem ser encontradas em nossa [seção de parcelamentos](https://docs.asaas.com/reference/recuperar-um-unico-parcelamento).

> 🚧 Atenção
>
> * É permitido a criação de parcelamentos no cartão de crédito em **até 21x para cartões de bandeira Visa e Master.**\
>   Anteriormente, era suportado parcelamentos de até 12 parcelas para todas as bandeiras.\
>     **Para outras bandeiras, exceto Visa e Master, o limite continua sendo de 12 parcelas.**

<br />

> ❗️ Importante
>
> Para cobranças avulsas (1x) não deve-se usar os atributos do parcelamento: **`installmentCount`**, **`installmentValue`** e **`totalValue`**. Se for uma cobrança em 1x, usa-se apenas o **`value`**. 
>
> **Somente cobranças com 2 ou mais parcelas usa-se os atributos do parcelamento.**



<Image align="center" src="https://files.readme.io/c88a092-Group_453.png" />

Utilizando a URL de Retorno, é possível que o pagamento seja processado completamente na interface do Asaas, com seu cliente sendo redirecionado de volta para o seu site após a conclusão do pagamento.

<Embed url="https://www.youtube.com/watch?v=vgXBrCJA0rk" title="Configurar Redirecionamentos Após Pagamento | Asaas Dev" favicon="https://www.google.com/favicon.ico" image="https://i.ytimg.com/vi/vgXBrCJA0rk/hqdefault.jpg" provider="youtube.com" href="https://www.youtube.com/watch?v=vgXBrCJA0rk" typeOfEmbed="youtube" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252FvgXBrCJA0rk%253Ffeature%253Doembed%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253DvgXBrCJA0rk%26image%3Dhttps%253A%252F%252Fi.ytimg.com%252Fvi%252FvgXBrCJA0rk%252Fhqdefault.jpg%26key%3D7788cb384c9f4d5dbbdbeffd9fe4b92f%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />

A URL de Retorno funciona com cobranças, links de pagamento e assinaturas, sendo possível escolher entre redirecionamento automático  `autoRedirect` ou não. Caso não seja escolhido o redirecionamento automático, após a conclusão do pagamento pelo seu cliente, um botão com o texto **“Ir para o site”** será mostrado.

O `autoRedirect` funciona para pagamentos via cartão de crédito, cartão de débito (somente na fatura) e Pix, pois são os meios de pagamentos que permitem confirmação de pagamento instantânea.

A URL informada deve ser obrigatoriamente do mesmo domínio cadastrado em seus dados comerciais, que você encontra em **"Configurações da conta"** na aba **"Informações"**.

![](https://files.readme.io/4da7205-spaces_s4JaM24l9va6tBt4AJNp_uploads_iuEwB5RL3s9QMDRji1E7_image.webp)

### Criando uma fatura com redirecionamento automático

A forma de criação de cobrança é a mesma, sendo apenas necessário um atributo adicional, o `callback`. Caso ele seja informado, sua cobrança estará configurada para enviar o cliente de volta ao seu site após o pagamento.

> **POST`/v3/lean/payments`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-nova-cobranca-com-dados-resumidos-na-resposta)

```json
{
  "customer": "cus_000005219613",
  "billingType": "PIX",
  "value": 2000.00,
  "dueDate": "2023-07-21",
  "callback":{
    "successUrl": "https://seusite.com/redirect",
    "autoRedirect": false // somente enviar em caso de desativação do redirect automatico
  }
}
```

> 📘
>
> Caso você tenha definido o `autoRedirect` como`false` um botão com o texto "Ir para o site" será exibido para o seu cliente após a conclusão do pagamento.

Após criar uma cobrança com URL de Retorno, você pode redirecionar seu cliente para a URL no atributo `invoiceUrl` do JSON de resposta. No momento que o pagamento for concluído, ele será enviado para a URL que você definiu.

Caso o cliente acesse novamente o link da fatura (`invoiceUrl`) em outro momento, ele não será mais redirecionado para o seu site pois o pagamento já terá sido concluído anteriormente. Neste caso, ele verá apenas uma fatura paga.

> 📘
>
> Você pode informar o parâmetro `?autoRedirect=true` na URL da fatura caso queira que o usuário seja sempre redirecionado quando acessar o `invoiceUrl`.

Você também poderá atualizar uma Cobrança enviando os mesmos atributos [no endpoint de atualização de cobrança](https://docs.asaas.com/reference/atualizar-cobranca-existente-com-dados-resumidos-na-resposta).

<Image alt="Uma tela com um carregamento de 5 segundos é mosrada ao cliente ao realizar o pagamento com sucesso." align="center" src="https://files.readme.io/3dbf7a4-spaces_s4JaM24l9va6tBt4AJNp_uploads_iYdBHRZhiX5TSeGcKJd3_image.webp">
  Uma tela com um carregamento de 5 segundos é mosrada ao cliente ao realizar o pagamento com sucesso.
</Image>

### Criando um link de pagamento com redirecionamento automático

Da mesma forma, é possível criar um link de pagamento que, ao sucesso do pagamento, redireciona o cliente ao link informado.

> **POST`/v3/paymentLinks`**\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-um-link-de-pagamentos)

```json
{
  "name": "Meu link da pagamento",
  "billingType": "UNDEFINED",
  "value": 2000.00,
  "chargeType": "DETACHED",
  "callback":{
    "successUrl": "https://seusite.com/redirect",
    "autoRedirect": false // somente enviar em caso de desativação do redirect automatico
  }
}
```

> 📘
>
> Da mesma forma que na fatura, caso você tenha definido o `autoRedirect` como`false` um botão com a mensagem "ir para o site" será mostrado na tela de pagamento aprovado.

Após criar o Link de Pagamento com URL de sucesso, você pode redirecionar seu cliente a `url` retornada. No momento que o pagamento for confirmado, ele será enviado para a URL que você definiu.

<Image alt="Exemplo de botão de retorno no link de pagamento quando o `autoRedirect `é desativado." align="center" src="https://files.readme.io/56fd56a-spaces_s4JaM24l9va6tBt4AJNp_uploads_A8wiJpa8as0CcuZe3fl2_image.webp">
  Exemplo de botão de retorno no link de pagamento quando o `autoRedirect `é desativado.
</Image>

Você também poderá atualizar um Link de Pagamento enviando os mesmos atributos no [endpoint de atualização de link de pagamento](https://docs.asaas.com/reference/atualizar-um-link-de-pagamentos).




Quando uma cobrança sofre chargeback, algumas informações são retornadas:

O campo `chargeback` pode possuir no atributo `status`:

* `REQUESTED`, `IN_DISPUTE`, `DISPUTE_LOST`, `REVERSED` e `DONE`

O campo `chargeback` pode possuir no atributo `reason`:

* `ABSENCE_OF_PRINT` - Ausência de impressão
* `ABSENT_CARD_FRAUD` - Fraude em ambiente de cartão não presente
* `CARD_ACTIVATED_PHONE_TRANSACTION` - Transação telefônica ativada por cartão
* `CARD_FRAUD` - Fraude em ambiente de cartão presente
* `CARD_RECOVERY_BULLETIN` - Boletim de negativação de cartões
* `COMMERCIAL_DISAGREEMENT` - Desacordo comercial
* `COPY_NOT_RECEIVED` - Cópia não atendida
* `CREDIT_OR_DEBIT_PRESENTATION_ERROR` - Erro de apresentação de crédito / débito
* `DIFFERENT_PAY_METHOD` - Pagamento por outros meios
* `FRAUD` - Sem autorização do portador do cartão
* `INCORRECT_TRANSACTION_VALUE` - Valor da transação é diferente
* `INVALID_CURRENCY` - Moeda inválida
* `INVALID_DATA` - Dados inválidos
* `LATE_PRESENTATION` - Apresentação tardia
* `LOCAL_REGULATORY_OR_LEGAL_DISPUTE `- Contestação regulatória / legal local
* `MULTIPLE_ROCS `- ROCs múltiplos
* `ORIGINAL_CREDIT_TRANSACTION_NOT_ACCEPTED `- Transação de crédito original não aceita
* `OTHER_ABSENT_CARD_FRAUD `- Outras fraudes - Cartão ausente
* `PROCESS_ERROR `- Erro de processamento
* `RECEIVED_COPY_ILLEGIBLE_OR_INCOMPLETE `- Cópia atendida ilegível / incompleta
* `RECURRENCE_CANCELED `- Recorrência cancelada
* `REQUIRED_AUTHORIZATION_NOT_GRANTED `- Autorização requerida não obtida
* `RIGHT_OF_FULL_RECOURSE_FOR_FRAUD `- Direito de regresso integral por fraude
* `SALE_CANCELED` - Mercadoria / serviços cancelado
* `SERVICE_DISAGREEMENT_OR_DEFECTIVE_PRODUCT `- Mercadoria / serviço com defeito ou em desacordo
* `SERVICE_NOT_RECEIVED `- Mercadoria / serviços não recebidos
* `SPLIT_SALE` - Desmembramento de venda
* `TRANSFERS_OF_DIVERSE_RESPONSIBILITIES `- Transf. de responsabilidades diversas
* `UNQUALIFIED_CAR_RENTAL_DEBIT `- Débito de aluguel de carro não qualificado
* `USA_CARDHOLDER_DISPUTE `- Contestação do portador de cartão (EUA)
* `VISA_FRAUD_MONITORING_PROGRAM `- Programa Visa de monitoramento de fraude
* `WARNING_BULLETIN_FILE `- Arquivo boletim de advertência

Para saber mais sobre **Chargeback**, [clique aqui](https://ajuda.asaas.com/pt-BR/?q=CHARGEBACK).




Após uma cobrança ter estornos, o atributo `refunds` é retornado no objeto da mesma. Um exemplo retornado:

```json
"refunds": [
  {
    "dateCreated": "2022-02-21 10:28:40",
    "status": "DONE",
    "value": 2.00,
    "description": "Pagamento a mais",
    "transactionReceiptUrl": "https://www.asaas.com/comprovantes/6677732109104548",
  }
]
```

Os `status` disponíveis no retorno do campo `refunds` são:

* `PENDING`, `CANCELLED` e `DONE`