# Modelo de Cobranca: Modulo WhatsApp com Evolution API

Este documento define o modelo de cobranca do modulo WhatsApp no Lead Flow para o v1 com Evolution API. O foco e viabilizar uma oferta simples de vender, previsivel para o cliente e sustentavel para o produto, sem depender de cobranca variavel automatica por mensagem no primeiro release.

## 1. Resumo executivo

O modulo deve ser vendido como um adicional contratado por time, com:

- 1 numero de WhatsApp por time
- mensalidade fixa
- politica de uso justo
- leitura de consumo no produto
- readiness para cobranca mais sofisticada no futuro
- cobranca adicional por numero extra quando esse recurso for habilitado

Modelo recomendado para o v1:

```txt
WhatsApp Evolution
R$ 99/time/mes
Inclui 1 numero conectado
Inclui uso justo de ate 2.000 mensagens outbound por mes
```

O cliente paga pela capacidade operacional entregue pelo Lead Flow, nao apenas pela infraestrutura da Evolution.

Regra comercial complementar:

```txt
Todo numero alem do primeiro deve gerar cobranca recorrente propria.
```

## 2. Objetivos do modelo de cobranca

- Criar uma oferta simples e facil de entender.
- Proteger a margem do produto contra uso excessivo e suporte operacional alto.
- Evitar discussao comercial complexa logo no primeiro release.
- Permitir evolucao futura para planos superiores, numeros adicionais e cobranca por excedente.

## 3. Unidade de cobranca

A unidade comercial do modulo deve ser o time.

```txt
1 time = 1 modulo contratado = 1 numero ativo
```

Isso mantem coerencia com a operacao definida para o produto:

- conexao no nivel do `Team`
- inbox compartilhada
- auditoria por operador
- ownership comercial no manager do time

## 4. O que esta incluido na mensalidade

A mensalidade nao remunera apenas o QR Code ou a VPS. Ela cobre o pacote de valor do modulo:

- configuracao da integracao no produto
- criacao e manutencao da instancia Evolution
- inbox compartilhada no Lead Flow
- historico de mensagens ligado ao CRM
- autoria das mensagens por operador
- webhooks e persistencia de eventos
- monitoramento basico da integracao
- suporte operacional do modulo
- margem do produto

## 5. Faixa de preco recomendada

Faixa sugerida para comercializacao:

```txt
R$ 99 a R$ 149 por time/mes
```

Recomendacao de lancamento:

```txt
R$ 99/time/mes
```

Motivo:

- reduz friccao comercial
- encaixa melhor como addon do CRM
- cria espaco para um plano superior depois

## 6. Politica de uso justo

Mesmo sem custo oficial por mensagem no modelo Evolution, o produto nao deve ser vendido como ilimitado absoluto.

Politica recomendada:

```txt
Inclui ate 2.000 mensagens outbound por mes por time
```

O uso justo existe para proteger:

- estabilidade operacional
- custo de infraestrutura
- carga de suporte
- risco de uso indevido como canal de disparo em massa

### 6.1. O que conta para o limite

No v1, a regra recomendada e contabilizar principalmente:

- mensagens outbound enviadas pelo sistema

Podem ser persistidos separadamente para analise:

- inbound
- eventos de reconexao
- falhas de envio

Mas o limite comercial do v1 deve considerar outbound como metrica principal.

### 6.2. Faixas operacionais sugeridas

| Faixa | Volume outbound/mes | Tratamento |
|---|---:|---|
| Normal | 0 a 2.000 | Incluso no plano |
| Atencao | 2.001 a 3.000 | Aviso comercial e acompanhamento |
| Alto uso | 3.001 a 5.000 | Revisao de plano ou proposta customizada |
| Acima do perfil | > 5.000 | Migracao para plano superior ou analise manual |

## 7. Regras quando o limite for ultrapassado

No v1, a recomendacao e nao bloquear automaticamente no primeiro excedente.

Comportamento recomendado:

1. Ate o limite: operacao normal.
2. Acima do limite: exibir aviso no produto.
3. Persistencia de uso: registrar consumo e permitir acao comercial.
4. Reincidencia: migrar para plano superior ou negociar condicao especifica.

No v1, o sistema deve:

- medir consumo
- exibir consumo
- sinalizar excesso

No v1, o sistema nao precisa:

- gerar cobranca automatica por excedente
- suspender imediatamente o envio
- calcular custo por mensagem

## 8. Numeros adicionais

Numeros adicionais nao entram no escopo funcional do v1, mas a regra de cobranca deve ficar definida desde ja.

Principios:

- o plano base inclui apenas 1 numero
- cada numero adicional gera cobranca propria
- a cobranca por numero adicional e cumulativa

Formula:

```txt
Total mensal =
plano base do modulo
+ quantidade de numeros adicionais x preco por numero adicional
```

Preco sugerido para fase posterior:

```txt
Numero adicional: R$ 49 a R$ 99/mes por numero
```

Referencia recomendada:

```txt
Plano base: R$ 99/mes com 1 numero
Numero adicional: R$ 79/mes por numero
```

Exemplo:

```txt
1 time com 3 numeros ativos
= R$ 99 do plano base
+ 2 x R$ 79 de numeros adicionais
= R$ 257/mes
```

Condicao:

- somente apos suporte real a multiplos numeros por time
- com isolamento operacional e monitoramento adequados

## 9. Estrutura de planos recomendada

### 9.1. Plano de lancamento

| Plano | Preco | Inclui |
|---|---:|---|
| WhatsApp Evolution | R$ 99/mes | 1 numero, inbox compartilhada, historico no CRM, uso justo de 2.000 outbound |
| Numero adicional | R$ 79/mes por numero | Expande a operacao quando multi-numero estiver disponivel |

### 9.2. Evolucao comercial futura

| Plano | Preco sugerido | Posicionamento |
|---|---:|---|
| WhatsApp Evolution Start | R$ 99/mes | Entrada simples para pequenos times |
| WhatsApp Evolution Pro | R$ 149/mes | Times com uso maior, prioridade de suporte e limite maior |
| WhatsApp Custom | Sob consulta | Operacoes de alto volume ou necessidades especiais |

## 10. Como apresentar o valor ao cliente

O discurso comercial nao deve ser "pagar por mensagem". O correto e vender produtividade e centralizacao operacional.

Mensagem de posicionamento recomendada:

```txt
Seu time passa a conversar com leads dentro do CRM, com historico centralizado,
autoria por operador e acompanhamento de uso, sem depender de operar tudo por fora.
```

Tambem precisa haver clareza sobre a natureza da integracao:

```txt
O modulo usa Evolution API com conexao por QR Code. Podem ocorrer reconexoes,
instabilidades de sessao e necessidade de revalidar o numero conectado.
```

## 11. O que deve aparecer no produto

O produto deve exibir uma area de consumo em:

```txt
Configuracoes > Integracoes > WhatsApp
```

Informacoes minimas:

- plano atual
- numero conectado
- limite mensal
- mensagens outbound consumidas
- percentual do limite
- status visual: normal, atencao ou excedido

Exemplo:

```txt
Plano: WhatsApp Evolution
Numero: +55 11 99999-9999
Uso do periodo: 1.247 / 2.000 mensagens
Consumo: 62,35%
Status: Dentro do limite
```

## 12. Dados necessarios para sustentar a cobranca

Mesmo sem cobranca automatica por excedente no v1, o sistema precisa persistir dados suficientes para auditoria e evolucao futura.

Campos minimos esperados no dominio de uso:

- `teamId`
- `configId`
- `messageId`
- `periodKey`
- `eventType`
- `direction`
- `countedTowardsQuota`
- `quantity`
- `createdAt`

Diretriz principal:

- usar `WhatsAppUsageEvent` como base de medicao operacional e readiness de billing

## 13. Modelo financeiro recomendado

### 13.1. Estrutura simples de receita

```txt
Receita do modulo =
mensalidade fixa por time
```

### 13.2. Estrutura futura de receita

Quando o modulo maturar, a receita pode evoluir para:

```txt
mensalidade fixa
+ numero adicional
+ pacote superior de uso
+ setup assistido
+ servicos especiais
```

## 14. Itens fora de escopo no v1

- cobranca automatica por excedente
- fatura por mensagem
- creditos pre-pagos
- integracao com API Oficial/BSP
- precificacao por categoria de mensagem
- negociacao multi-numero por time

## 15. Recomendacao final

Modelo recomendado para o v1:

```txt
WhatsApp Evolution
R$ 99 por time/mes
1 numero conectado
Uso justo de ate 2.000 mensagens outbound por mes
Aviso de excedente sem cobranca automatica no primeiro release
```

Regra comercial ja definida para a proxima extensao:

```txt
Cada numero adicional deve gerar cobranca mensal propria,
com referencia inicial de R$ 79 por numero/mes.
```

Esse modelo entrega:

- simplicidade comercial
- previsibilidade para o cliente
- protecao basica de margem
- espaco para sofisticacao futura sem retrabalho conceitual
