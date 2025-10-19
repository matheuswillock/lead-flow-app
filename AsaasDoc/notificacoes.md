

<Embed url="https://www.youtube.com/watch?v=CqPOOPX1Sfk" title="Como Criar Notificações Para Seus Clientes | Asaas Dev" favicon="https://www.google.com/favicon.ico" image="https://i.ytimg.com/vi/CqPOOPX1Sfk/hqdefault.jpg" provider="youtube.com" href="https://www.youtube.com/watch?v=CqPOOPX1Sfk" typeOfEmbed="youtube" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252FCqPOOPX1Sfk%253Ffeature%253Doembed%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253DCqPOOPX1Sfk%26image%3Dhttps%253A%252F%252Fi.ytimg.com%252Fvi%252FCqPOOPX1Sfk%252Fhqdefault.jpg%26key%3D7788cb384c9f4d5dbbdbeffd9fe4b92f%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />

As notificações são a maneira que o Asaas utiliza para manter você e seu cliente atualizados sobre a situação das cobranças, notificar recebimento, atraso, modificações, etc. É possível desabilitar todas as notificações para um determinado cliente utilizando o atributo `notificationDisabled` na [criação de um novo cliente](https://docs.asaas.com/reference/criar-novo-cliente).

![](https://files.readme.io/8e09c0a-image.png)

O Asaas envia notificações por WhatsApp, E-mail, SMS, Correios e Robô de Voz. Confira as [notificações padrões que são configuradas](https://docs.asaas.com/docs/notificacoes-padroes) para todos os clientes.

> 🚧
>
> Taxas são aplicadas no envio de notificações de cobrança. Confira os valores a [seção de Taxas no Minha conta](https://www.asaas.com/config/index?tab=fees).

> 📘
>
> Para ativar notificações por voz (`phoneCallEnabledForCustomer: true`) é necessário que o cliente possua um telefone fixo ou móvel cadastrado.

Para saber mais sobre o **produto** de **notificações** [clique aqui](https://ajuda.asaas.com/pt-BR/?q=NOTIFICA%C3%87%C3%95ES).




Por padrão, a API cria as seguintes notificações ao cadastrar um novo cliente:

### Aviso de cobrança criada:

Notificação é enviada no momento em que a cobrança é criada, exceto para cobranças criadas por assinaturas.

```json
    {
        "object": "notification",
        "id": "not_NhHT6M5yUe0C",
        "customer": "cus_Y4AEif5zrMGK",
        "enabled": true,
        "emailEnabledForProvider": false,
        "smsEnabledForProvider": false,
        "emailEnabledForCustomer": true,
        "smsEnabledForCustomer": true,
        "phoneCallEnabledForCustomer": false,
        "whatsappEnabledForCustomer": false,
        "event": "PAYMENT_CREATED",
        "scheduleOffset": 0,
        "deleted": false
    }
```

### Aviso no dia do vencimento:

Notificação enviada na data em que a cobrança vence.

```json
    {
        "object": "notification",
        "id": "not_1igKsZL9xpsl",
        "customer": "cus_Y4AEif5zrMGK",
        "enabled": true,
        "emailEnabledForProvider": false,
        "smsEnabledForProvider": false,
        "emailEnabledForCustomer": true,
        "smsEnabledForCustomer": true,
        "phoneCallEnabledForCustomer": false,
        "whatsappEnabledForCustomer": false,
        "event": "PAYMENT_DUEDATE_WARNING",
        "scheduleOffset": 0,
        "deleted": false
    }
```

### Aviso de cobrança recebida

Notificação enviada no momento em que o Asaas registra o recebimento de uma cobrança.

```json
    {
        "object": "notification",
        "id": "not_f8JpoWuEjEKd",
        "customer": "cus_Y4AEif5zrMGK",
        "enabled": true,
        "emailEnabledForProvider": true,
        "smsEnabledForProvider": false,
        "emailEnabledForCustomer": true,
        "smsEnabledForCustomer": true,
        "phoneCallEnabledForCustomer": false,
        "whatsappEnabledForCustomer": false,
        "event": "PAYMENT_RECEIVED",
        "scheduleOffset": 0,
        "deleted": false
    }
```

### Linha digitável no dia do vencimento:

Notificação enviada na data de vencimento da cobrança caso a fatura ou boleto não tenham sido visualizados pelo seu cliente.

```json
    {
        "object": "notification",
        "id": "not_AWAz6FbrgCPG",
        "customer": "cus_Y4AEif5zrMGK",
        "enabled": true,
        "emailEnabledForProvider": false,
        "smsEnabledForProvider": false,
        "emailEnabledForCustomer": true,
        "smsEnabledForCustomer": true,
        "phoneCallEnabledForCustomer": false,
        "whatsappEnabledForCustomer": false,
        "event": "SEND_LINHA_DIGITAVEL",
        "scheduleOffset": 0,
        "deleted": false
    }
```

### Aviso de cobrança vencida

Notificação enviada no momento em que o Asaas identifica que a cobrança venceu e não foi paga. 

```json
    {
        "object": "notification",
        "id": "not_2DMytOpRKux1",
        "customer": "cus_Y4AEif5zrMGK",
        "enabled": true,
        "emailEnabledForProvider": true,
        "smsEnabledForProvider": false,
        "emailEnabledForCustomer": true,
        "smsEnabledForCustomer": true,
        "phoneCallEnabledForCustomer": true,
        "whatsappEnabledForCustomer": false,
        "event": "PAYMENT_OVERDUE",
        "scheduleOffset": 0,
        "deleted": false
    }
```

### Aviso a cada 7 dias após vencimento:

Notificação enviada a cada 7 dias enquanto a cobrança não for paga.

> 📘
>
> Você pode notar que temos duas notificações com o evento `PAYMENT_OVERDUE`, porém esta existe a configuração do `scheduleOffset` definida, porém os IDs das notificações são diferentes.

```json
    {
        "object": "notification",
        "id": "not_EDaloT543tss",
        "customer": "cus_Y4AEif5zrMGK",
        "enabled": true,
        "emailEnabledForProvider": false,
        "smsEnabledForProvider": false,
        "emailEnabledForCustomer": true,
        "smsEnabledForCustomer": true,
        "phoneCallEnabledForCustomer": true,
        "whatsappEnabledForCustomer": false,
        "event": "PAYMENT_OVERDUE",
        "scheduleOffset": 7,
        "deleted": false
    }
```

### Aviso 10 dias antes do vencimento:

Notificação enviada 10 dias antes da data de vencimento da cobrança.

> 📘
>
> Você pode notar que temos duas notificações com o evento `PAYMENT_DUEDATE_WARNING`, porém esta existe a configuração do `scheduleOffset` definida, porém os IDs das notificações são diferentes.

```json
    {
        "object": "notification",
        "id": "not_uf8KkANRwUgh",
        "customer": "cus_Y4AEif5zrMGK",
        "enabled": true,
        "emailEnabledForProvider": false,
        "smsEnabledForProvider": false,
        "emailEnabledForCustomer": true,
        "smsEnabledForCustomer": true,
        "phoneCallEnabledForCustomer": false,
        "whatsappEnabledForCustomer": false,
        "event": "PAYMENT_DUEDATE_WARNING",
        "scheduleOffset": 10,
        "deleted": false
    }
```

### Aviso de cobrança atualizada:

Notificação enviada sempre que alguma cobrança sofre alteração de data de vencimento ou valor.

```json
    {
        "object": "notification",
        "id": "not_0YmiEVhOUsyJ",
        "customer": "cus_Y4AEif5zrMGK",
        "enabled": true,
        "emailEnabledForProvider": false,
        "smsEnabledForProvider": false,
        "emailEnabledForCustomer": true,
        "smsEnabledForCustomer": true,
        "phoneCallEnabledForCustomer": false,
        "whatsappEnabledForCustomer": false,
        "event": "PAYMENT_UPDATED",
        "scheduleOffset": 0,
        "deleted": false
    }
``` 



Cada cliente possui configurações de notificação e o Asaas sempre olhará para elas quando uma nova cobrança for criada. Você pode ligar ou desligar notificações, mudar a quantos dias antes elas serão enviadas ou definir que tipo de notificações acontecerão sempre que criar um novo cliente.

O primeiro passo, depois de ter criado seu cliente é verificar quais notificações foram criadas. Para isso basta chamar o endpoint "Recuperar notificações de um cliente".

>  **GET** `/v3/customers/{id}/notifications`\
> [Confira a referência completa deste endpoint.](https://docs.asaas.com/reference/recuperar-notificacoes-de-um-cliente)

Ao chamar este endpoint, uma lista com todas as notificações criadas para este cliente será retornada:

```json
{
  "object": "list",
  "hasMore": false,
  "totalCount": 8,
  "limit": 10,
  "offset": 0,
  "data": [
    {
      "object": "notification",
      "id": "not_000042762597",
      "customer": "cus_000005358829",
      "enabled": true,
      "emailEnabledForProvider": true,
      "smsEnabledForProvider": false,
      "emailEnabledForCustomer": true,
      "smsEnabledForCustomer": true,
      "phoneCallEnabledForCustomer": false,
      "whatsappEnabledForCustomer": false,
      "event": "PAYMENT_RECEIVED",
      "scheduleOffset": 0,
      "deleted": false
    },
    {
      "object": "notification",
      "id": "not_000042762598",
      "customer": "cus_000005358829",
      "enabled": true,
      "emailEnabledForProvider": true,
      "smsEnabledForProvider": false,
      "emailEnabledForCustomer": true,
      "smsEnabledForCustomer": true,
      "phoneCallEnabledForCustomer": false,
      "whatsappEnabledForCustomer": false,
      "event": "PAYMENT_OVERDUE",
      "scheduleOffset": 0,
      "deleted": false
    },
    {
      "object": "notification",
      "id": "not_000042762602",
      "customer": "cus_000005358829",
      "enabled": true,
      "emailEnabledForProvider": false,
      "smsEnabledForProvider": false,
      "emailEnabledForCustomer": true,
      "smsEnabledForCustomer": true,
      "phoneCallEnabledForCustomer": false,
      "whatsappEnabledForCustomer": false,
      "event": "PAYMENT_DUEDATE_WARNING",
      "scheduleOffset": 10,
      "deleted": false
    },
    {
      "object": "notification",
      "id": "not_000042762601",
      "customer": "cus_000005358829",
      "enabled": true,
      "emailEnabledForProvider": false,
      "smsEnabledForProvider": false,
      "emailEnabledForCustomer": true,
      "smsEnabledForCustomer": true,
      "phoneCallEnabledForCustomer": false,
      "whatsappEnabledForCustomer": false,
      "event": "PAYMENT_DUEDATE_WARNING",
      "scheduleOffset": 0,
      "deleted": false
    },
    {
      "object": "notification",
      "id": "not_000042762599",
      "customer": "cus_000005358829",
      "enabled": true,
      "emailEnabledForProvider": false,
      "smsEnabledForProvider": false,
      "emailEnabledForCustomer": true,
      "smsEnabledForCustomer": true,
      "phoneCallEnabledForCustomer": false,
      "whatsappEnabledForCustomer": false,
      "event": "PAYMENT_CREATED",
      "scheduleOffset": 0,
      "deleted": false
    },
    {
      "object": "notification",
      "id": "not_000042762600",
      "customer": "cus_000005358829",
      "enabled": true,
      "emailEnabledForProvider": false,
      "smsEnabledForProvider": false,
      "emailEnabledForCustomer": true,
      "smsEnabledForCustomer": true,
      "phoneCallEnabledForCustomer": false,
      "whatsappEnabledForCustomer": false,
      "event": "PAYMENT_UPDATED",
      "scheduleOffset": 0,
      "deleted": false
    },
    {
      "object": "notification",
      "id": "not_000042762604",
      "customer": "cus_000005358829",
      "enabled": true,
      "emailEnabledForProvider": false,
      "smsEnabledForProvider": false,
      "emailEnabledForCustomer": true,
      "smsEnabledForCustomer": true,
      "phoneCallEnabledForCustomer": false,
      "whatsappEnabledForCustomer": false,
      "event": "SEND_LINHA_DIGITAVEL",
      "scheduleOffset": 0,
      "deleted": false
    },
    {
      "object": "notification",
      "id": "not_000042762603",
      "customer": "cus_000005358829",
      "enabled": true,
      "emailEnabledForProvider": false,
      "smsEnabledForProvider": false,
      "emailEnabledForCustomer": true,
      "smsEnabledForCustomer": true,
      "phoneCallEnabledForCustomer": false,
      "whatsappEnabledForCustomer": false,
      "event": "PAYMENT_OVERDUE",
      "scheduleOffset": 7,
      "deleted": false
    }
  ]
}
```

Tendo em mão os o ID de cada notificação você pode editá-la. 

> 🚧
>
> As notificações são fixas e criadas pelo Asaas não é possível excluí-las ou criar novas, apenas alterar.

Você pode escolher editar apenas uma notificação, fazendo a chamada ao endpoint "Atualizar notificação existente":

> **POST** `/v3/notifications/not_000042762599`\
> [Confira a referência completa deste endpoint.](https://docs.asaas.com/reference/atualizar-notificacao-existente)

```json
{
  "enabled": true,
  "emailEnabledForProvider": false,
  "smsEnabledForProvider": false,
  "emailEnabledForCustomer": true,
  "smsEnabledForCustomer": false,
  "phoneCallEnabledForCustomer": false,
  "whatsappEnabledForCustomer": false
}
```

No exemplo acima modificamos a notificação de criação de pagamento para enviar somente um e-mail ao cliente.

Você também pode alterar todas as notificações juntas e deixar somente as notificações que você quiser ativadas, por exemplo, usando o endpoint "Atualizar notificações em lote":

> **POST** `/v3/notifications/batch`\
> [Confira a referência completa deste endpoint.](https://docs.asaas.com/reference/atualizar-notificacoes-existentes-em-lote)

```json
{
  "customer": "cus_Y4AEif5zrMGK",
  "notifications": [
    {
      "id": "not_f8JpoWuEjEKd",
      "enabled": true,
      "emailEnabledForProvider": true,
      "smsEnabledForProvider": true,
      "emailEnabledForCustomer": true,
      "smsEnabledForCustomer": true,
      "phoneCallEnabledForCustomer": false,
      "whatsappEnabledForCustomer": false
    },
    {
      "id": "not_f8JpoWuEjEKd",
      "enabled": true,
      "emailEnabledForProvider": true,
      "smsEnabledForProvider": true,
      "emailEnabledForCustomer": true,
      "smsEnabledForCustomer": true,
      "phoneCallEnabledForCustomer": false,
      "whatsappEnabledForCustomer": false
    }
  ]
}
```