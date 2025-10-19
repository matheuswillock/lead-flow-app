

Um Webhook é uma forma automatizada de enviar informações entre sistemas quando certos eventos ocorrem. Quando você ativa um Webhook, ele passará a enviar requisições `POST` para o endereço configurado sempre que determinado evento acontecer. Essa requisição incluirá informações sobre o evento e o recurso envolvido.

<Embed url="https://www.youtube.com/watch?v=-lSh_ivIKuo" title="Aprenda a usar webhooks nas suas integrações de API | Asaas Dev" favicon="https://www.google.com/favicon.ico" image="https://i.ytimg.com/vi/-lSh_ivIKuo/hqdefault.jpg" provider="youtube.com" href="https://www.youtube.com/watch?v=-lSh_ivIKuo" typeOfEmbed="youtube" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252F-lSh_ivIKuo%253Ffeature%253Doembed%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253D-lSh_ivIKuo%26image%3Dhttps%253A%252F%252Fi.ytimg.com%252Fvi%252F-lSh_ivIKuo%252Fhqdefault.jpg%26key%3D7788cb384c9f4d5dbbdbeffd9fe4b92f%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />

# Por que usar Webhooks?

Se você deseja que os dados de pagamento ou informações de clientes estejam sempre sincronizados com sua aplicação, os Webhooks são a melhor solução. Eles funcionam como uma "API reversa", onde o Asaas realizará uma chamada HTTP REST na sua aplicação.

<Image align="center" src="https://files.readme.io/ad8d378-Frame_8.jpg" />

Para habilitar o recebimento de eventos de webhooks você precisa configurar a URL que receberá os eventos, o que pode ser feito via interface, acessando a [aplicação web](https://docs.asaas.com/docs/criar-novo-webhook-pela-aplicacao-web), ou [via API](https://docs.asaas.com/docs/criar-novo-webhook-pela-api). É possível cadastrar até 10 URLs de webhooks diferentes, e em cada uma você define quais eventos quer receber.

# Habilitando um Webhook

Para ativar os Webhooks você deve acessar a área de Integrações do Asaas, na aba de Webhooks, e informar a URL da sua aplicação que deve receber o POST do Asaas. Você também pode configurar Webhooks via API. Confira os guias:

* [Criar novo Webhook pela aplicação web](https://docs.asaas.com/docs/criar-novo-webhook-pela-aplicacao-web)
* [Criar novo Webhook pela API](https://docs.asaas.com/docs/criar-novo-webhook-pela-api)

# Boas práticas no uso de Webhooks

Utilize estas práticas para garantir que sua integração com Webhooks seja segura e funcione adequadamente.

### Gerencie eventos duplicados

Os webhooks garantem a entrega "*at least once*" (ao menos uma entrega). Isso significa que seu endpoint pode receber ocasionalmente o mesmo evento de webhook mais de uma vez. Você pode ignorar eventos duplicados utilizando [idempotência](https://pt.wikipedia.org/wiki/Idempot%C3%AAncia). Uma maneira de fazer isso é registrando os eventos que já foram processados e ignorá-los caso sejam enviados novamente. Cada evento enviado pelos Webhooks possui um ID próprio, que se repete caso se trate do mesmo evento.

### Configure apenas os tipos de eventos necessários para sua aplicação

Configure apenas os tipos de eventos necessários para sua aplicação em cada Webhook. Receber tipos de eventos adicionais (ou todos os tipos de eventos) sobrecarrega seu servidor e não é recomendável.

### Gerencie os eventos de forma assíncrona

Você pode encontrar problemas de escalabilidade se optar por eventos síncronos ou ter problemas de sobrecarregamento no host em caso de picos de eventos em endpoints, por isso é melhor implementar o processamento da fila de eventos de forma assíncrona. 

### Verifique se os eventos foram enviados a partir do Asaas

Para impedir que a sua aplicação receba requisições de outras origens, você tem a opção de utilizar um token para autenticar as requisições vindas do Asaas. Este token pode ser informado na configuração do Webhook. O token informado será enviado em todas as notificações no header `asaas-access-token`.

### Retorne o mais rápido possível uma resposta de sucesso

Para que o Asaas considere a notificação como processada com sucesso, o status HTTP da resposta deve ser maior ou igual a `200` e menor que 300. A sincronização é feita toda vez que há uma mudança em um evento, e caso seu sistema falhe em responder sucesso 15 vezes consecutivas, a fila de sincronização será interrompida. Novas notificações continuam sendo geradas e incluídas na fila de sincronia, porém não são enviadas para a sua aplicação. Após certificar-se que seu sistema responderá uma resposta de sucesso para o Asaas, basta reativar fila de sincronia acessando a área Minha Conta, aba Integração. Todos os eventos pendentes serão processados em ordem cronológica.

[Siga o nosso tutorial para receber eventos do Asaas em seu Webhook.](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook)

### Fique atento para eventuais falhas de comunicação

Se a sua aplicação retornar qualquer resposta HTTP que não é da família 200, a sua [fila de eventos será interrompida](https://docs.asaas.com/docs/fila-pausada) e você receberá um e-mail de comunicação do Asaas para deixá-lo ciente disso. Fique atento para evitar ter problemas de sincronização de eventos.

> ❗️ Atenção
>
> * O Asaas guarda eventos de Webhooks por **14 dias**. Você receberá um e-mail caso haja algum problema de comunicação e seus Webhooks pararem de funcionar.
> * Caso sua fila seja pausada, é de extrema importância que você resolva qualquer problema em até **14 dias** para evitar perder informações importantes.
> * **Os eventos que estiverem mais de 14 dias parados na fila serão excluídos permanentemente.**



Você pode criar novos Webhooks utilizando a aplicação Web do Asaas, para isso acesse **Menu do usuário > Integrações > Webhooks**.

<Image alt="Em seu primeiro acesso você irá visualizar um botão para criar seu primeiro Webhook." align="center" src="https://files.readme.io/8a8b76d-Empty_state.png">
  Em seu primeiro acesso você irá visualizar um botão para criar seu primeiro Webhook.
</Image>

***

Ao clicar em "**Criar Webhook**" um formulário  para mais informações irá aparecer. Na primeira etapa você precisa:

* Definir um nome;
* Definir a URL que receberá as informações dos eventos;
* Cadastrar um e-mail que será notificado em caso de erros de comunicação;
* Qual a versão da API;
* Definir um token de autenticação ou não: este token será enviado no header `asaas-access-token` em todas as chamadas do Asaas para sua aplicação;
* Se a fila de sincronização está ativada;
* Se o Webhook está ativado;
* Qual o tipo de envio: confira o artigo sobre os [tipos de envio disponíveis.](https://docs.asaas.com/docs/tipos-de-envio)

![](https://files.readme.io/22a5638-image.png)

Em sequencia a configuração você precisará selecionar os eventos que deseja receber. Você pode conferir a[ lista completa de eventos](https://docs.asaas.com/docs/eventos-de-webhooks) na nossa documentação, basta selecionar os eventos que quiser receber em diversos produtos diferentes.

![](https://files.readme.io/c96d769-image.png)

***

Você poderá ter até 10 Webhooks configurados por conta sem restrições de endereços. Você também pode editar ou excluir Webhooks criados.

<Image align="center" src="https://files.readme.io/27a967c-Listagem_de_1.png" />




Você pode criar novos Webhooks através da API, tanto para contas raiz quanto para subcontas. Você pode ter até 10 Webhooks configurados na sua conta e é você quem escolhe quais eventos cada Webhook irá receber.

Para criar um novo Webhook, vamos realizar uma chamada ao endpoint de Criar novo Webhook.

> **POST** `/v3/webhooks`\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/criar-novo-webhook)

```json
{
    "name": "Nome Exemplo",
    "url": "https://www.exemplo.com/webhook/asaas",
    "email": "marcelo.almeida@gmail.com",
    "enabled": true,
    "interrupted": false,
    "authToken": null,
    "sendType": "SEQUENTIALLY",
    "events": [
        "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
        "PAYMENT_CHECKOUT_VIEWED",
        "PAYMENT_BANK_SLIP_VIEWED",
        "PAYMENT_DUNNING_REQUESTED",
        "PAYMENT_DUNNING_RECEIVED",
        "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
        "PAYMENT_CHARGEBACK_DISPUTE",
        "PAYMENT_CHARGEBACK_REQUESTED",
        "PAYMENT_RECEIVED_IN_CASH_UNDONE",
        "PAYMENT_REFUND_IN_PROGRESS",
        "PAYMENT_REFUNDED",
        "PAYMENT_RESTORED",
        "PAYMENT_DELETED",
        "PAYMENT_OVERDUE",
        "PAYMENT_ANTICIPATED",
        "PAYMENT_RECEIVED",
        "PAYMENT_CONFIRMED",
        "PAYMENT_UPDATED",
        "PAYMENT_CREATED",
        "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
        "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
        "PAYMENT_AWAITING_RISK_ANALYSIS",
        "PAYMENT_AUTHORIZED"
    ]
}
```

Na chamada acima, criamos um novo Webhook que receberá praticamente todos os eventos de cobrança existentes.

Pela API você também pode editar, excluir ou deletar os Webhooks da sua conta. Para listar todos os Webhooks, utilize o endpoint como uma chamada GET.

> **GET** `/v3/webhooks`\
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/listar-webhooks)

A partir deste entpoint você também pode verificar quais dos seus Webhooks estão com a fila interrompida.




Siga este tutorial para criar seu primeiro Webhook.

## O objeto de evento

Eventos são objetos enviados em formato JSON via webhooks do Asaas. Eles são responsáveis por avisar quando algum evento aconteceu em sua conta.

Através dele você terá acesso ao `id`, `event` indicando qual seu evento e o objeto da entidade da qual o evento pertence, no exemplo abaixo temos o objeto `payment` com os dados da cobrança em questão.

```json
{
   "id": "evt_05b708f961d739ea7eba7e4db318f621&368604920",
   "event":"PAYMENT_RECEIVED",
   "dateCreated": "2024-06-12 16:45:03",
   "payment":{
      "object":"payment",
      "id":"pay_080225913252",
      ...
   }
}
```

Os webhooks são a forma que você usa para inscrever-se em eventos e receber notificações na sua aplicação sempre que o evento acontece.

### Tipos de eventos

Os eventos são divididos por categorias relacionadas a entidade ao qual eles pertencem. Confira a página [Eventos de Webhooks](https://docs.asaas.com/docs/eventos-de-webhooks) para conferir cada um.

## Comece por aqui

Para começar a receber eventos através de webhooks na sua aplicação, siga os passos abaixo:

1. Acesse o ambiente de [Sandbox](https://sandbox.asaas.com/);
2. Crie um endpoint na sua aplicação para receber requests HTTP do tipo POST;
3. Configure seu webhook usando nossa aplicação web ou via API;
4. Teste seu webhook;
5. Realize debug em problemas com eventos;
6. Após testado e validado, replique a configurações no ambiente de Produção;
7. Mantenha seu webhook seguro.

### Crie um endpoint

Crie um endpoint que espera receber um objeto de evento em um evento de POST. Este endpoint também deve retornar o mais rápido possível uma resposta 200, para evitar [problemas na fila de sincronização](https://docs.asaas.com/docs/fila-pausada) de eventos.

Abaixo um exemplo básico usando Node.js:

```javascript Node.js
const express = require('express');
const app = express();

app.post('/payments-webhook', express.json({type: 'application/json'}), (request, response) => {
  const body = request.body;

  switch (body.event) {
    case 'PAYMENT_CREATED':
      const payment = body.payment;
      createPayment(payment);
      break;
    case 'PAYMENT_RECEIVED':
      const payment = body.payment;
      receivePayment(payment)
      break;
    // ... trate outos eventos
    default:
      console.log(`Este evento não é aceito ${body.event}`);
  }

  // Retorne uma resposta para dizer que o webhook foi recebido
  response.json({received: true});
});

app.listen(8000, () => console.log('Running on port 8000'));
```
```php
<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

Route::post('/payments-webhook', function (Request $request) {
    $body = $request->all();

    switch ($body['event']) {
        case 'PAYMENT_CREATED':
            $payment = $body['payment'];
            createPayment($payment);
            break;
        case 'PAYMENT_RECEIVED':
            $payment = $body['payment'];
            receivePayment($payment);
            break;
        // ... trate outros eventos
        default:
            Log::info('Este evento não é aceito ' . $body['event']);
    }

    return response()->json(['received' => true]);
});

function createPayment($payment) {
    // Implementação do createPayment
}

function receivePayment($payment) {
    // Implementação do receivePayment
}
```
```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.Map;

@RestController
@RequestMapping("/payments-webhook")
public class WebhookController {

    @PostMapping(consumes = "application/json")
    public ResponseEntity<Map<String, Boolean>> handleWebhook(@RequestBody Map<String, Object> body) {
        String event = (String) body.get("event");
        Map<String, Object> payment = (Map<String, Object>) body.get("payment");

        switch (event) {
            case "PAYMENT_CREATED":
                createPayment(payment);
                break;
            case "PAYMENT_RECEIVED":
                receivePayment(payment);
                break;
            // ... trate outros eventos
            default:
                System.out.println("Este evento não é aceito " + event);
        }

        return ResponseEntity.ok(Map.of("received", true));
    }

    private void createPayment(Map<String, Object> payment) {
        // Implementação do createPayment
    }

    private void receivePayment(Map<String, Object> payment) {
        // Implementação do receivePayment
    }
}
```
```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/payments-webhook', methods=['POST'])
def payments_webhook():
    body = request.json

    if body['event'] == 'PAYMENT_CREATED':
        payment = body['payment']
        create_payment(payment)
    elif body['event'] == 'PAYMENT_RECEIVED':
        payment = body['payment']
        receive_payment(payment)
    else:
        print(f"Este evento não é aceito {body['event']}")

    return jsonify({'received': True})

def create_payment(payment):
    # Implementação do create_payment
    pass

def receive_payment(payment):
    # Implementação do receive_payment
    pass

if __name__ == '__main__':
    app.run(port=8000, debug=True)
```

### Configure seu webhook

Você pode realizar a configuração de um novo webhook via aplicação web ou via API. 

Recomendamos, para testar seu webhook e sua integração, que você primeiro precisa crie uma [conta em Sandbox](https://sandbox.asaas.com/). Confira nossa documentação sobre o Sandbox e [siga os passos](https://docs.asaas.com/docs/sandbox). Você também pode seguir os tutoriais de criação de webhook:

* [Criar novo webhook pela aplicação web](https://docs.asaas.com/docs/criar-novo-webhook-pela-aplicacao-web)
* [Criar novo webhook pela API](https://docs.asaas.com/docs/criar-novo-webhook-pela-api)

### Teste seu webhook

Com o webhook em Sandbox configurado, você pode testar seu código que está em localhost usando algumas aplicações que expõe o seu código local na web. 

Recomendamos usar uma aplicação de confiança como o [ngrok](https://ngrok.com/) ou o [Cloudflare Tunnel](https://github.com/cloudflare/cloudflared). Com ambas aplicações você pode definir uma url que pode utilizar na configuração do seu webhook.

### Debugar integração com webhooks

Você pode facilmente debugar seu webhook através da nossa página de logs de Webhooks. Acesse Menu do Usuário > Integrações > [Logs de Webhooks](https://sandbox.asaas.com/customerConfigIntegrations/webhookLogs).

<Image align="center" src="https://files.readme.io/a76002d-Frame_7.png" />

Nesta página você poderá visualizar todas as requisições enviadas via webhook para sua aplicação, qual o status retornado pelo seu servidor e também qual o conteúdo enviado. Essa página é relevante também quando você tiver problemas com a [fila de sincronização pausada](https://docs.asaas.com/docs/fila-pausada) , confira a documentação para mais detalhes.

### Mantenha seu webhook seguro

É altamente recomendado que você mantenha sua integração e todos os seus webhooks seguros. Como recomendação, o Asaas sugere:

* Confie somente nos IPs do Asaas para chamadas em webhooks: você pode realizar o bloqueio via firewall em todos os IPs que realização chamadas nas suas URLs de webhooks, exceto os [IPs oficiais do Asaas](https://docs.asaas.com/docs/ips-oficiais-do-asaas).
* Configure um `accessToken`: ao criar um novo webhook, você pode definir um código único para ele. Crie uma hash forte, de preferência um UUID v4, e confira sempre o header `asaas-access-token` para certificar que esta é uma chamada legítima.



Os webhooks do Asaas garantem que os eventos serão enviados ao menos uma vez, ou seja, seguem a premissa **"at least once"**. Isso significa que seu endpoint pode, ocasionalmente, receber o mesmo evento de webhook repetidamente em algumas situações esporádicas. Como, por exemplo, numa situação em que o Asaas não recebe uma resposta do seu endpoint. 

Dito isso, o ideal é que sua aplicação saiba tratar os eventos recebidos com duplicidade utilizando **idempotência** e este artigo tem o objetivo de explicar como a idempotência funciona e como você pode proteger a sua aplicação.

# O que é idempotência?

Idempotência se refere a capacidade que uma operação (função) tem de retornar constantemente  o mesmo resultado independente da quantidade de vezes que possa ser executada, desde que os parâmetros se mantenham sempre os mesmos.

Trazendo para o contexto de webhook, se o Asaas ocasionalmente enviar o mesmo webhook duas vezes, o ideal é que a sua aplicação responda às duas requisições com `HTTP Status 200`, mantendo sempre o mesmo retorno da primeira requisição recebida. 

# Por que usar idempotência?

Antes de explicarmos o porquê de utilizar idempotência, vamos analisar os principais verbos HTTP\: `GET`, `PUT`, `DELETE` e `POST`.

Aplicando os padrões REST corretamente na sua aplicação, os verbos `GET`, `PUT` e `DELETE` serão sempre idempotentes:

* O `GET` é um verbo de consulta que não altera o estado do recurso.
* O `PUT`, se executado diversas vezes com os mesmos parâmetros, sempre retornará o mesmo resultado.
* O `DELETE` na primeira requisição torna o estado do recurso como “excluído”, mesmo que sejam enviadas outras requisições de `DELETE`, o estado do recurso se manterá o mesmo.

No entanto, o verbo `POST` é o único dos verbos HTTPs que não possui o comportamento de idempotência por padrão:

* O `POST` pode criar um novo recurso único a cada vez que a operação for executada.

Os webhooks que são disparados pelo Asaas, por padrão, utilizam o verbo `POST` e é por isso que é importante que a sua aplicação aplique o conceito de idempotência para que o recebimento de webhooks repetidos não interfira na lógica aplicada pelo seu sistema.

# Estratégias de idempotência

1. #### **Usando um index único no banco de dados**

Os eventos enviados pelos Webhooks do Asaas possuem IDs únicos e, mesmo que eles sejam enviados mais de uma vez, você sempre receberá o mesmo ID. Uma das estratégias é criar uma fila de eventos no seu banco de dados e utilizar esse ID como uma chave única,  desta maneira você não conseguirá salvar dois IDs iguais

```sql
CREATE TABLE asaas_events (
    id bigint PRIMARY KEY,
    asaas_event_id text UNIQUE NOT NULL,
    payload JSON NOT NULL,
    status ENUM('PENDING','DONE') NOT NULL
    [...]
);

```

O indicado é que ao receber o evento do Asaas na sua aplicação, você salve essa informação em uma tabela como mostrada acima e **responda 200 para o Asaas** para indicar o recebimento com sucesso. Lembre-se de **retornar 200 somente após a confirmação da persistência do evento** na sua tabela no banco de dados, pois não garantimos que este evento será reenviado automaticamente.

Após isso, crie uma rotina de processamento, como Cron Jobs ou Workers, para processar os eventos persistidos e não processados (status = `PENDING`), assim que finalizar o seu processamento, marque-os com o status `DONE` ou simplesmente remova o registro da tabela. Caso a ordem dos eventos seja importante para o seu sistema, lembre-se de buscar e processá-los de forma ascendente.

```javascript Node.js
const express = require('express');
const app = express();

app.post('/asaas/webhooks/payments', express.json({type: 'application/json'}), (request, response) => {
  const body = request.body;
  const eventId = body.id;
  const eventType = body.event;
  const payload = body; // Salvar o payload inteiro para verificar o "event" no processamento
  const status = "PENDING";
  
  await client
    .query("INSERT INTO asaas_events (asaas_event_id, payload, status) VALUES ($1, $2, $3)", [eventId, payload, status])
    .catch((e) => {
      // PostgreSQL code for unique violation
      if (e.code == "23505") {
        response.json({received: true});
        return;
      }
      throw e;
    });

  // Retorne uma resposta para dizer que o webhook foi recebido
  response.json({received: true});
});

app.listen(8000, () => console.log('Running on port 8000'));
```

Se o seu sistema recebe mais de centenas de milhares de eventos por dia, a indicação é utilizar uma solução de fila mais robusta, como Amazon SQS, RabbitMQ ou Kafka. 

Nesta solução, além de resolver o ponto da idempotência, a sugestão também é que o processamento dos eventos seja assíncrono, logo tendo uma resposta mais rápida para o Asaas e uma vazão maior da fila de eventos enviados.

2. #### Salvar eventos já processados

Outra estratégia comum é realizar o processamento dos Webhooks e salvar o ID de cada evento em uma tabela.

```sql
CREATE TABLE asaas_processed_webhooks (
    id bigint PRIMARY KEY,
    asaas_evt_id text UNIQUE NOT NULL,
    [...]
);
```

Dessa forma você pode sempre verificar essa tabela quando receber um novo evento e verificar se o ID já foi processado anteriormente.

```javascript Node.js
const express = require('express');
const app = express();

app.post('/asaas/webhooks/payments', express.json({type: 'application/json'}), (request, response) => {
  const body = request.body;

  const eventId = body.id;

  
  await client
    .query("INSERT INTO asaas_processed_webhooks (asaas_evt_id) VALUES $1", [eventId])
    .catch((e) => {
      // PostgreSQL code for unique violation
      if (e.code == "23505") {
        response.json({received: true});
        return;
      }
      throw e;
    });

  switch (body.event) {
    case 'PAYMENT_CREATED':
      const payment = body.payment;
      createPayment(payment);
      break;
    // ... trate outos eventos
    default:
      console.log(`Este evento não é aceito ${body.event}`);
  }

  // Retorne uma resposta para dizer que o webhook foi recebido
  response.json({received: true});
});

app.listen(8000, () => console.log('Running on port 8000'));

```

Nesta solução, a tabela é usada como um check após o processamento, esse que é feito ainda nos 10s de limite de timeout que o Asaas tem da requisição.




Digamos que um cliente entra no seu site/aplicação e realiza uma compra. O seu serviço de compras irá receber uma requisição, que irá enviar para o serviço de pagamentos, que irá chamar um gateway de pagamento do Asaas, correto?

Depois disso você tem duas formas de receber informações do Asaas:

## Fazer polling

Após ter criado uma cobrança, a sua aplicação faz várias requisições no Asaas para verificar o status do pagamento, até que o Asaas retorne que ela foi paga.

Porém esta prática tem pontos negativos. Fazer polling implica em usar recursos tanto do lado da sua aplicação como no lado do Asaas. Podendo inclusive fazer sua chave de API [ser bloqueada por quota limit](https://docs.asaas.com/reference/rate-e-quota-limit).

<Image align="center" src="https://files.readme.io/a05fdf3-Polling.png" />

## Webhooks

Basicamente é um “me avise de volta em determinada URL quando você tem atualizações nesta cobrança”. Quando o Asaas finalizar o processamento de um pagamento, você receberá em sua URL configurada o status do mesmo.

Dessa forma o paradigma mudou e o seu serviço de pagamento não precisa gastar recursos para verificar o status de uma cobrança.

<Image align="center" src="https://files.readme.io/e5d39e7-Webhook.png" />

Algumas dicas interessantes na hora de usar Webhooks:

* [Você deve desenvolver uma API do seu lado responsável por receber as requisições do Webhook;](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook)
* É interessante que você crie regras no seu endpoint por razões de segurança. O Asaas possibilita que você defina uma authToken para cada Webhook, [por exemplo](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook#mantenha-seu-webhook-seguro);
* Caso algum problema aconteça na comunicação com sua API a sua fila é interrompida e você recebe um e-mail de aviso.

Além da economia de recursos, os Webhooks são uma garantia de que sua aplicação receberá um evento sempre que algo mudar no gateway. O polling pode funcionar para verificar se uma cobrança foi paga, porém não te avisará em caso de atraso no pagamento de um boleto ou quando o pagamento de um cartão de crédito efetivamente caiu na sua conta.

A utilização de Webhooks é a forma mais prática e segura de manter sua aplicação atualizada sobre tudo que acontece no gateway do Asaas.




Navegue para as páginas específicas para visualizar os Webhooks de cada categoria.

* [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
* [Eventos para assinaturas](https://docs.asaas.com/docs/eventos-para-assinaturas)
* [Eventos para notas fiscais](https://docs.asaas.com/docs/webhook-para-notas-fiscais)
* [Eventos para transferências](https://docs.asaas.com/docs/webhook-para-transferencias)
* [Eventos para pague contas](https://docs.asaas.com/docs/webhook-para-pague-contas)
* [Eventos para antecipações](https://docs.asaas.com/docs/webhook-para-antecipacoes)
* [Eventos para recargas de celular](https://docs.asaas.com/docs/webhook-para-recargas-de-celular)
* [Eventos para verificar situação da conta](https://docs.asaas.com/docs/webhook-para-verificar-situacao-da-conta)
* [Eventos para checkout](https://docs.asaas.com/docs/eventos-para-checkout)

<br />

> 🚧 Eventos em subcontas
>
> Você pode configurar os eventos de webhook também para suas subcontas. Para saber mais sobre subcontas, acesse a  [seção sobre Subcontas](https://docs.asaas.com/docs/criacao-de-subcontas). 
>
> Os eventos do webhook sempre ficarão disponíveis na interface da conta na qual ele foi configurado.
>
> Além disso, é possível filtrar oseventos do webhook das suas subcontas através dos filtros na sua conta principal:
>
> ![](https://files.readme.io/6e2d41ccb23867c8fc0551c8b38710a996418c196abdf1992a167285e3335d85-image.png)



Os Webhooks são a melhor e mais segura forma de manter os dados da sua aplicação atualizados com os dados do Asaas. Você sempre receberá um novo evento quando o status do Webhook mudar. Os eventos que o Asaas notifica são:

* `PAYMENT_CREATED` - Geração de nova cobrança.
* `PAYMENT_AWAITING_RISK_ANALYSIS` - Pagamento em cartão aguardando aprovação pela análise manual de risco.
* `PAYMENT_APPROVED_BY_RISK_ANALYSIS` - Pagamento em cartão aprovado pela análise manual de risco.
* `PAYMENT_REPROVED_BY_RISK_ANALYSIS` - Pagamento em cartão reprovado pela análise manual de risco.
* `PAYMENT_AUTHORIZED` - Pagamento em cartão que foi autorizado e precisa ser capturado.
* `PAYMENT_UPDATED` - Alteração no vencimento ou valor de cobrança existente.
* `PAYMENT_CONFIRMED` - Cobrança confirmada (pagamento efetuado, porém, o saldo ainda não foi disponibilizado).
* `PAYMENT_RECEIVED` - Cobrança recebida.
* `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` - Falha no pagamento de cartão de crédito
* `PAYMENT_ANTICIPATED` - Cobrança antecipada.
* `PAYMENT_OVERDUE` - Cobrança vencida.
* `PAYMENT_DELETED` - Cobrança removida.
* `PAYMENT_RESTORED` - Cobrança restaurada.
* `PAYMENT_REFUNDED` - Cobrança estornada.
* `PAYMENT_PARTIALLY_REFUNDED` - Cobrança estornada parcialmente.
* `PAYMENT_REFUND_IN_PROGRESS` - Estorno em processamento (liquidação já está agendada, cobrança será estornada após executar a liquidação).
* `PAYMENT_RECEIVED_IN_CASH_UNDONE` - Recebimento em dinheiro desfeito.
* `PAYMENT_CHARGEBACK_REQUESTED` - Recebido chargeback.
* `PAYMENT_CHARGEBACK_DISPUTE` - Em disputa de chargeback (caso sejam apresentados documentos para contestação).
* `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` - Disputa vencida, aguardando repasse da adquirente.
* `PAYMENT_DUNNING_RECEIVED` - Recebimento de negativação.
* `PAYMENT_DUNNING_REQUESTED` - Requisição de negativação.
* `PAYMENT_BANK_SLIP_VIEWED` - Boleto da cobrança visualizado pelo cliente.
* `PAYMENT_CHECKOUT_VIEWED` - Fatura da cobrança visualizada pelo cliente.
* `PAYMENT_SPLIT_CANCELLED` - Cobrança teve um split cancelado.
* `PAYMENT_SPLIT_DIVERGENCE_BLOCK` - Valor da cobrança bloqueado por divergência de split.
* `PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED` - Bloqueio do valor da cobrança por divergência de split foi finalizado.

Cada vez que um Webhook de cobrança é enviado, junto dele é enviado um objeto em JSON via POST com os dados completos da cobrança. Conforme este exemplo:

```json
{
   "id": "evt_05b708f961d739ea7eba7e4db318f621&368604920",
   "event":"PAYMENT_RECEIVED",
   "dateCreated": "2024-06-12 16:45:03",
   "payment":{
      "object":"payment",
      "id":"pay_080225913252",
      "dateCreated":"2021-01-01",
      "customer":"cus_G7Dvo4iphUNk",
      "subscription":"sub_VXJBYgP2u0eO",  
         // somente quando pertencer a uma assinatura
      "installment":"2765d086-c7c5-5cca-898a-4262d212587c",
         // somente quando pertencer a um parcelamento
      "paymentLink":"123517639363",
         // identificador do link de pagamento
      "dueDate":"2021-01-01",
      "originalDueDate":"2021-01-01",
      "value":100,
      "netValue":94.51,
      "originalValue":null,
         // para quando o valor pago é diferente do valor da cobrança
      "interestValue":null,
      "nossoNumero": null,
      "description":"Pedido 056984",
      "externalReference":"056984",
      "billingType":"CREDIT_CARD",
      "status":"RECEIVED",
      "pixTransaction":null,
      "confirmedDate":"2021-01-01",
      "paymentDate":"2021-01-01",
      "clientPaymentDate":"2021-01-01",
      "installmentNumber": null,
      "creditDate":"2021-02-01",
      "custody": null,
      "estimatedCreditDate":"2021-02-01",
      "invoiceUrl":"https://www.asaas.com/i/080225913252",
      "bankSlipUrl":null,
      "transactionReceiptUrl":"https://www.asaas.com/comprovantes/4937311816045162",
      "invoiceNumber":"00005101",
      "deleted":false,
      "anticipated":false,
      "anticipable":false,
      "lastInvoiceViewedDate":"2021-01-01 12:54:56",
      "lastBankSlipViewedDate":null,
      "postalService":false,
      "creditCard":{
         "creditCardNumber":"8829",
         "creditCardBrand":"MASTERCARD",
         "creditCardToken":"a75a1d98-c52d-4a6b-a413-71e00b193c99"
      },
      "discount":{
         "value":0.00,
         "dueDateLimitDays":0,
         "limitedDate": null,
         "type":"FIXED"
      },
      "fine":{
         "value":0.00,
         "type":"FIXED"
      },
      "interest":{
         "value":0.00,
         "type":"PERCENTAGE"
      },
      "split":[
         {
            "id": "c788f2e1-0a5b-41b9-b0be-ff3641fb0cbe",
            "walletId":"48548710-9baa-4ec1-a11f-9010193527c6",
            "fixedValue":20,
            "status":"PENDING",
            "refusalReason": null,
            "externalReference": null,
            "description": null
         },
         {
            "id": "e754f2e1-09mn-88pj-l552-df38j1fbll1c",
            "walletId":"0b763922-aa88-4cbe-a567-e3fe8511fa06",
            "percentualValue":10,
            "status":"PENDING",
            "refusalReason": null,
            "externalReference": null,
            "description": null
         }
      ],
      "chargeback": {
          "status": "REQUESTED",
          "reason": "PROCESS_ERROR"
      },
      "refunds": null
   }
}
```

> 👍 Retorno do Webhook com tipagem e ENUMs
>
> Caso você queira saber qual o tipo de cada campo e os retornos de ENUMs disponíveis, confira a resposta `200` no endpoint "[Recuperar uma única cobrança](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca)" na documentação.

[Tudo no Asaas é considerado uma cobrança](https://docs.asaas.com/docs/como-o-asaas-trata-receitas-na-conta), inclusive transferências diretas para a conta bancária, depósitos ou recebimentos via Pix. Portanto você recebe Webhooks de Cobranças para qualquer dinheiro que entrar na sua conta.

> 🚧
>
> * Com a entrada de novos produtos e funções dentro do Asaas, é possível que novos atributos sejam incluídos no Webhook. É muito importante que seu código esteja preparado para não gerar exceções caso o Asaas devolva novos atributos não tratados pela sua aplicação, pois isso poderá causar interrupção na fila de sincronização.* Enviaremos um e-mail e avisaremos em nosso Discord quando novos campos forem incluídos no Webhook. O disparo será feito para o e-mail de notificação definido nas configurações do webhook.* O array de split será devolvido apenas quando a cobrança possuir configurações de [Split de Pagamento](https://docs.asaas.com/docs/split-de-pagamentos).

### Como funciona o fluxo do Webhook de cobranças?

Veja mais detalhes sobre o fluxo de webhooks em recebimentos de cobranças no Asaas:

**Cobrança recebida em Boleto, sem atraso:**\
`PAYMENT_CREATED` > `PAYMENT_CONFIRMED` > `PAYMENT_RECEIVED`

**Cobrança recebida em Boleto, com atraso:**\
`PAYMENT_CREATED` > `PAYMENT_OVERDUE` > `PAYMENT_CONFIRMED` > `PAYMENT_RECEIVED`

**Cobrança recebida em Pix, sem atraso:**\
*`PAYMENT_CREATED`->`PAYMENT_RECEIVED`*

**Cobrança recebida em Pix, com atraso:**\
*`PAYMENT_CREATED`->`PAYMENT_OVERDUE` ->`PAYMENT_RECEIVED`*

**Cobrança recebida em Cartão de Crédito, sem atraso:**\
*`PAYMENT_CREATED`->`PAYMENT_CONFIRMED` -> `PAYMENT_RECEIVED` (32 dias após `PAYMENT_CONFIRMED`)*

**Cobrança recebida em Cartão de Débito, sem atraso:**\
*`PAYMENT_CREATED`->`PAYMENT_CONFIRMED` -> `PAYMENT_RECEIVED` (3 dias após `PAYMENT_CONFIRMED`)*

**Cobrança recebida em Cartão de Crédito, com atraso:**\
*`PAYMENT_CREATED`->`PAYMENT_OVERDUE` -> `PAYMENT_CONFIRMED` -> `PAYMENT_RECEIVED` (32 dias após `PAYMENT_CONFIRMED`)*

**Cobrança recebida em Cartão de Débito, com atraso:**\
*`PAYMENT_CREATED`->`PAYMENT_OVERDUE` -> `PAYMENT_CONFIRMED` -> `PAYMENT_RECEIVED` (3 dias após `PAYMENT_CONFIRMED`)*

**Cobrança estornada durante fase de confirmação (Cartão de Crédito/Débito):**\
*`PAYMENT_CREATED`->`PAYMENT_CONFIRMED` ->`PAYMENT_REFUNDED`*

**Cobrança estornada após recebimento (Cartão de Crédito/Débito):**\
*`PAYMENT_CREATED`->`PAYMENT_CONFIRMED` -> `PAYMENT_RECEIVED` ->`PAYMENT_REFUNDED`*

**Cobrança estornada após recebimento (Boleto/Pix):**\
*`PAYMENT_CREATED`->`PAYMENT_RECEIVED` ->`PAYMENT_REFUNDED`*

**Chargeback solicitado, disputa aberta e ganha pelo cliente Asaas:**\
*`PAYMENT_CREATED`->`PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` -> `CHARGEBACK_REQUESTED` -> `CHARGEBACK_DISPUTE` -> `AWAITING_CHARGEBACK_REVERSAL` -> `PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` (depende se a cobrança já atingiu a data de crédito).*

**Chargeback solicitado, disputa aberta e ganha pelo cliente:**\
*`PAYMENT_CREATED`->`PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` -> `CHARGEBACK_REQUESTED` -> `CHARGEBACK_DISPUTE` ->`PAYMENT_REFUNDED`*

**Chargeback solicitado e disputa não aberta:**\
*`PAYMENT_CREATED`->`PAYMENT_CONFIRMED` ou `PAYMENT_RECEIVED` -> `CHARGEBACK_REQUESTED` ->`PAYMENT_REFUNDED`*

**Cobrança confirmada em dinheiro:**\
*`PAYMENT_CREATED`->`PAYMENT_RECEIVED` (o billingType será "`RECEIVED_IN_CASH`").*

**Cobrança em processo de negativação Serasa:**\
*`PAYMENT_CREATED`->`PAYMENT_OVERDUE` ->`PAYMENT_DUNNING_REQUESTED`*

**Cobrança em processo de negativação Serasa recebida:**\
*`PAYMENT_CREATED`->`PAYMENT_OVERDUE` -> `PAYMENT_DUNNING_REQUESTED` ->`PAYMENT_DUNNING_RECEIVED`*

***

É importante frisar que sempre que a cobrança sofrer atraso de vencimento, ela passará pelo status *`PAYMENT_OVERDUE`*.

Ocasionalmente, outros eventos podem ser disparados, como *`PAYMENT_DELETED`,`PAYMENT_RESTORED`,`PAYMENT_BANK_SLIP_VIEWED`* e *`PAYMENT_CHECKOUT_VIEWED`*, porém são eventos que não estão ligados com processos de recebimento de valores.




É possível utilizar webhook para que o seu sistema seja notificado sobre alterações que ocorram nas assinaturas. Os eventos que o Asaas notifica são:

* `SUBSCRIPTION_CREATED` - Geração de nova assinatura. 
* `SUBSCRIPTION_UPDATED` - Alteração na assinatura.
* `SUBSCRIPTION_INACTIVATED` - Assinatura inativada.
* `SUBSCRIPTION_DELETED` - Assinatura removida.
* `SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK` - Assinatura bloqueada por divergência de split.
* `SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED` - Bloqueio da assinatura por divergência de split foi finalizado.

<br />

### Exemplo de JSON a ser recebido [POST]

A notificação consiste em um POST contendo um JSON, conforme este exemplo::

```json
{
  "id": "evt_6561b631fa5580caadd00bbe3b858607&9193",
  "event": "SUBSCRIPTION_CREATED",
  "dateCreated": "2024-10-16 11:11:04",
  "subscription": {
    "object": "subscription",
    "id": "sub_m5gdy1upm25fbwgx",
    "dateCreated": "16/10/2024",
    "customer": "cus_000000008773",
    "paymentLink": null,
    "value": 19.9,
    "nextDueDate": "22/11/2024",
    "cycle": "MONTHLY",
    "description": "Assinatura Plano Pró",
    "billingType": "BOLETO",
    "deleted": false,
    "status": "ACTIVE",
    "externalReference": null,
    "sendPaymentByPostalService": false,
    "discount": {
      "value": 10,
      "limitDate": null,
      "dueDateLimitDays": 0,
      "type": "PERCENTAGE"
    },
    "fine": {
      "value": 1,
      "type": "PERCENTAGE"
    },
    "interest": {
      "value": 2,
      "type": "PERCENTAGE"
    },
    "split": [
      {
        "walletId": "a0188304-4860-4d97-9178-4da0cde5fdc1",
        "fixedValue": null,
        "percentualValue": 20,
        "externalReference": null,
        "description": null
      }
    ]
  }
}
```

> 👍 Retorno do Webhook com tipagem e ENUMs
>
> Caso você queira saber qual o tipo de cada campo e os retornos de ENUMs disponíveis, confira a resposta 200 no endpoint "[Recuperar uma única assinatura](https://docs.asaas.com/reference/recuperar-uma-unica-assinatura)" na documentação.

> 🚧
>
> * Com a entrada de novos produtos e funções dentro do Asaas, é possível que novos atributos sejam incluídos no Webhook. É muito importante que seu código esteja preparado para não gerar exceções caso o Asaas devolva novos atributos não tratados pela sua aplicação, pois isso poderá causar interrupção na fila de sincronização.* Enviaremos um e-mail e avisaremos em nosso Discord quando novos campos forem incluídos no Webhook. O disparo será feito para o e-mail de notificação definido nas configurações do webhook* O array de split será devolvido apenas quando a assinatura possuir configurações de [Split de Pagamento](https://docs.asaas.com/docs/split-de-pagamentos).




É possível utilizar webhook para que seu sistema seja notificado sobre alterações que ocorram nas notas fiscais. Os eventos que o Asaas notifica são:

* `INVOICE_CREATED` - Geração de nova nota fiscal.
* `INVOICE_UPDATED` - Alteração na nota fiscal.
* `INVOICE_SYNCHRONIZED` - Nota fiscal enviada para prefeitura.
* `INVOICE_AUTHORIZED` - Nota fiscal emitida.
* `INVOICE_PROCESSING_CANCELLATION` - Nota fiscal processando cancelamento.
* `INVOICE_CANCELED` - Nota fiscal cancelada.
* `INVOICE_CANCELLATION_DENIED` - Recusado o cancelamento da nota fiscal.
* `INVOICE_ERROR` - Nota fiscal com erro.

#### Exemplo de JSON a ser recebido [POST]

A notificação consiste em um POST contendo um JSON, conforme este exemplo:

```json
{
    "id": "evt_05b708f961d739ea7eba7e4db318f621&368604920",
    "event": "INVOICE_CREATED",
    "dateCreated": "2024-06-12 16:45:03",
    "invoice": {
        "object": "invoice",
        "id": "inv_000000000232",
        "status": "SCHEDULED",
        "customer": "cus_000000002750",
        "type": "NFS-e",
        "statusDescription": null,
        "serviceDescription": "Nota fiscal da Fatura 101940. \nDescrição dos Serviços: ANÁLISE E DESENVOLVIMENTO DE SISTEMAS",
        "pdfUrl": null,
        "xmlUrl": null,
        "rpsSerie": null,
        "rpsNumber": null,
        "number": null,
        "validationCode": null,
        "value": 300,
        "deductions": 0,
        "effectiveDate": "2018-07-03",
        "observations": "Mensal referente aos trabalhos de Junho.",
        "estimatedTaxesDescription": "",
        "payment": "pay_145059895800",
        "installment": null,
        "taxes": {
            "retainIss": false,
            "iss": 3,
            "cofins": 3,
            "csll": 1,
            "inss": 0,
            "ir": 1.5,
            "pis": 0.65
        },
        "municipalServiceCode": "1.01",
        "municipalServiceName": "Análise e desenvolvimento de sistemas"
    }
}
```

> 👍 Retorno do Webhook com tipagem e ENUMs
>
> Caso você queira saber qual o tipo de cada campo e os retornos de ENUMs disponíveis, confira a resposta `200` no endpoint "[Recuperar uma nota fiscal](https://docs.asaas.com/reference/recuperar-uma-nota-fiscal)" na documentação.

> 🚧 * Com a entrada de novos produtos e funções dentro do Asaas, é possível que novos atributos sejam incluídos no Webhook. É muito importante que seu código esteja preparado para não gerar exceções caso o Asaas devolva novos atributos não tratados pela sua aplicação, pois isso poderá causar interrupção na fila de sincronização.
>
> * Enviaremos um e-mail e avisaremos em nosso Discord quando novos campos forem incluídos no Webhook. O disparo será feito para o e-mail de notificação definido nas configurações do webhook




É possível utilizar webhook para que seu sistema seja notificado sobre alterações que ocorram nas transferências bancárias e transferências entre contas Asaas. Os eventos que o Asaas notifica são:

* `TRANSFER_CREATED` - Geração de nova transferência.
* `TRANSFER_PENDING` - Transferência pendente de execução.
* `TRANSFER_IN_BANK_PROCESSING` - Transferência em processamento bancário.
* `TRANSFER_BLOCKED` - Transferência bloqueada.
* `TRANSFER_DONE` - Transferência realizada.
* `TRANSFER_FAILED` - Transferência falhou.
* `TRANSFER_CANCELLED` - Transferência cancelada.

> 👍 Retorno do Webhook com tipagem e ENUMs
>
> Caso você queira saber qual o tipo de cada campo e os retornos de ENUMs disponíveis, confira a resposta `200` no endpoint "[Recuperar uma única transferência](https://docs.asaas.com/reference/recuperar-uma-unica-transferencia)" na documentação.

### Exemplo de JSON a ser recebido para transferências bancárias [POST]

A notificação consiste em um POST contendo um JSON, conforme este exemplo:

```json
{
    "id": "evt_05b708f961d739ea7eba7e4db318f621&368604920",
    "event": "TRANSFER_CREATED",
    "dateCreated": "2024-06-12 16:45:03",
    "transfer": {
        "object": "transfer",
        "id": "777eb7c8-b1a2-4356-8fd8-a1b0644b5282",
        "dateCreated": "2019-05-02",
        "status": "PENDING",
        "effectiveDate": null,
        "endToEndIdentifier": null,
        "type": "BANK_ACCOUNT",
        "value": 1000,
        "netValue": 1000,
        "transferFee": 0,
        "scheduleDate": "2019-05-02",
        "authorized": true,
        "failReason": null,
        "transactionReceiptUrl": null,
        "bankAccount": {
            "bank": {
                "ispb": "00000000",
                "code": "001",
                "name": "Banco do Brasil"
            },
            "accountName": "Conta Banco do Brasil",
            "ownerName": "Marcelo Almeida",
            "cpfCnpj": "***.143.689-**",
            "agency": "1263",
            "agencyDigit": "1",
            "account": "26544",
            "accountDigit": "1",
            "pixAddressKey": null
        },
        "operationType": "TED",
        "description": null
    }
}
```

### Exemplo de JSON a ser recebido para transferências bancárias via Pix

A notificação consiste em um POST contendo um JSON, conforme este exemplo:

```json
{
    "event": "TRANSFER_CREATED",
    "transfer": {
        "object": "transfer",
        "id": "777eb7c8-b1a2-4356-8fd8-a1b0644b5282",
        "dateCreated": "2019-05-02",
        "status": "PENDING",
        "effectiveDate": null,
        "endToEndIdentifier": null,
        "type": "BANK_ACCOUNT",
        "value": 1000,
        "netValue": 1000,
        "transferFee": 0,
        "scheduleDate": "2019-05-02",
        "authorized": true,
        "failReason": null,
        "transactionReceiptUrl": null,
        "bankAccount": {
            "bank": {
                "ispb": "00000000",
                "code": "001",
                "name": "Banco do Brasil"
            },
            "accountName": "Conta Banco do Brasil",
            "ownerName": "Marcelo Almeida",
            "cpfCnpj": "***.143.689-**",
            "agency": "1263",
            "agencyDigit": "1",
            "account": "26544",
            "accountDigit": "1",
            "pixAddressKey": null
        },
        "operationType": "PIX",
        "description": "Transferência efetuada via Pix manual"
    }
}
```

### Exemplo de JSON a ser recebido para transferências bancárias via Pix com chave

A notificação consiste em um POST contendo um JSON, conforme este exemplo:

```json
{
    "event": "TRANSFER_CREATED",
    "transfer": {
        "object": "transfer",
        "id": "777eb7c8-b1a2-4356-8fd8-a1b0644b5282",
        "dateCreated": "2019-05-02",
        "status": "PENDING",
        "effectiveDate": null,
        "endToEndIdentifier": null,
        "type": "BANK_ACCOUNT",
        "value": 1000,
        "netValue": 1000,
        "transferFee": 0,
        "scheduleDate": "2019-05-02",
        "authorized": true,
        "failReason": null,
        "transactionReceiptUrl": null,
        "bankAccount": {
            "bank": {
                "ispb": "00000000",
                "code": "001",
                "name": "Banco do Brasil"
            },
            "accountName": "Conta Banco do Brasil",
            "ownerName": "Marcelo Almeida",
            "cpfCnpj": "***.143.689-**",
            "agency": "1263",
            "agencyDigit": "1",
            "account": "26544",
            "accountDigit": "1",
            "pixAddressKey": "09413412375",
        },
        "operationType": "PIX",
        "description": "Transferência efetuada via Pix com chave"
    }
}
```

### Exemplo de JSON a ser recebido para transferências entre contas Asaas [POST]

A notificação consiste em um POST contendo um JSON, conforme este exemplo:

```json
{
    "event": "TRANSFER_CREATED",
    "transfer": {
        "object": "transfer",
        "id": "dc0cd262-5050-4c82-bddc-dc2463f7ff07",
        "dateCreated": "2021-01-01",
        "status": "DONE",
        "effectiveDate": "2021-01-01 13:32:12",
        "endToEndIdentifier": null,
        "type": "ASAAS_ACCOUNT",
        "value": 1000,
        "transferFee": 0,
        "scheduleDate": "2021-11-17",
        "authorized": true,
        "walletId": "1f7184ab-9671-4f43-9ab5-c2349e7bf61",
        "account": {
            "name": "Marcelo Almeida",
            "cpfCnpj": "***.143.689-**"
        },
        "transactionReceiptUrl": "https://www.asaas.com/comprovantes/8962440029817277",
        "operationType": "INTERNAL",
        "description": null
    }
}
```

> 🚧 Atenção
>
> * Transferências entre contas Asaas são realizadas instantaneamente. Caso a validação de evento crítico via Token APP ou Token SMS esteja habilitada para o agendamento de transferências, a transferência ficará pendente até que a validação seja realizada.
> * Transferências via Pix não agendadas são realizadas instantaneamente. O Token APP e Token SMS devem estar desabilitados.

> 🚧
>
> * Com a entrada de novos produtos e funções dentro do Asaas, é possível que novos atributos sejam incluídos no Webhook. É muito importante que seu código esteja preparado para não gerar exceções caso o Asaas devolva novos atributos não tratados pela sua aplicação, pois isso poderá causar interrupção na fila de sincronização.* Enviaremos um e-mail e avisaremos em nosso Discord quando novos campos forem incluídos no Webhook. O disparo será feito para o e-mail de notificação definido nas configurações do webhook.



É possível utilizar webhook para que seu sistema seja notificado sobre alterações que ocorram nas antecipações. Os eventos que o Asaas notifica são:

* `RECEIVABLE_ANTICIPATION_CANCELLED` - Antecipação cancelada.
* `RECEIVABLE_ANTICIPATION_SCHEDULED` - Antecipação agendada.
* `RECEIVABLE_ANTICIPATION_PENDING` - Antecipação em análise.
* `RECEIVABLE_ANTICIPATION_CREDITED` - Antecipação creditada.
* `RECEIVABLE_ANTICIPATION_DEBITED` - Antecipação debitada.
* `RECEIVABLE_ANTICIPATION_DENIED` - Solicitação da antecipação negada.
* `RECEIVABLE_ANTICIPATION_OVERDUE` - Antecipação vencida.

### Exemplo de JSON a ser recebido [POST]

A notificação consiste em um POST contendo um JSON, conforme este exemplo:

```json
{
  "id": "evt_05b708f961d739ea7eba7e4db318f621&368604920",
  "event": "RECEIVABLE_ANTICIPATION_CREDITED",
  "dateCreated": "2024-06-12 16:45:03",
  "anticipation": {
    "object": "anticipation",
    "id": "29ad50e9-64ee-427e-a00c-a3999510ca0a",
    "installment": null,
    "payment": "pay_4310966350068380",
    "status": "CREDITED",
    "anticipationDate": "2022-09-19",
    "dueDate": "2022-09-30",
    "requestDate": "2022-09-19",
    "fee": 5.64,
    "anticipationDays": 11,
    "netValue": 302.37,
    "totalValue": 310,
    "value": 308.01,
    "denialObservation": null
  }
}
```

> 👍 Retorno do Webhook com tipagem e ENUMs
>
> Caso você queira saber qual o tipo de cada campo e os retornos de ENUMs disponíveis, confira a resposta `200` no endpoint "[Recuperar uma única antecipação](https://docs.asaas.com/reference/recuperar-uma-unica-antecipacao)" na documentação.

> 🚧
>
> * Com a entrada de novos produtos e funções dentro do Asaas, é possível que novos atributos sejam incluídos no Webhook. É muito importante que seu código esteja preparado para não gerar exceções caso o Asaas devolva novos atributos não tratados pela sua aplicação, pois isso poderá causar interrupção na fila de sincronização.* Enviaremos um e-mail e avisaremos em nosso Discord quando novos campos forem incluídos no Webhook. O disparo será feito para o e-mail de notificação definido nas configurações do webhook.




É possível utilizar webhook para que seu sistema seja notificado sobre alterações que ocorram nas recargas de celular. Os eventos que o Asaas notifica são:

* `MOBILE_PHONE_RECHARGE_PENDING` - Recarga de celular pendente.
* `MOBILE_PHONE_RECHARGE_CANCELLED` - Recarga de celular cancelada.
* `MOBILE_PHONE_RECHARGE_CONFIRMED` - Recarga de celular confirmada.
* `MOBILE_PHONE_RECHARGE_REFUNDED`- Recarga de celular estornada.

### Exemplo de JSON a ser recebido [POST]

A notificação consiste em um POST contendo um JSON, conforme este exemplo:

```json
{
   "id": "evt_05b708f961d739ea7eba7e4db318f621&368604920",
   "event":"PHONE_RECHARGE_CONFIRMED",
   "dateCreated": "2024-06-12 16:45:03",
   "mobilePhoneRecharge":{
      "id": "29ad50e9-64ee-427e-a00c-a3999510ca0a",
      "value":15,
      "phoneNumber":"62982055478",
      "status":"CONFIRMED",
      "canBeCancelled":false,
      "operatorName":"Tim"
   }
}
```

> 👍 Retorno do Webhook com tipagem e ENUMs
>
> Caso você queira saber qual o tipo de cada campo e os retornos de ENUMs disponíveis, confira a resposta `200` no endpoint "[Recuperar uma única recarga de celular](https://docs.asaas.com/reference/recuperar-uma-unica-recarga-de-celular)" na documentação.

> 🚧
>
> * Com a entrada de novos produtos e funções dentro do Asaas, é possível que novos atributos sejam incluídos no Webhook. É muito importante que seu código esteja preparado para não gerar exceções caso o Asaas devolva novos atributos não tratados pela sua aplicação, pois isso poderá causar interrupção na fila de sincronização.* Enviaremos um e-mail e avisaremos em nosso Discord quando novos campos forem incluídos no Webhook. O disparo será feito para o e-mail de notificação definido nas configurações do webhook.




É possível utilizar webhook para que seu sistema seja notificado sobre alterações que ocorram\
na situação de contas. Os eventos que o Asaas notifica são:

* `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED` - Conta bancária aprovada
* `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL` - Conta bancária está em análise
* `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING` - Conta bancária voltou para pendente
* `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED` - Conta bancária reprovada
* `ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED` - Informações comerciais aprovada
* `ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL` - Informações comerciais em análise
* `ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING` - Informações comerciais voltou para pendente
* `ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED` - Informações comerciais reprovada
* `ACCOUNT_STATUS_DOCUMENT_APPROVED` - Documentos aprovados
* `ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL` - Documentos em análise
* `ACCOUNT_STATUS_DOCUMENT_PENDING` - Documentos voltaram para pendente
* `ACCOUNT_STATUS_DOCUMENT_REJECTED` - Documentos reprovados
* `ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED` - Conta aprovada
* `ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL` - Conta em análise
* `ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING` - Conta voltou para pendente
* `ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED` - Conta reprovada

### Exemplo de JSON a ser recebido [POST]

A notificação consiste em um POST contendo um JSON, conforme este exemplo:

```json
{
    "id": "evt_05b708f961d739ea7eba7e4db318f621&368604920",
    "event": "ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED",
    "dateCreated": "2024-06-12 16:45:03",
    "accountStatus": {
        "id": "175027c1-029c-41e5-8b9a-e289b9788c33",
        "commercialInfo": "APPROVED",
        "bankAccountInfo": "APPROVED",
        "documentation": "APPROVED",
        "general": "APPROVED"
    }
}
```

> 👍 Retorno do Webhook com tipagem e ENUMs
>
> Caso você queira saber qual o tipo de cada campo e os retornos de ENUMs disponíveis, confira a resposta `200` no endpoint "[Consultar situação cadastral da conta](https://docs.asaas.com/reference/consultar-situacao-cadastral-da-conta)" na documentação.

> 🚧
>
> * Com a entrada de novos produtos e funções dentro do Asaas, é possível que novos atributos sejam incluídos no Webhook. É muito importante que seu código esteja preparado para não gerar exceções caso o Asaas devolva novos atributos não tratados pela sua aplicação, pois isso poderá causar interrupção na fila de sincronização.* Enviaremos um e-mail e avisaremos em nosso Discord quando novos campos forem incluídos no Webhook. O disparo será feito para o e-mail de notificação definido nas configurações do webhook.




Os Webhooks são a melhor e mais segura forma de manter os dados da sua aplicação atualizados com os dados do Asaas. Você sempre receberá um novo evento quando o status do Webhook mudar. 

**Como utilizar os webhooks do checkout:**

`POST https://api.asaas.com/api/v3/webhooks`\
`header: access_token`

```json
{  
"name": "teste",  
"url":"<https://minha-url.com">,  
"sendType":"SEQUENTIALLY",  
"email":"[teste@teste.com](mailto:teste@teste.com)",  
"enabled":true,  
"interrupted":false,  
"events":[  
"CHECKOUT_CREATED",  
"CHECKOUT_CANCELED",  
"CHECKOUT_EXPIRED",  
"CHECKOUT_PAID"  
]  
}
```

O endpoint de webhook do checkout é o mesmo utilizado para criação de webhook do asaas e podemos encontrar mais informações na[ documentação padrão da API](https://docs.asaas.com/docs/sobre-os-webhooks).

A única mudança são os eventos do checkout, no body params da requisição deve ser adicionado os eventos que desejamos acompanhar:

* `CHECKOUT_CREATED` - Checkout criado
* `CHECKOUT_CANCELED` -  Checkout cancelado
* `CHECKOUT_EXPIRED` - Checkout expirado
* `CHECKOUT_PAID` - Checkout pago

<br />

Feito a configuração acima, o webhook do checkout passará a enviar requisições para a url configurada. Segue exemplo da requisição POST que será feita pelo webhook para a sua URL cadastrada:

```json
{  
  "id": "evt_37260be8159d4472b4458d3de13efc2d&15370",  
  "event": "CHECKOUT_CREATED",  
  "dateCreated": "2024-10-31 18:07:47",  
  "checkout": {  
    "id": "2bd251f0-09b2-44ff-8a0c-a5cb29e5bbda",  
    "link": null,  
    "status": "ACTIVE",  
    "minutesToExpire": 10,  
    "billingTypes": [  
      "MUNDIPAGG_CIELO"  
    ],  
    "chargeTypes": [  
      "RECURRENT"  
    ],  
    "callback": {  
      "cancelUrl": "<https://google.com">,  
      "successUrl": "<https://google.com">,  
      "expiredUrl": "<https://google.com">  
    },  
    "items": [  
      {  
        "name": "teste2",  
        "description": "teste",  
        "quantity": 2,  
        "value": 100  
      },  
      {  
        "name": "teste2",  
        "description": "teste2",  
        "quantity": 2,  
        "value": 100  
      }  
    ],  
    "subscription": {  
      "cycle": "MONTHLY",  
      "nextDueDate": "2024-10-31T03:00:00+0000",  
      "endDate": "2025-10-29T03:00:00+0000"  
    },  
    "installment": null,  
    "split": [  
      {  
        "walletId": "c1ad713f-77fc-45b0-b734-b2ff9970d6d8",  
        "fixedValue": 2,  
        "percentualValue": null,  
        "totalFixedValue": null  
      },  
      {  
        "walletId": "c1ad713f-77fc-45b0-b734-b2ff9970d6d8",  
        "fixedValue": null,  
        "percentualValue": 2,  
        "totalFixedValue": null  
      }  
    ],  
    "customer": "cus_000000018936",  
    "customerData": null  
  }  
}
``` 



O **Asaas** interrompe automaticamente a fila de webhooks após **15 falhas consecutivas** no recebimento das requisições enviadas. Para reativá-la, é necessário** identificar a causa do erro** e realizar a devida correção no servidor, conforme os passos abaixo:

1. **Verifique os logs de webhook** para identificar o erro que está ocorrendo. Consulte nosso guia para visualizar os logs: [Como visualizar os logs de webhook](https://docs.asaas.com/docs/logs-de-webhooks)
2. **Corrija o erro no seu servidor** conforme as orientações disponíveis em nossa página: [Como tratar erros e reativar a fila.](https://docs.asaas.com/docs/fila-pausada)

> 🚧 **Importante**
>
> A reativação da fila **só deve ser feita após a correção do problema**, garantindo que o servidor esteja pronto para receber os webhooks corretamente.

Após a correção, acesse **Menu do usuário > Integrações > Webhooks** e reative o webhook com as seguintes configurações via painel:

<Image border={false} src="https://files.readme.io/b53eb7acd8f2517810bd92485c64fb18c1b9e575862ec29f03c57001fe4e9969-image.png" />

<br />

Caso prefira reativar via API, utilize a chamada de atualização de webhook existente, enviando o parâmetro "interrupted" como false.

> ❗️ **Importante**
>
> Se você está criando um novo webhook e ele já aparece como interrompido, verifique se a fila de sincronização está ativa.




Os Webhooks possuem dois tipos de envio disponíveis: sequencial e não sequencial.

## Qual a diferença entre os tipos de envio?

No envio **Sequencial** os eventos são enviados na ordem em que ocorreram. Já no envio **Não sequencial**, os eventos são enviados sem ordem e fluirão melhor, sendo que não é preciso esperar um envio terminar para começar outro.

## Envio Sequencial

Um exemplo comum de envio sequencial é quando você quer que os eventos cheguem na mesma ordem em que o seu cliente realizou as ações.

<Image align="center" src="https://files.readme.io/7e8a469-Webhook_-_Sequencial.png" />

No exemplo acima podemos ver que os eventos de um mesmo pagamento são enviados na sequência de que aconteceram. Dessa forma sabemos que o pagamento da cobrança foi realizado após o vencimento.

## Envio Não sequencial

Quando você tem um ou poucos eventos selecionados para um Webhook você pode optar pelo envio Não Sequencial. Por exemplo um Webhook para verificar sucesso em transferências, caso você configure apenas os eventos para confirmar se uma transferência foi confirmada ou cancelada, você só receberá um evento por entidade e não precisa se preocupar com a sequencia em qual os eventos serão enviados.

<Image align="center" src="https://files.readme.io/2f77408-Webhook_-_No_Sequencial.png" />

No envio Não sequencial os eventos são enviados mais rapidamente, sem aguardar que os outros concluam e podem vir de várias entidades diferentes.




> ❗️
>
> O Asaas guarda eventos de Webhooks por 14 dias. Você receberá um e-mail caso haja algum problema de comunicação.
>
> Caso sua fila seja pausada, é de extrema importância que você resolva qualquer problema para evitar perder informações importantes.
>
> :warning: **Os eventos que estiverem mais de 14 dias parados na fila serão excluídos permanentemente.**

É possível visualizar os Webhooks enviados e quais erros aconteceram, com detalhes na página de [Logs de Webhooks](https://www.asaas.com/customerConfigIntegrations/webhookLogs) na área de Integrações. Você também pode [checar e configurar Webhooks via API](https://docs.asaas.com/reference/listar-webhooks), só não é possível visualizar os logs neste caso.

<Image alt="Logs de Webhooks para você verificar erros que aconteceram de comunicação." align="center" src="https://files.readme.io/0701702-image_6.png">
  Logs de Webhooks para você verificar erros que aconteceram de comunicação.
</Image>

### Visualização de logs de Webhooks de subcontas

Os logs de requisições e de Webhooks das subcontas estão disponíveis para a conta principal consultar via interface. No menu Integrações, nas abas de **Logs de Requisições** e **Logs de Webhooks**, utilize o filtro: “**Tipo de Conta**” e quando você seleciona “subcontas”,  um novo campo aparece para buscar pelo identificador da subconta. O campo Identificador da subconta é descritivo e só pode ser buscado uma subconta por vez.

![](https://files.readme.io/c3449ba-image.png)




O Asaas utiliza respostas HTTP convencionais para indicar sucesso ou falha nas requisições. 

Ao ativar o Webhook, sempre que houver alterações nos recursos integrados, será feito uma requisição `POST` para o endereço configurado, contendo o evento e o recurso envolvido. Para que o Asaas considere a notificação como processada com sucesso, o status HTTP da resposta da aplicação do cliente deve ser `200`.

> 📘
>
> Qualquer outro retorno que o Asaas receber (seja `308`, `404`, `403`, `500`, etc) é considerada uma falha de comunicação.

Quando houver algum problema no envio de Webhooks, você receberá um e-mail do Asaas no e-mail cadastrado informando o problema. Após isso, o Asaas continuará tentando enviar o mesmo evento. **Caso o erro aconteça por 15 vezes seguidas, a fila da envios é pausada e você para de receber novos eventos até que reative a fila no painel.**

<Image alt="Webhook de cobranças com fila de sincronização interrompida." align="center" src="https://files.readme.io/f30d604-image_12.png">
  Webhook de cobranças com fila de sincronização interrompida.
</Image>

Com a fila interrompida, novos eventos continuam sendo gerados e salvos pelo Asaas, porém não são mais enviados para sua aplicação até que você reative ela. Quando reativada, todos os eventos acumulados serão enviados em sequência.

***

Veja mais: [**Como visualizar logs de Webhooks**](https://docs.asaas.com/docs/logs-de-webhooks)

***

## Códigos HTTP e o Comportamento dos Webhooks no Asaas

### **2xx – Sucesso**

Indica que o Webhook foi entregue corretamente e o endpoint do cliente respondeu com sucesso.

**Resultado:** evento considerado entregue. Nenhuma ação é necessária.

Entretanto, no **Asaas** consideramos como sucesso somente o HTTP 200. **Certifique-se de retornar 200 nos webhooks.**

***

### **3xx – Redirecionamento**

Significa que o endpoint está tentando redirecionar a requisição para outra URL.\
O Asaas **não segue redirecionamentos automaticamente**, o que pode gerar falha de entrega.

**Resultado:** evento vai para a **fila pausada**. É necessário corrigir a URL do Webhook.

***

### **4xx – Erros do Cliente**

Essa faixa representa erros causados por problemas no **próprio endpoint do webhook do cliente**, como URL incorreta, falta de autenticação ou rejeição do conteúdo.

**Resultado:** evento entra na **fila pausada** e não será reprocessado automaticamente. O cliente precisa corrigir a falha.

***

### **5xx – Erros do Servidor**

Indica que o servidor do cliente **recebeu a requisição**, mas **não conseguiu processá-la** por falhas internas ou instabilidades.

**Resultado:** se o erro for pontual, pode haver reenvio. Se persistir, o evento vai para a **fila pausada**. O cliente deve estabilizar o sistema.

Se você encontrar alguma mensagem de erro ou código HTTP de resposta nos logs e ficar em dúvida sobre como resolver, você pode consultar os guias abaixo:

* [Erro 400 (Bad Request)](https://docs.asaas.com/docs/erro-400-bad-request)
* [Erro 404 (Not Found)](https://docs.asaas.com/docs/erro-404-not-found)
* [Erro 403 (Forbidden)](https://docs.asaas.com/docs/erro-403-forbidden)
* [Erro 408 - Read Timed Out](https://docs.asaas.com/docs/erro-read-timed-out)
* [Erro 500 (Internal Server Error)](https://docs.asaas.com/docs/erro-500-internal-server-error)
* [Erro Connect Timed Out](https://docs.asaas.com/docs/erro-connect-timed-out)
* [Outros erros](https://docs.asaas.com/docs/outros-erros)



O erro 400 geralmente significa que nós enviamos a solicitação, mas o sistema não conseguiu recebê-la por uma diferença na formatação esperada, como um atributo não-tratado, ou um retorno esperado que não é enviado por nós. 

É importante verificar em **nossas abas de webhook no menu lateral da documentação** o modelo de payload enviado por nós, e se certificar de que seu sistema esteja tratando todos os eventos e que não esteja esperando atributos não-existentes.




Esse tipo de retorno geralmente acontece quando o seu Firewall está bloqueando as conexões do Asaas para disparo das informações.

Nesse caso, precisa verificar as configurações do seu Firewall, seguindo essas orientações:

#### Possíveis ajustes no seu firewall:

Recomendamos certificar-se que o seu firewall não irá bloquear as requisições vindas do Asaas. Uma das maneiras de garantir isso é liberar todo o tráfego vindo dos [IPs oficiais do Asaas](https://docs.asaas.com/docs/ips-oficiais-do-asaas).

Obs.: em sandbox podem haver outros IPs que necessitem de liberação.

O Asaas envia a requisição de webhook com o *header*: `{ User-Agent: Java/1.8.0_282 }`. Certifique-se que seu provedor de firewall não bloqueia requisições com este *header*.

* Caso sua solução de Firewall seja Cloudflare, existem configurações adicionais a serem feitas, [que podem ser verificadas aqui](https://docs.asaas.com/docs/bloqueio-do-firewall-na-cloudflare).

Após verificar e se certificar de liberar esses pontos, você pode novamente reativar a sua fila para checar se os eventos serão sincronizados.




O erro 404 indica que o disparo do evento foi feito, mas a URL informada não nos encaminhou para um local existente. Isso pode indicar algum erro de digitação na URL, ou que o servidor está inativo ou foi mudado de local. 

Certifique-se que não haja nenhum erro de digitação na sua URL, e também verifique se o local para onde estamos fazendo o disparo não está indisponível ou que a URL do servidor não foi alterada. Após isso, basta reconfigurar a URL no Asaas e reativar a fila.





A conexão com o seu servidor foi estabelecida e o evento foi disparado, porém, sua aplicação não retornou a resposta no tempo esperado.

No Asaas aguardamos a resposta por 10 segundos, caso não seja recebido o retorno nesse tempo, o webhook é disparado com o erro “Read Time Out”. A sincronização é feita a cada 30 segundos, e caso seu sistema falhe em responder uma respostas de sucesso **15 vezes consecutivas**, a fila de sincronização **será interrompida**.

Você precisará verificar em seu sistema, o tempo que está levando para nos retornar o webhook e caso esteja acima dos 10 segundos, fazer o ajuste necessário.

Após certificar-se que seu sistema responderá corretamente uma resposta da família 200 para o Asaas basta reativar fila de sincronia acessando a área Minha Conta, aba Integração, todos os eventos pendentes serão processados em ordem cronológica.




O erro de webhook 500, significa que a conexão com o seu servidor foi estabelecida, porém, **a sua aplicação retornou erro**. Isso ocorre geralmente devido a alguma exceção ocorrida no seu código/tecnologia.

Pode indicar uma adversidade no servidor. Isso pode ser devido a alguma incompatibilidade ou até mesmo configurações incorretas no servidor, como scripts errados, etc.

O erro 500, é um código muito abrangente. Mas, em geral, significa erros no servidor web, onde este não consegue finalizar a solicitação do usuário. E o servidor não consegue identificar o motivo disso.




O erro Connect timed out significa que a conexão não foi estabelecida após atingir o tempo limite.

Geralmente esse erro é quando há algo errado com sua conexão de rede local. No entanto, nem sempre é esse o caso.

Pode significar também que o **seu site está tentando fazer mais do que seu servidor pode gerenciar**. Isso é particularmente comum em hospedagem compartilhada, em que seu limite de memória é restrito.

Você precisará verificar em seu sistema, o que pode estar ocasionando esse erro e realizar a correção para que mesmo volte a funcionar normalmente e após isso, reativar a fila de sincronização de webhooks.




Alguns códigos de erro menos frequentes também podem aparecer nos logs de Webhook. Abaixo estão os principais:

***

### **301**

A URL configurada no Webhook foi **movida permanentemente** para outro endereço.

O Asaas **não segue redirecionamentos automaticamente**, então é necessário atualizar o Webhook com a nova URL correta.

***

### **307**

A URL do Webhook foi **temporariamente redirecionada**, mantendo o mesmo método (POST).

O Asaas **não acompanha esse redirecionamento**. É importante corrigir o endpoint e evitar esse tipo de resposta.

***

### **405**

O servidor rejeitou a requisição porque **não aceita o método POST**, que é o método utilizado pelo Asaas para envio de Webhooks.

Verifique se o endpoint está corretamente configurado para aceitar POST.

***

### **415**

O servidor não aceita o tipo de conteúdo enviado.

Os Webhooks do Asaas utilizam `Content-Type: application/json`. O endpoint precisa estar preparado para esse formato.

***

### **429 – Too Many Requests**

O endpoint do cliente recebeu muitas requisições em um curto período de tempo e respondeu com limite excedido.

Verifique se há mecanismos de rate limit configurados e, se necessário, ajuste a infraestrutura para suportar picos.

***

### **502 – Bad Gateway**

O servidor intermediário (como um proxy ou API Gateway) retornou erro ao tentar acessar o servidor final.

Pode ser instabilidade, falha de rede ou configuração incorreta no servidor do cliente.

***

### **503 – Service Unavailable**

O servidor do cliente **estava indisponível** no momento do envio do Webhook.

Pode indicar manutenção, falha temporária ou sobrecarga. O cliente deve revisar a estabilidade da aplicação.

***

### **504 – Gateway Timeout**

A requisição foi encaminhada, mas **o servidor não respondeu dentro do tempo limite**.

Pode ser causado por lentidão, travamentos ou falhas no servidor do cliente.

***

# Outros Códigos

Outros códigos menos comuns também podem aparecer, como:

* **406** – o servidor não consegue responder no formato exigido.
* **409** – conflito na lógica do endpoint ao tentar processar o evento.
* **412** – alguma condição prévia definida pelo servidor não foi atendida.

***

# Encontrou um erro diferente?

Caso você encontre um erro HTTP que não esteja listado aqui, não se preocupe. Todos os códigos de erro seguem a lógica explicada na nossa documentação principal sobre fila pausada.

Veja mais em:\
[Códigos HTTP e o comportamento dos Webhooks no Asaas](https://docs.asaas.com/docs/fila-pausada#c%C3%B3digos-http-e-o-comportamento-dos-webhooks-no-asaas)

Em caso de dúvidas, entre em contato com nosso time de suporte técnico para avaliação.




Alguns códigos de erro menos frequentes também podem aparecer nos logs de Webhook. Abaixo estão os principais:

***

### **301**

A URL configurada no Webhook foi **movida permanentemente** para outro endereço.

O Asaas **não segue redirecionamentos automaticamente**, então é necessário atualizar o Webhook com a nova URL correta.

***

### **307**

A URL do Webhook foi **temporariamente redirecionada**, mantendo o mesmo método (POST).

O Asaas **não acompanha esse redirecionamento**. É importante corrigir o endpoint e evitar esse tipo de resposta.

***

### **405**

O servidor rejeitou a requisição porque **não aceita o método POST**, que é o método utilizado pelo Asaas para envio de Webhooks.

Verifique se o endpoint está corretamente configurado para aceitar POST.

***

### **415**

O servidor não aceita o tipo de conteúdo enviado.

Os Webhooks do Asaas utilizam `Content-Type: application/json`. O endpoint precisa estar preparado para esse formato.

***

### **429 – Too Many Requests**

O endpoint do cliente recebeu muitas requisições em um curto período de tempo e respondeu com limite excedido.

Verifique se há mecanismos de rate limit configurados e, se necessário, ajuste a infraestrutura para suportar picos.

***

### **502 – Bad Gateway**

O servidor intermediário (como um proxy ou API Gateway) retornou erro ao tentar acessar o servidor final.

Pode ser instabilidade, falha de rede ou configuração incorreta no servidor do cliente.

***

### **503 – Service Unavailable**

O servidor do cliente **estava indisponível** no momento do envio do Webhook.

Pode indicar manutenção, falha temporária ou sobrecarga. O cliente deve revisar a estabilidade da aplicação.

***

### **504 – Gateway Timeout**

A requisição foi encaminhada, mas **o servidor não respondeu dentro do tempo limite**.

Pode ser causado por lentidão, travamentos ou falhas no servidor do cliente.

***

# Outros Códigos

Outros códigos menos comuns também podem aparecer, como:

* **406** – o servidor não consegue responder no formato exigido.
* **409** – conflito na lógica do endpoint ao tentar processar o evento.
* **412** – alguma condição prévia definida pelo servidor não foi atendida.

***

# Encontrou um erro diferente?

Caso você encontre um erro HTTP que não esteja listado aqui, não se preocupe. Todos os códigos de erro seguem a lógica explicada na nossa documentação principal sobre fila pausada.

Veja mais em:\
[Códigos HTTP e o comportamento dos Webhooks no Asaas](https://docs.asaas.com/docs/fila-pausada#c%C3%B3digos-http-e-o-comportamento-dos-webhooks-no-asaas)

Em caso de dúvidas, entre em contato com nosso time de suporte técnico para avaliação.



Se a sua solução de **Firewall for CloudFlare** e estiver enfrentando o **erro HTTP 403** na sincronização dos webhooks, você precisará criar algumas regras no seu Firewall para o correto funcionamento dos Webhooks Asaas com o seu sistema.

<Embed url="https://www.youtube.com/watch?v=nqNzh1Vw9sY" title="Erro 403 - Cloudflare - Asaas Webhooks" favicon="https://www.google.com/favicon.ico" provider="youtube.com" href="https://www.youtube.com/watch?v=nqNzh1Vw9sY" typeOfEmbed="youtube" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252FnqNzh1Vw9sY%253Ffeature%253Doembed%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253DnqNzh1Vw9sY%26key%3D7788cb384c9f4d5dbbdbeffd9fe4b92f%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />

Primeiro, acesse as configurações do domínio de seu sistema no CloudFlare. Ao expandir a **Visão Geral** do domínio, vá até o menu “**Segurança > WAF**”.

No lado direito, escolha a opção “Regras de acesso de IP” e crie a regra de permitir todos os [IPs oficiais do Asaas](https://docs.asaas.com/docs/ips-oficiais-do-asaas) (clique no link para saber mais).

<Image align="center" src="https://files.readme.io/2c67476-image_3.png" />

Obs.: em sandbox pode haver outros IPs, siga bloqueando, vá em **Segurança > Eventos** e libere o IP bloqueado também:

<Image align="center" src="https://files.readme.io/843fac3-image_4.png" />

Ao acessar a página a lista de IPs bloqueados aparecerão na lista, basta copiar o IP e liberá-los.

Finalizando a configuração, basta acessar o menu de [**Configurações do Webhook**](https://www.asaas.com/customerConfigIntegrations/webhooks) em sua **conta Asaas**, e **reativar a fila de sincronização** para conferir se a situação está resolvida.




O Asaas possui IPs oficiais pelos quais se comunica com sua aplicação através dos webhooks. Você pode utilizá-los para liberar acesso em sua [aplicação através do firewall](https://docs.asaas.com/docs/bloqueio-do-firewall-na-cloudflare) ou para bloquear outros IPs que não sejam estes, por questão de segurança.

* **52.67.12.206**
* **18.230.8.159**
* **54.94.136.112**
* **54.94.183.101**


