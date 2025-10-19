Como testar as chamadas aqui na documentação

## ✅ Passo 1: Crie sua conta no ambiente Sandbox

Antes de realizar as chamadas em nossa documentação, você precisa de uma conta no ambiente Sandbox.

1. Acesse: [https://sandbox.asaas.com](https://sandbox.asaas.com)
2. Crie sua conta gratuitamente
3. Dentro do Menu (o menu fica no bonequinho cinza no canto superior direito da tela), vá em Integrações > Chave da API
4. Copie a sua **chave de API**

![](https://files.readme.io/237d6a1eb1d518c2099ed1619c3aaa064be89630e0b2e8a43958826574934901-image.png)

<br />

> ⚠️ **Importante:** as chamadas pela documentação funcionam apenas com a chave **sandbox**. Não use a chave de produção aqui.
>
> [Saiba mais sobre o Sandbox](https://docs.asaas.com/docs/sandbox)

**🔐 Segurança e boas práticas:**

A chave Sandbox é exclusiva para testes e pode ser usada sempre que você quiser simular integrações sem impactos reais. Essa sempre será a chave que utilizará para testes! No entanto, a chave de produção deve ser armazenada com segurança e jamais compartilhada publicamente.

Recomendamos seguir boas práticas de segurança para o armazenamento de chaves sensíveis. Confira nossos artigos sobre o tema:\
👉 [Como armazenar sua chave com segurança](https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1#armazenamento-seguro-para-a-chave-de-api)

***

## 🔑 Passo 2: Cole sua chave na documentação

1. Na nossa documentação, escolha a rota que quer utilizar. Na lateral direita, abaixo de "Asaas", temos diversas abas onde pode selecionar a rota desejada:

   <Image align="center" src="https://files.readme.io/12df58592f51e7d98345d02295701bc653ca56dca081ced7496db594292e5487-image.png" />
2. No topo da documentação interativa, no canto superior direito, localize o campo **Header** e cole sua chave de API

<Image align="center" src="https://files.readme.io/a3ff36919d27efbdc3802557cf33fe34c2e6f39b6dd0695851c565b82ba5b35d-image.png" />

<br />

***

## 🧾 Passo 3: Preencha os parâmetros obrigatórios

Quando você escolher qual chamada API que realizar, notará que alguns campos são obrigatórios:

* Os campos obrigatórios têm “required” escrito ao lado
* Leia as descrições ao lado de cada campo para saber o que preencher
* Alguns campos contém exemplos que ajudam a entender o formato de preenchimento. Você pode utilizar a informação contida neles para preenchê-los, mas em campos do tipo **data** use **datas futuras** (maiores que o dia de hoje) e nos campos do tipo `id` , use `ids`da **sua conta em sandbox** (ex: `id` de um cliente que você tenha criado na sua conta sandbox, `id` de uma cobrança que tenha criado em sandbox)

![](https://files.readme.io/32bc4372e899de562cc219ea29e02cfa7d5d37415c3d48b8bf10ca19a2475db3-image.png)

<br />

<Callout icon="💡" theme="default">
  ### Dica: Recomendamos que você [crie um cliente](https://docs.asaas.com/reference/criar-novo-cliente) na sua conta Asaas antes de qualquer outra ação - ele será o ponto de partida para os seus próximos testes. Após criar o cliente, você poderá utilizar o **ID retornado** para gerar cobranças, assinaturas, parcelamentos e outros recursos disponíveis.
</Callout>

***

## 🚀 Passo 4: Execute a requisição

1. Clique em **Try It!** após preencher os dados
2. Veja a resposta exibida logo abaixo

A resposta traz:

* **Status HTTP** (ex: `200 OK`, `400 Bad Request`, etc)
* **Corpo JSON** com os dados do recurso

### ❗ Erros comuns

* Para status diferentes de 200 (sucesso), consulte nossa documentação de códigos HTTP\:\
  [https://docs.asaas.com/reference/codigos-http-das-respostas](https://docs.asaas.com/reference/codigos-http-das-respostas)
* Os erros geralmente vêm acompanhados de mensagens explicativas, mas o código já ajuda a identificar o problema junto da nossa documentação!

***

## 🧩 Sugestão de rotas para começar

Quer começar testando sem complicação? Aqui estão algumas rotas úteis:

* [Criar cliente](https://docs.asaas.com/reference/criar-cliente)
* [Criar nova cobrança](https://docs.asaas.com/reference/criar-nova-cobranca)
* [Consultar cobranças](https://docs.asaas.com/reference/listar-cobranças)