

# Cobranças via boleto

Comece a aceitar pagamentos de boletos online com o Asaas.

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