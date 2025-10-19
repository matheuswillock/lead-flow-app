

<Embed url="https://www.youtube.com/watch?v=vXKIU4oOAa0" title="Aprenda a fazer transferências na API Asaas | Asaas Devias" favicon="https://www.google.com/favicon.ico" image="https://i.ytimg.com/vi/vXKIU4oOAa0/hqdefault.jpg" provider="youtube.com" href="https://www.youtube.com/watch?v=vXKIU4oOAa0" typeOfEmbed="youtube" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252FvXKIU4oOAa0%253Ffeature%253Doembed%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253DvXKIU4oOAa0%26image%3Dhttps%253A%252F%252Fi.ytimg.com%252Fvi%252FvXKIU4oOAa0%252Fhqdefault.jpg%26key%3D7788cb384c9f4d5dbbdbeffd9fe4b92f%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />

Possibilita transferir valores entre contas Asaas ou contas bancárias de outros bancos. Não é possível transferir valor superior ao saldo da conta Asaas de origem.

> 📘
>
> O saldo disponível para transferência pode ser consultado através do endpoint de [Recuperar saldo da conta](https://docs.asaas.com/reference/recuperar-saldo-da-conta).

Os possíveis status que uma transferência pode ter são:

* `PENDING` - Pendente
* `DONE` - Realizada
* `CANCELLED` - Cancelada




## Transferência para conta de outra instituição

Informe os campos `bankAccount` para realizar a transferência para uma conta bancária.

Caso seja feita via Pix, a transferência é feita instantaneamente ou na data de agendamento. Para TED, a transferência fica pendente até o processamento bancário, que pode ocorrer no mesmo dia ou no próximo dia útil dependendo do horário da solicitação.

> **POST** `/v3/transfers`\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/transferir-para-conta-de-outra-instituicao-ou-chave-pix)

```json
{
  "value": 1000.00,
  "bankAccount": {
    "bank": {
      "code": "237"
    },
    "ownerName": "Marcelo Almeida",
    "cpfCnpj": "52233424611",
    "agency": "1263",
    "account": "9999991",
    "accountDigit": "1",
    "bankAccountType": "CONTA_CORRENTE"
  },
}
```

> 📘
>
> Caso não seja informado `operationType` e a conta bancária pertencer a um banco ou instituição de pagamento participante do Pix, a transferência é feita via Pix, caso contrário via TED.

## Transferir para uma chave Pix

Informe os campos `pixAddressKey` e `pixAddressKeyType` para fazer uma transferência para chave Pix.

> **POST** `/v3/transfers`\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/transferir-para-conta-de-outra-instituicao-ou-chave-pix)

```json
{
  "value": 1000.00,
  "pixAddressKey": "09493012301",
  "pixAddressKeyType": "CPF",
  "scheduleDate": null,
  "description": "Churrasco pago via Pix com chave"
}
```

Solicita uma nova transferência para a chave Pix informada. A transferência pode ser feita instantâneamente ou agendada (informando o campo `scheduleDate`).

Chaves do tipo telefone devem conter 11 dígitos, já com código de área do estado. Ex: `4799999999`, chaves CPF ou CNPJ devem ser informadas sem traço/pontuação.




Solicita uma nova transferência para uma conta Asaas. É necessário o walletId da conta Asaas de destino retornado no momento da criação da mesma.

> **POST** `/v3/transfers/`\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/transferir-para-conta-asaas)

```json
{
  "value": 1000.00,
  "walletId": "0021c712-d963-4d86-a59d-031e7ac51a2e"
}
```

Em geral as transferências entre contas Asaas são efetivadas imediatamente, ficando o saldo disponível para uso na conta de destino.

O walletId é retornado pelo Asaas no momento da criação da conta via API. Caso você não o tenha armazenado, acesse nossa seção [recuperar walletId](https://docs.asaas.com/reference/recuperar-walletid) para mais detalhes sobre como obtê-lo.

> 🚧 Atenção
>
> * Não é possível realizar transferências de uma conta Asaas para outras contas Asaas sem vínculo a sua.
> * Caso seja necessário, [entre em contato com o nosso suporte técnico](https://docs.asaas.com/docs/entre-em-contato).


