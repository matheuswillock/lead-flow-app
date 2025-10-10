

# Introdução

Apesar de funcionar de forma muito parecida com o ambiente de produção, algumas funcionalidades precisam ser testadas de um jeito específico.

Nas páginas abaixo, você encontra instruções detalhadas de como testar cada uma dessas funcionalidades no sandbox:

* [Como realizar transferências.](https://docs.asaas.com/docs/testando-transfer%C3%AAncias#/)
* [Como simular contas a pagar.](https://docs.asaas.com/docs/testando-pagamento-de-contas#/)
* [Como testar pagamento com cartão de crédito.](https://docs.asaas.com/docs/testando-pagamento-com-cart%C3%A3o-de-cr%C3%A9dito#/)
* [Como testar um pagamento via QR Code.](https://docs.asaas.com/docs/testar-pagamento-de-qrcodes-pix#/)
* [Como testar ações críticas.](https://docs.asaas.com/docs/como-testar-a%C3%A7%C3%B5es-cr%C3%ADticas#/)
* [Tentar pagar QR Code Pix no Sandbox sem chave cadastrada = erro 404.](https://docs.asaas.com/docs/tentar-pagar-qr-code-pix-no-sandbox-sem-chave-cadastrada-erro-404#/)
* [Como gerar novas cobranças de uma assinatura.](https://docs.asaas.com/docs/como-gerar-novas-cobran%C3%A7as-de-uma-assinatura#/)

Confira também as funcionalidades que podem ser testadas em nosso sandbox [aqui](https://docs.asaas.com/docs/o-que-pode-ser-testado).

Além disso, você pode utilizar a nossa documentação para realizar chamadas diretamente no ambiente de sandbox. Veja como fazer isso aqui: <Anchor label="Como testar chamadas na documentação" target="_blank" href="https://docs.asaas.com/reference/como-testar-as-chamadas-aqui-na-documenta%C3%A7%C3%A3o">Como testar chamadas na documentação</Anchor>.



Para cobranças em cartão de crédito você pode usar cartões de teste para simular um pagamento direto pelos endpoints para criar cobrança com cartão de crédito. Aqui está um exemplo de um cartão válido:

> Cartão de crédito: `4444 4444 4444 4444`
>
> Vencimento: `Qualquer mês posterior a data de hoje`
>
> CCV: `123` _(ou outros 3 números aleatórios)_

Você também pode usar [geradores de cartão de crédito para testes](https://www.4devs.com.br/gerador_de_numero_cartao_credito). Todos esses irão funcionar e confirmar o pagamento.

Para testar pagamentos com erros, utilize os cartões abaixo:

> Mastercard: `5184019740373151`
>
> Visa: `4916561358240741`

Veja a chamada para realizar cobranças com cartão de crédito [aqui](https://docs.asaas.com/reference/criar-cobranca-com-cartao-de-credito).



Caso queira testar o pagamento de contas em Sandbox, é possível realizar a chamada usando a linha digitável de qualquer boleto que tenha sido gerado em sua própria conta Asaas no ambiente Sandbox.

Veja a chamada para realizar um pagamento de contas [aqui](https://docs.asaas.com/reference/criar-um-pagamento-de-conta).



# Introdução

O ambiente Sandbox do Asaas permite a simulação completa de transferências financeiras, possibilitando que você valide integrações com segurança, sem movimentar valores reais.

Este guia explica como realizar testes de transferências via Pix e transferências via TED, destacando os comportamentos esperados e os recursos disponíveis exclusivamente neste ambiente.

***

## Testando Transferências via Pix

### Opção 1: Utilizando Chaves Pix Fictícias do BACEN


O Banco Central fornece um conjunto de chaves Pix fictícias, especialmente para testes de transferências em ambientes homologatórios, como o Sandbox do Asaas.

Ao realizar uma transferência para qualquer uma dessas chaves fictícias, a operação:

* Será concluída imediatamente com sucesso.
* O valor será debitado da conta Sandbox.
* Não haverá compensação em nenhuma outra conta, pois são chaves fictícias.

Consulte a lista oficial de chaves Pix fictícias fornecidas pelo BACEN:

```
Nome: Joao Silva 
CPF/CNPJ 99991111140
Chave: cliente-a00001@pix.bcb.gov.br
BANCO Virtual Mensageria 04 (99999004)
AGÊNCIA 0001
CONTA 12345678 CACC)

Nome: Joao Silva Silva 
CPF/CNPJ 99992222263
Chave: cliente-a00002@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0002
CONTA 11345678 (CACC)

Nome: Jose Silva
CPF/CNPJ99993333387
Chave: cliente-a00003@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0003
CONTA 12145678(CACC)

Nome: Jose Silva Silva
CPF/CNPJ99994444409
Chave: cliente-a00004@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0004
CONTA 12315678(CACC)

Nome: Jose da Silva
CPF/CNPJ99995555514
Chave: cliente-a00005@pix.bcb.gov.br
BANCOVirtual Mensageria 04 (99999004)
AGÊNCIA 0004
CONTA 12341678(CACC)
```

<br />

### Opção 2: Utilizando Chaves Pix de Outras Contas Sandbox

Você pode criar uma chave Pix em sua própria conta Sandbox ou em outra conta Sandbox para realizar testes mais completos.

Nesse caso:

* O valor será debitado da conta origem.
* O valor será creditado na conta destino.
* Todo o fluxo ocorre dentro do ambiente Sandbox, permitindo validar cenários reais de débito e crédito.

**Exemplo de fluxo:**
Conta Sandbox A → realiza Pix → Chave Pix da Conta Sandbox B → Conta B recebe o crédito.

<Callout icon="❗️" theme="error">
  **Importante**

  * As transferências realizadas para chaves fictícias não geram registros de crédito em nenhuma conta.
  * As transferências entre contas reais do Sandbox simulam perfeitamente a movimentação entre contas bancárias no ambiente de produção.
</Callout>

<br />

***

## Testando Transferências via TED

Em ambiente Sandbox, as transferências via TED contam com controles manuais disponíveis exclusivamente na interface do Asaas (não disponíveis via API).

Após iniciar uma transferência TED, você terá duas opções na interface para simular o resultado da operação:

### Confirmar Transferência:

* Simula uma compensação bem-sucedida. O valor é debitado da conta Sandbox.
* O status da transferência muda para Concluída.

### Simular Falha:

* Simula uma falha na transferência.
* O valor não é debitado da conta.
* O status da transferência muda para Falhou.

<Callout icon="📘" theme="info">
  **ATENÇÃO:**

  * No Sandbox, nenhuma transferência resulta em movimentações financeiras reais.
  * Todos os testes podem ser feitos com segurança, sem risco de impacto em ambientes produtivos.
  * O uso de chaves Pix fictícias é recomendado para testar fluxos de sucesso sem necessidade de configurar múltiplas contas.
  * Para testar cenários de crédito e débito, utilize múltiplas contas Sandbox com chaves Pix reais.
</Callout>

O ambiente Sandbox do Asaas proporciona um ambiente seguro e controlado para validar todos os fluxos de transferências via Pix e TED, desde casos de sucesso até falhas, garantindo maior qualidade e segurança na integração antes da utilização em ambiente de produção.

Veja a chamada para realizar transferências [aqui](https://docs.asaas.com/reference/transferir-para-conta-de-outra-instituicao-ou-chave-pix).



Se você estiver procurando uma forma de testar o fluxo de integração de um QRCode estático, existe uma forma bem simples de testar.

Após criar um [QRCode estático em Sandbox](https://docs.asaas.com/reference/criar-qrcode-estatico), utilize o endpoint [Pagar um QRCode](https://docs.asaas.com/reference/pagar-um-qrcode) enviando o payload do seu QRCode gerado.

> **POST`/v3/pix/qrCodes/pay`**
> [Confira a referência completa deste endpoint](https://docs.asaas.com/reference/pagar-um-qrcode)

```json
{
    qrCode: {
      payload: '00020126710014br.gov.bcb.pix01362ae3db4c-9f04-44de-9a39-adcc98a334c20209Churrasco520400005303986540550.005802BR5913John Doe6009Joinville62290525JHOND00000000465493ASA6304DB5E'
    },
    value: 50
}
```

Ao realizar essa ação uma cobrança do tipo Pix será criada automaticamente, recebendo esse pagamento com os campos `pixTransaction` e `pixQrCodeId` preenchidos.



# Contexto

Ao utilizar a rota:

```json
POST 

/v3/pix/qrCodes/pay
```

em ambiente **sandbox**, pode ocorrer um erro `404 Not Found` ao tentar pagar um QR Code Pix **gerado a partir de uma cobrança criada via interface**, **sem que haja uma chave Pix cadastrada na conta**.

Esse erro acontece porque, no ambiente de testes, **o payload do QR Code Pix não é registrado** quando a conta não possui chave Pix válida — ou quando a cobrança foi criada com a integração Pix do Bradesco (que não gera o payload no sandbox).

# Observação importante

Embora tecnicamente o erro 404 esteja correto (o payload realmente **não existe no sandbox**), entendemos que isso pode gerar confusão para quem está integrando com a API, já que:

* A rota usada é válida;
* O payload foi extraído corretamente da cobrança;
* A expectativa do cliente é que o QR Code funcione para testes.

# Como evitar o erro

Para garantir que o teste funcione no ambiente de homologação (sandbox), **é necessário cadastrar uma chave Pix na conta** e gerar uma nova cobrança com QR Code **associado a essa chave**.

Veja a chamada para realizar um pagamento de QRCode [aqui](https://docs.asaas.com/reference/pagar-um-qrcode).

<br />



No ambiente **Sandbox**, você pode validar o **token de ação crítica** utilizando o valor padrão “000000”.

Caso você necessite, nós podemos desabilitar o token para transferências em Sandbox. Porém, é importante que você saiba que o TOKEN é uma validação de segurança e, na ausência dele, a conta pode ficar mais suscetível às ações indevidas.

Levamos como sugestão, caso tenha algum IP ou alguns em específico que movimentam a conta, restringir para que apenas esses estejam liberados e que se o sistema do Asaas identificar ação de algum outro IP faça o bloqueio da ação. Você também pode utilizar o nosso mecanismo para validação de saques por Webhook, para uma maior segurança.

Para fazer essa solicitação, [envie um e-mail ao time de Sucesso de Integrações](https://docs.asaas.com/docs/entre-em-contato).

<br />



Caso queira testar a geração de novas cobranças de uma assinatura no ambiente Sandbox, é necessário gerar o carnê da assinatura.

Ao gerar o carnê, as cobranças da assinatura até a data final definida serão criadas automaticamente.
Por exemplo, se o carnê for gerado até dezembro, todas as cobranças da assinatura até dezembro serão geradas.

Veja a chamada para gerar o carnê da assinatura [aqui](https://docs.asaas.com/reference/gerar-carne-de-assinatura).

<br />



Algumas funcionalidades não estão disponíveis em Sandbox, confira abaixo o que pode e o que não pode ser testado em Sandbox:

| Descrição                                            | Pode ser testada?                                                                                                                                                        |
| :--------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clientes**                                         |                                                                                                                                                                          |
| Criação de clientes                                  | ✅                                                                                                                                                                        |
| Listar clientes                                      | ✅                                                                                                                                                                        |
| Recuperar um único cliente                           | ✅                                                                                                                                                                        |
| Atualização de clientes                              | ✅                                                                                                                                                                        |
| Exclusão de clientes                                 | ✅                                                                                                                                                                        |
| Restaurar cliente removido                           | ✅                                                                                                                                                                        |
| **Cobranças**                                        |                                                                                                                                                                          |
| Criação de cobranças                                 | ✅                                                                                                                                                                        |
| Criação de cobrança com cartão de crédito            | ✅                                                                                                                                                                        |
| Criar uma cobrança parcelada                         | ✅                                                                                                                                                                        |
| Criar cobrança com split                             | ✅                                                                                                                                                                        |
| Recuperar uma única cobrança                         | ✅                                                                                                                                                                        |
| Listar cobranças                                     | ✅                                                                                                                                                                        |
| Atualizar cobrança existente                         | ✅                                                                                                                                                                        |
| Tokenização de cartão de crédito                     | ✅                                                                                                                                                                        |
| Remover cobrança                                     | ✅                                                                                                                                                                        |
| Restaurar cobrança removida                          | ✅                                                                                                                                                                        |
| Estornar cobrança                                    | ✅                                                                                                                                                                        |
| Obter linha digitável do boleto                      | ✅                                                                                                                                                                        |
| Layout de boleto com QR Code Pix                     | ❌                                                                                                                                                                        |
| Obter QR Code PIX                                    | ✅                                                                                                                                                                        |
| Confirmar recebimento em dinheiro                    | ✅                                                                                                                                                                        |
| Desfazer confirmação de recebimento em dinheiro      | ✅                                                                                                                                                                        |
| Fazer upload de documentos da cobrança               | ✅                                                                                                                                                                        |
| Atualizar definições de um documento da cobrança     | ✅                                                                                                                                                                        |
| Listar/Recuperar documentos de uma cobrança          | ✅                                                                                                                                                                        |
| Excluir documento de uma cobrança                    | ✅                                                                                                                                                                        |
| Aplicar descontos, juros e multas em boleto/Pix      | ❌                                                                                                                                                                        |
| **Parcelamentos**                                    |                                                                                                                                                                          |
| Listar/Recuperar parcelamentos                       | ✅                                                                                                                                                                        |
| Remover parcelamento                                 | ✅                                                                                                                                                                        |
| Estornar parcelamento                                | ✅                                                                                                                                                                        |
| **Assinaturas**                                      |                                                                                                                                                                          |
| Criar assinatura                                     | ✅                                                                                                                                                                        |
| Listar/Recuperar assinaturas                         | ✅                                                                                                                                                                        |
| Listar cobranças de uma assinatura                   | ✅                                                                                                                                                                        |
| Criar assinatura com cartão de crédito               | ✅                                                                                                                                                                        |
| Atualizar assinatura                                 | ✅                                                                                                                                                                        |
| Remover assinaturas                                  | ✅                                                                                                                                                                        |
| Listar notas fiscais das cobranças de uma assinatura | ✅                                                                                                                                                                        |
| Criar configuração para emissão de Notas Fiscais     | ✅                                                                                                                                                                        |
| Atualizar configuração para emissão de Notas Fiscais | ✅                                                                                                                                                                        |
| Recuperar configuração para emissão de Notas Fiscais | ✅                                                                                                                                                                        |
| Remover configuração para emissão de Notas Fiscais   | ✅                                                                                                                                                                        |
| **Link de pagamento**                                |                                                                                                                                                                          |
| Criar um link de pagamento                           | ✅                                                                                                                                                                        |
| Atualizar um link de pagamento                       | ✅                                                                                                                                                                        |
| Recuperar um link de pagamento                       | ✅                                                                                                                                                                        |
| Listar links de pagamentos                           | ✅                                                                                                                                                                        |
| Remover um link de pagamento                         | ✅                                                                                                                                                                        |
| Restaurar um link de pagamento                       | ✅                                                                                                                                                                        |
| Adicionar uma imagem a um link de pagamento          | ✅                                                                                                                                                                        |
| Recuperar imagem de link de pagamentos               | ✅                                                                                                                                                                        |
| Listar imagens de link de pagamento                  | ✅                                                                                                                                                                        |
| Remover imagem de link de pagamento                  | ✅                                                                                                                                                                        |
| Definir imagem principal do link de pagamento        | ✅                                                                                                                                                                        |
| **Notificações**                                     |                                                                                                                                                                          |
| Atualizar notificação existente                      | ✅                                                                                                                                                                        |
| Atualizar notificação existente em lote              | ✅                                                                                                                                                                        |
| Notificações por E-mail                              | ✅                                                                                                                                                                        |
| Notificações por SMS                                 | ✅                                                                                                                                                                        |
| Notificações por WhatsApp                            | ❌ (Não enviado devido ao custo envolvido na mensageria)                                                                                                                  |
| **Transferências**                                   |                                                                                                                                                                          |
| Transferir para conta ASAAS                          | ✅                                                                                                                                                                        |
| Transferir para conta bancária via TED               | ✅                                                                                                                                                                        |
| Transferir para conta bancária via PIX               | ⚠️ - É possível testar transferências para [chaves fornecidas pelo BACEN](https://docs.asaas.com/docs/como-testar-funcionalidades#testando-transfer%C3%AAncias-para-pix) |
| Transferir para outra chave PIX                      | ⚠️ - É possível transferir para outras chaves existentes em sandbox                                                                                                      |
| Recuperar uma única transferência                    | ✅                                                                                                                                                                        |
| Listar transferências                                | ✅                                                                                                                                                                        |
| **Antecipações**                                     |                                                                                                                                                                          |
| Solicitar antecipação                                | ✅                                                                                                                                                                        |
| Simular antecipação                                  | ❌                                                                                                                                                                        |
| Recuperar/Listar antecipações                        | ✅                                                                                                                                                                        |
| **Negativações**                                     |                                                                                                                                                                          |
| Criar uma negativação                                | ✅                                                                                                                                                                        |
| Simular uma negativação                              | ✅                                                                                                                                                                        |
| Recuperar negativação                                | ✅                                                                                                                                                                        |
| Listar negativações                                  | ✅                                                                                                                                                                        |
| Reenviar documentos                                  | ✅                                                                                                                                                                        |
| Cancelar negativações                                | ✅                                                                                                                                                                        |
| **Pagamento de contas**                              |                                                                                                                                                                          |
| Criar um pagamento de contas                         | ✅                                                                                                                                                                        |
| Simular um pagamento de contas                       | ✅                                                                                                                                                                        |
| Listar/Recuperar pagamento de contas                 | ✅                                                                                                                                                                        |
| Cancelar pagamento de contas                         | ✅                                                                                                                                                                        |
| **Recargas de celular**                              |                                                                                                                                                                          |
| Solicitar recarga                                    | ✅                                                                                                                                                                        |
| **Consulta Serasa**                                  |                                                                                                                                                                          |
| Realizar consulta                                    | ✅                                                                                                                                                                        |
| Recuperar uma consulta                               | ✅                                                                                                                                                                        |
| Listar consultas                                     | ✅                                                                                                                                                                        |
| **Extrato**                                          |                                                                                                                                                                          |
| Recuperar extrato                                    | ✅                                                                                                                                                                        |
| **Informações financeiras**                          |                                                                                                                                                                          |
| Recuperar saldo da conta                             | ✅                                                                                                                                                                        |
| Estatísticas de cobranças                            | ✅                                                                                                                                                                        |
| Recuperar valores de split                           | ✅                                                                                                                                                                        |
| **Informações e Personalização da Conta**            |                                                                                                                                                                          |
| Recuperar dados comerciais                           | ✅                                                                                                                                                                        |
| Recuperar WalletId                                   | ✅                                                                                                                                                                        |
| Salvar personalização da fatura                      | ✅                                                                                                                                                                        |
| Recuperar configurações de personalização            | ✅                                                                                                                                                                        |
| Recuperar número de conta no ASAAS                   | ✅                                                                                                                                                                        |
| **Notas Fiscais**                                    |                                                                                                                                                                          |
| Agendar nota fiscal                                  | ✅                                                                                                                                                                        |
| Atualizar nota fiscal                                | ✅                                                                                                                                                                        |
| Recuperar uma nota fiscal                            | ✅                                                                                                                                                                        |
| Listar notas fiscais                                 | ✅                                                                                                                                                                        |
| Emitir uma nota fiscal                               | ✅                                                                                                                                                                        |
| Cancelar uma nota fiscal                             | ✅                                                                                                                                                                        |
| Listar serviços municipais                           | ✅                                                                                                                                                                        |
| Informações fiscais                                  |                                                                                                                                                                          |
| Listar configurações municipais                      | ✅                                                                                                                                                                        |
| Criar e atualizar informações fiscais                | ✅                                                                                                                                                                        |
| Recuperar informações fiscais                        | ✅                                                                                                                                                                        |
| **Pix**                                              |                                                                                                                                                                          |
| Criar uma chave                                      | ✅                                                                                                                                                                        |
| Recuperar uma única transação                        | ✅                                                                                                                                                                        |
| Listar transações                                    | ✅                                                                                                                                                                        |
| Cancelar uma transação agendada                      | ✅                                                                                                                                                                        |
| Criar um QRCode estático                             | ✅                                                                                                                                                                        |
| Decodificar um QRCode                                | ✅                                                                                                                                                                        |
| Pagar um QRCode                                      | ❌                                                                                                                                                                        |
| Listar chaves                                        | ✅                                                                                                                                                                        |
| Recuperar uma única chave                            | ✅                                                                                                                                                                        |
| Remover chave                                        | ❌                                                                                                                                                                        |
| **Configuração de Webhooks**                         |                                                                                                                                                                          |
| Criar ou atualizar configuração para Webhook         | ✅                                                                                                                                                                        |
| Recuperar configurações                              | ✅                                                                                                                                                                        |
| **Conta Asaas/Subcontas**                            |                                                                                                                                                                          |
| Criar conta                                          | ✅                                                                                                                                                                        |
| Listar contas                                        | ✅                                                                                                                                                                        |
| Envio de documentos via link (white label)           | ⚠️ — É preciso pedir aprovação manual para o time de sucesso de integrações                                                                                              |



Mesmo sendo muito semelhante ao ambiente de produção, o ambiente de sandbox requer alguns cuidados para que a aprovação de contas e subcontas seja realizada corretamente.

***

### Aprovação de contas avulsas

Para que sua conta seja aprovada automaticamente no ambiente de sandbox, é necessário preencher completamente o cadastro, incluindo os dados comerciais e o envio de documentos.

As informações fornecidas não precisam ser reais, ou seja, basta preencher os dados comerciais obrigatórios e enviar qualquer imagem como documentação, que a conta será validada.

Para isso, basta seguir este passo a passo:

1. Acesse sua conta e no menu do usuário, clique em **Minha conta**.
2. Vá até **Informações > Dados comerciais** e preencha os seguintes campos:
   * CPF/CNPJ
   * Data de nascimento
   * Nome completo
   * Celular
   * Endereço
   * Informações do seu negócio
3. Em seguida, acesse a aba **Documentos** e envie qualquer arquivo aleatório.
4. Por fim, acesse a seção **Situação cadastral** para verificar se a sua conta foi aprovada.

<Image align="center" src="https://files.readme.io/e8b50c15f058227bc6fe89759659ff974d5a344d492628100615127cc4f760fd-2025-09-18_16-55.png" />

<Callout icon="👍" theme="okay">
  **Dica**
  Caso não queira usar dados reais, você pode utilizar geradores de empresas, como: [https://www.4devs.com.br/gerador\_de\_pessoas](https://www.4devs.com.br/gerador_de_pessoas)
</Callout>

Além disso, quando você atualiza alguma informação, mesmo as não obrigatórias, será necessário solicitar ao nosso time de Sucesso de Integrações para que a conta seja aprovada novamente.

<Callout icon="❗️" theme="error">
  **Importante**

  Para evitar falhas, nomeie suas contas e subcontas no ambiente Sandbox usando apenas letras e espaços.
  O uso de números ou caracteres especiais (`!`, `#`, `_`, etc.) nos nomes pode causar erros na sincronização com o ambiente Pix e desativar o PIX na sua conta de teste, bloqueando sua integração.

  **Evite:** `Conta Teste_01`
  **Prefira:** `Conta Teste Um`

  Se sua conta está aprovada e o PIX desabilitado, verifique e corrija os nomes das contas. Se o problema persistir, contate nosso suporte.
</Callout>

### Subcontas

Ao criar subcontas no ambiente de sandbox, é essencial utilizar um e-mail válido. Isso garante o envio do link de redefinição de senha, necessário para completar o processo de onboarding. Após acessar esse link, você deve concluir o cadastro na conta da subconta, incluindo o envio das imagens para a validação automática de documentos.

Caso o e-mail informado seja inválido, ou o link não seja acessado, a aprovação automática da subconta não será possível.
Nesses casos, é necessário realizar a chamada [Verificar documentos pendentes](https://docs.asaas.com/reference/verificar-documentos-pendentes) utilizando a API Key da subconta e, em seguida, entrar em contato com o nosso time de Integrações para finalizar o processo.

### White label

No modelo de subcontas white label, o envio de documentos é feito por meio do link de onboarding. No ambiente de sandbox, esses links têm apenas caráter ilustrativo e não executam validações reais.

A aprovação dessas subcontas é realizada manualmente pelo nosso time de Integrações. Para garantir que o processo seja concluído corretamente, você deve fazer a chamada [Verificar documentos pendentes](https://docs.asaas.com/reference/verificar-documentos-pendentes) com a API Key da subconta.

Além disso, se realizar essa chamada e notar que a sua subconta precisa enviar documentos adicionais — como o contrato social, por exemplo —, esse envio pode ser feito via API, utilizando a chamada **enviar documentos via API**.

Para suporte, entre em contato com: [integracoes@asaas.com.br](mailto:integracoes@asaas.com.br)

