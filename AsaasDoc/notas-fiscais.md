

O Assas possibilita que empresas (pessoa jurídica) emitam Notas Fiscais de serviço para seus clientes. É possível emitir uma Nota Fiscal atrelada a cobranças já existentes ou avulsas.

<Embed url="https://www.youtube.com/watch?v=flPv7tVhmLc" title="Como Emitir Notas Fiscais na API do Asaas | Asaas Dev" favicon="https://www.google.com/favicon.ico" image="https://i.ytimg.com/vi/flPv7tVhmLc/hqdefault.jpg" provider="youtube.com" href="https://www.youtube.com/watch?v=flPv7tVhmLc" typeOfEmbed="youtube" html="%3Ciframe%20class%3D%22embedly-embed%22%20src%3D%22%2F%2Fcdn.embedly.com%2Fwidgets%2Fmedia.html%3Fsrc%3Dhttps%253A%252F%252Fwww.youtube.com%252Fembed%252FflPv7tVhmLc%253Ffeature%253Doembed%26display_name%3DYouTube%26url%3Dhttps%253A%252F%252Fwww.youtube.com%252Fwatch%253Fv%253DflPv7tVhmLc%26image%3Dhttps%253A%252F%252Fi.ytimg.com%252Fvi%252FflPv7tVhmLc%252Fhqdefault.jpg%26key%3D7788cb384c9f4d5dbbdbeffd9fe4b92f%26type%3Dtext%252Fhtml%26schema%3Dyoutube%22%20width%3D%22854%22%20height%3D%22480%22%20scrolling%3D%22no%22%20title%3D%22YouTube%20embed%22%20frameborder%3D%220%22%20allow%3D%22autoplay%3B%20fullscreen%3B%20encrypted-media%3B%20picture-in-picture%3B%22%20allowfullscreen%3D%22true%22%3E%3C%2Fiframe%3E" />

> 🚧
>
> Antes de emitir uma nota fiscal é necessário preencher as informações fiscais na sua conta. [Confira aqui como realizar essa configuração.](https://docs.asaas.com/docs/configurar-informacoes-fiscais)

Via API, há uma sequência de chamadas que precisarão ser realizadas em ordem:

1. [Listar configurações municipais](https://docs.asaas.com/reference/listar-configuracoes-municipais) — onde ficará definido o que a prefeitura referente ao seu cadastro exige para poder ser configurado;
2. [Criar ou atualizar configurações municipais](https://docs.asaas.com/reference/criar-e-atualizar-informacoes-fiscais) — sabendo o que a prefeitura exige, nessa chamada irá criar ou atualizar as configurações municipais;
3. [Listar serviços municipais](https://docs.asaas.com/reference/listar-servicos-municipais) — antes de finalmente emitir uma nota fiscal, é preciso saber o que informar na chamada. Para isso, faz-se a chamada de listar serviços municipais, cujo objetivo é trazer o Id próprio da API para um determinado serviço;
4. [Agendar nota fiscal](https://docs.asaas.com/reference/agendar-nota-fiscal) — finalmente com tudo configurado e o serviço listado, já sabendo qual Id utilizar, essa é a chamada para poder agendar a nota fiscal;

Para saber mais sobre o **produto** de **notas fiscais**, [clique aqui](https://ajuda.asaas.com/pt-BR/?q=NOTAS%20FISCAIS).




Antes de emitir uma Nota Fiscal é necessário definir as configurações fiscais da sua empresa, como número do RPS, usuário e senha da prefeitura (ou certificado), entre outros.

Para começar, você precisa chamar o endpoint de Listar configurações municipais. Este endpoint retornará quais são os dados necessários que a sua prefeitura exige, conforme a cidade cadastrada na sua conta de CNPJ.

> **GET** `/v3/fiscalInfo/municipalOptions`\
> [Confira a referência completa deste endpoint.](https://docs.asaas.com/reference/listar-configuracoes-municipais)

Como retorno, você terá acesso aos campos:

* `authenticationType` (enum) - Tipo de autenticação necessária na prefeitura
  * `CERTIFICATE` - Certificado digital
  * `TOKEN` - Token
  * `USER_AND_PASSWORD` - Usuário e senha
* `supportsCancellation` (boolean) - Suporta ou não o cancelamento de notas fiscais automaticamente na sua prefeitura
* `usesSpecialTaxRegimes` (boolean) - Necessário informar ou não o regime especial de tributação. Caso utilize, informe-o no campo `specialTaxRegime` do **Criar ou atualizar informações fiscais** de acordo com as opções retornadas na lista `specialTaxRegimesList`.
* `usesServiceListItem` (boolean) - Necessário informar ou não o item da lista de serviço
* `specialTaxRegimesList` (array) - Opções de regime especial de tributação
  * `label` - Nome do regime especial de tributação
  * `value` - Identificador do regime especial de tributação
* `municipalInscriptionHelp` (string) - Explicação sobre formato da inscrição municipal
* `specialTaxRegimeHelp` (string) - Explicação sobre o regime especial de tributação
* `serviceListItemHelp` (string) - Explicação sobre formato do item da lista de serviço
* `digitalCertificatedHelp` (string) - Explicação sobre certificado digital
* `accessTokenHelp` (string) - Explicação sobre token
* `municipalServiceCodeHelp` (string) - Explicação sobre formato do código de serviço municipal

Um exemplo de retorno:

```json
{
    "authenticationType": "USER_AND_PASSWORD",
    "supportsCancellation": true,
    "usesSpecialTaxRegimes": false,
    "usesServiceListItem": false,
    "usesStateInscription": false,
    "specialTaxRegimesList": null,
    "municipalInscriptionHelp": "A inscrição municipal da empresa deve conter de 1 a 8 dígitos (somente números).\r\n\r\nExemplo válido: 11356",
    "specialTaxRegimeHelp": null,
    "serviceListItemHelp": null,
    "digitalCertificatedHelp": null,
    "accessTokenHelp": null,
    "municipalServiceCodeHelp": "Informe aqui o código de serviço municipal que identifica o serviço prestado na nota fiscal. \r\n\r\nEle possui geralmente 4 a 5 dígitos com formatação.\r\nExemplo válido: 1.01"
}
```

No exemplo acima, sabemos que a autenticação é por usuário e senha e que a prefeitura não utiliza o regime especial de tributação. Tendo essas informações em mão, podemos enviar os dados necessário no endpoint para criar ou atualizar informações fiscais.

> **POST** `/v3/fiscalInfo`\
> [Confira a referência completa deste endpoint.](https://docs.asaas.com/reference/criar-e-atualizar-informacoes-fiscais)

```json
{
  "email": "marcelo.almeida@gmail.com",
  "municipalInscription": "21779501",
  "simplesNacional": true,
  "cnae": "6209100",
  "rpsSerie": "1",
  "rpsNumber": 1,
  "username": "marcelo.almeida@gmail.com",
  "password": "secret@123",
}
```

Se estiver tudo certo com as suas configurações, você já está apto para emissão de notas fiscais.





Para emitir uma nota fiscal você deve chamar o endpoint de "Agendar nota fiscal". Mas, antes, vamos verificar o ID dos serviços municipais.

### Listar serviços municipais

> **GET** `/v3/invoices/municipalServices`\
> [Confira a referência completa deste endpoint.](https://docs.asaas.com/reference/listar-servicos-municipais)

A lista de serviços municipais pode ser utilizada para consultar informações do serviço que deve ser enviado na geração da nota fiscal.

O campo `description` além de conter o código e descrição do serviço pode conter também o código CNAE, sendo apresentado no seguinte formato: `CNAE | Codigo - Descrição`.

A cada requisição são retornados no máximo 500 serviços, caso o serviço desejado não seja retornado, utilize o filtro `description` na requisição.

> 📘
>
> * Dependendo da sua prefeitura o código CNAE pode não ser retornado.* Caso sua prefeitura não disponibilize a lista de serviços nenhum resultado será retornado.

Caso você tenha o ID do serviço municial, basta enviá-lo na requisição.

### Agendar uma nota fiscal

> **POST** `/v3/invoices`\
> [Confira a referência completa deste endpoint.](https://docs.asaas.com/reference/agendar-nota-fiscal)

```json
{
  "payment": "pay_637959110194",
  "serviceDescription": "Nota fiscal da Fatura 101940. \nDescrição dos Serviços: ANÁLISE E DESENVOLVIMENTO DE SISTEMAS",
  "observations": "Mensal referente aos trabalhos de Junho.",
  "value": 300,
  "deductions": 0,
  "effectiveDate": "2023-07-03",
  "municipalServiceId": "21234",
  "municipalServiceName": "Análise e desenvolvimento de sistemas",
  "taxes": {
    "retainIss": false,
    "iss": 3,
    "cofins": 3,
    "csll": 1,
    "inss": 0,
    "ir": 1.5,
    "pis": 0.65
  }
}
```

> 📘 Os status possíveis de uma nota fiscal são os seguintes:
>
> `SCHEDULED` - Agendada
>
> `SYNCHRONIZED` - Enviada para prefeitura
>
> `AUTHORIZED` - Emitida
>
> `PROCESSING_CANCELLATION` - Processando cancelamento
>
> `CANCELED` - Cancelada
>
> `CANCELLATION_DENIED` - Cancelamento negado
>
> `ERROR` - Erro na emissão

A Nota Fiscal pode estar atrelada a uma cobrança, parcelamento ou pode ser gerada de forma avulsa.

Se a Nota Fiscal for originada de uma cobrança existente, é necessário informar o atributo `payment`. O mesmo ocorre para parcelamentos, onde neste caso, é necessário informar o atributo `installment`. Para gerar uma Nota Fiscal avulsa, é necessário informar o atributo `customer`.

Na chamada de agendar notas, dentre vários atributos, existem três fundamentais para a nota ser emitida com sucesso, são eles: `municipalServiceId`, `municipalServiceCode`,  `municipalServiceName`.

E é bastante importante que sejam informados corretamente. O `municipalServiceId` e o `municipalServiceCode`, tem por objetivo informarem o código de serviço que está sendo emitida a nota. Como, por exemplo, o serviço `1.01 - Análise e desenvolvimento de sistemas`.

Em nossa API trabalhamos com Ids para identificar e os serviços funcionam da mesma forma. Ao [listar os serviços do município](https://docs.asaas.com/reference/listar-servicos-municipais),  voltará uma lista com vários serviços e como o exemplo abaixo:

```json
{  
      "id": "203561",  
      "description": "1.01 - Análise e desenvolvimento de sistemas",  
      "issTax": 2  
}
```

Pode-se observar que o código 1.01 é representado pelo ID `203561`. Nesses casos, o `municipalServiceId` é esse. E como já se tem o id do código, não há necessidade de dobrar a informação, sob risco de a nota sair errada, colocando novamente o código no `municipalServiceCode`. Então, o cliente deverá enviar apenas:

```json
{
  ...,
  "municipalServiceId": "203561",
	"municipalServiceCode": null,
	"municipalServiceName" : "1.01 - Análise e desenvolvimento de sistemas"
}
```

Porém, nem todas as cidades retornam essas listagens. São poucas, mas há prefeituras que não tem lista de serviços na API e com isso, o cliente precisará verificar qual é o código do seu serviço e inserir manualmente, ficando assim:

```json
{
  ...,
  "municipalServiceId": null,
	"municipalServiceCode": "1.01",
	"municipalServiceName" : "Análise e desenvolvimento de sistemas"
}
```

Podemos concluir que, sempre que houver lista de serviços, enviar `municipalServiceId`. Caso não tenha, enviar o `municipalServiceCode`. Nesses casos, sempre se envia um ou outro.

### Notas fiscais em assinaturas

Para assinaturas, você pode configurar a emissão de notas fiscais automáticas na [seção de assinaturas](https://docs.asaas.com/reference/criar-configuracao-para-emissao-de-notas-fiscais).

### Emitir uma nota fiscal agendada

Caso ocorra sucesso nesta requisição, a Nota Fiscal será agendada para emissão na data informada no atributo `effectiveDate`. Se a data informada for o dia atual, em até 15 minutos após a requisição a Nota Fiscal será emitida e você receberá a atualização através do webhook (se ativado).

> 👍 O Webhook para notas fiscais enviará eventos quando os status de notas fiscais mudarem ou elas forem criadas
>
> [Confira o Webhook para notas fiscais](https://docs.asaas.com/docs/webhook-para-notas-fiscais)

Se você tem uma nota fiscal agendada para o futuro e deseja adiantar a emissão da mesma, pode chamar o endpoint "Emitir uma nota fiscal".

> **POST** `/v3/invoices/{id}/authorize`\
> [Confira a referência completa deste endpoint.](https://docs.asaas.com/reference/emitir-uma-nota-fiscal)

### Emitir uma nota fiscal usando o Portal Nacional

Se você utiliza o Portal Nacional para emissão de suas notas fiscais, ao acessar o recurso de [listar serviços municipais](https://docs.asaas.com/reference/listar-servicos-municipais), a API lhe devolverá a seguinte exceção:

```json
{
  "errors": [
    {
      "code": "error",
      "description": "O código de serviços municipais não está habilitado para esta conta."
    }
  ]
}
```

Nesse caso, o serviço da nota precisará ser informado manualmente no agendamento da mesma, conforme os código dos serviços disponibilizados no Portal Nacional. Caso tenha dúvidas, acesse o Portal Nacional ou verifique junto ao seu contador quais são os códigos de serviço utilizados em seu negócio.

Com o código de serviço em mãos, basta utilizar a API de [agendar nota fiscal](https://docs.asaas.com/reference/agendar-nota-fiscal) enviando o código no campo municipalServiceCode.

```json
{
  ...,
  "municipalServiceId": null,
	"municipalServiceCode": "1.01",
	"municipalServiceName" : "Análise e desenvolvimento de sistemas"
}
```  



