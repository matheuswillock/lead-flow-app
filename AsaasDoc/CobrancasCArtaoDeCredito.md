

# Cobranças via cartão de crédito

Segurança e praticidade nas cobranças online.

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
> * Independente da data de vencimento informada, a captura (cobrança no cartão do cliente) será efetuada no momento da criação da cobrança.\* Caso você opte por capturar na interface do seu sistema os dados do cartão do cliente, é obrigatório o uso de SSL (HTTPS), caso contrário sua conta pode ser bloqueada para transações via cartão de crédito.\* Para se evitar timeouts e decorrentemente duplicidades na captura, recomendamos a configuração de um timeout mínimo de 60 segundos para este request.

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
> * A funcionalidade de tokenização está previamente habilitada em Sandbox e você já pode testá-la. Para uso em produção, é necessário solicitar a habilitação da funcionalidade ao seu gerente de contas. A habilitação da funcionalidade está sujeita a análise prévia, podendo ser aprovada ou negada de acordo com os riscos da operação.\* O token é armazenado por cliente, não podendo ser utilizado em transações de outros clientes.

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