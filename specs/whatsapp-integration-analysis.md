# WhatsApp no Lead Flow: análise de implementação e modelo de cobrança

## 1. Objetivo

Este documento compara duas alternativas de integração com WhatsApp para o Lead Flow:

1. **Evolution API / Evo**: integração auto-hospedada, normalmente conectada via QR Code e WhatsApp Web/multidevice.
2. **API Oficial WhatsApp / BSP**: WhatsApp Business Platform via Meta Cloud API ou provedores oficiais, como Sent.dm, Twilio, Zenvia, 360dialog ou similares.

A análise considera que o módulo será vendido como um **recurso contratado por time**, com configuração de número no nível do time e uso compartilhado pelos operadores.

---

## 2. Premissas de produto

- O Lead Flow atende times comerciais, especialmente corretores e operações que fazem atendimento e follow-up de leads.
- O WhatsApp é um canal crítico para envio de cotações, lembretes, recuperação de leads e atendimento consultivo.
- O modelo mais simples e escalável para o produto é **1 número por time**, não 1 número por operador.
- Operadores diferentes podem enviar mensagens pelo mesmo número, desde que o sistema registre internamente quem fez cada envio.
- A cobrança precisa ser previsível para o cliente, mas também proteger a margem do Lead Flow contra alto volume, suporte e custos variáveis da API oficial.

---

## 3. Configuração recomendada: número por time

A recomendação é configurar o WhatsApp no nível do time:

```txt
1 time = 1 configuração WhatsApp = 1 número principal conectado
```

Exemplo:

```txt
Time: Corretora Saúde ABC
Manager: João
Operadores: Maria, Pedro e Lucas
WhatsApp do time: +55 11 99999-9999
```

Todos os operadores usam o mesmo número dentro do Lead Flow, mas cada mensagem enviada deve guardar o usuário responsável.

### 3.1. Por que não começar com um número por operador

Um número por operador aumenta muito a complexidade operacional:

```txt
10 operadores = 10 números
10 conexões
10 QR Codes ou 10 phoneNumberIds
10 pontos de falha
10 fontes de cobrança
10 rotinas de suporte
```

Para MVP e primeira versão paga, isso gera mais custo e suporte do que valor percebido.

### 3.2. Modelo conceitual de dados

```txt
Team
 └── WhatsAppConfig
      ├── provider: EVOLUTION | OFFICIAL
      ├── phoneNumber
      ├── status: CONNECTED | DISCONNECTED | PENDING | BANNED | ERROR
      ├── instanceId          // Evolution
      ├── wabaId              // API oficial
      ├── phoneNumberId       // API oficial
      ├── webhookSecret
      ├── connectedAt
      ├── disconnectedAt
      └── billingEnabled
```

Mensagens:

```txt
WhatsAppMessage
 ├── teamId
 ├── leadId
 ├── conversationId
 ├── direction: INBOUND | OUTBOUND
 ├── sentByUserId
 ├── providerMessageId
 ├── messageType
 ├── category
 ├── status
 ├── deliveredAt
 ├── readAt
 └── costAmount
```

Esse desenho permite:

- Cobrar por time.
- Auditar por operador.
- Exibir histórico por lead.
- Medir produtividade por usuário.
- Trocar de provider no futuro sem redesenhar a experiência principal.

---

## 4. Implementação 1: Evolution API

A Evolution API é uma alternativa rápida para MVP porque permite conectar um número do cliente via QR Code, de forma parecida com o uso do WhatsApp Web/multidevice.

### 4.1. Fluxo de configuração no Lead Flow

```txt
1. Manager acessa Configurações > Integrações > WhatsApp.
2. Clica em "Conectar WhatsApp".
3. O Lead Flow cria uma instância Evolution para o teamId.
4. A Evolution API retorna um QR Code.
5. O manager escaneia o QR Code com o WhatsApp Business.
6. O número fica vinculado ao time.
7. Webhooks passam a alimentar conversas, status e eventos no Lead Flow.
```

Exemplo de configuração:

```txt
teamId: team_abc123
provider: EVOLUTION
instanceName: team_abc123
phoneNumber: +55 11 99999-9999
status: CONNECTED
```

### 4.2. Prós da Evolution API

| Critério | Avaliação |
|---|---|
| Velocidade de implementação | Alta. Boa para MVP e validação rápida. |
| Custo variável por mensagem | Baixo ou inexistente do ponto de vista de Meta/BSP. |
| Templates obrigatórios | Não exige aprovação prévia de templates. |
| Onboarding do cliente | Simples: conectar escaneando QR Code. |
| Flexibilidade | Permite envio de texto, mídia, áudio, arquivos e eventos via webhook. |
| Custo inicial | Baixo: VPS, Docker, banco, Redis, backup e monitoramento. |
| Aprendizado de produto | Ajuda a validar demanda antes de investir em API oficial. |

### 4.3. Contras da Evolution API

| Critério | Risco |
|---|---|
| Canal não oficial | Existe risco de bloqueio, limitação ou instabilidade. |
| QR Code | Cliente precisa conectar e, eventualmente, reconectar. |
| Sessões instáveis | Sessões podem cair por troca de aparelho, logout, instabilidade ou atualização do WhatsApp. |
| Suporte operacional | Aumenta chamados como "meu WhatsApp desconectou". |
| Escalabilidade | Muitas instâncias exigem orquestração, monitoramento e isolamento. |
| Risco comercial | Se o número principal do cliente for bloqueado, o impacto percebido é alto. |
| Compliance | Menos adequado para clientes maiores ou operações mais formais. |

### 4.4. Quando usar Evolution API

A Evolution API faz sentido quando:

- O objetivo é lançar um MVP rápido.
- O cliente aceita usar um número secundário.
- O volume é baixo ou médio.
- O uso principal é atendimento 1:1, não disparo em massa.
- O cliente entende o risco de desconexão e possível bloqueio.
- O Lead Flow ainda está validando o valor da funcionalidade.

### 4.5. Cuidados comerciais ao usar Evolution

Não vender como “WhatsApp oficial”. A comunicação deve ser clara:

```txt
Este modo usa conexão via QR Code/multidevice. Pode haver desconexões,
necessidade de reconectar o QR Code e risco de bloqueio do número pelo WhatsApp.
```

Também não é recomendado vender como “ilimitado absoluto”. O melhor é trabalhar com política de uso justo.

---

## 5. Implementação 2: API Oficial WhatsApp / BSP

A API oficial usa a WhatsApp Business Platform da Meta, diretamente via Cloud API ou por meio de um BSP. É a alternativa mais segura e adequada para produto maduro.

### 5.1. Fluxo de configuração no Lead Flow

```txt
1. Manager acessa Configurações > Integrações > WhatsApp Oficial.
2. Inicia onboarding via Meta ou BSP.
3. Cliente conecta ou cria Business Manager.
4. Cliente cria ou vincula uma WABA.
5. Cliente registra o número.
6. Templates são criados e aprovados quando necessário.
7. Lead Flow recebe WABA ID e Phone Number ID.
8. Webhooks oficiais passam a alimentar conversas, status e custos.
```

Exemplo de configuração:

```txt
teamId: team_abc123
provider: OFFICIAL
wabaId: 123456789
phoneNumberId: 987654321
phoneNumber: +55 11 99999-9999
status: APPROVED
```

### 5.2. Prós da API Oficial

| Critério | Avaliação |
|---|---|
| Canal oficial | Baixo risco de bloqueio quando usado corretamente. |
| Confiabilidade | Menor dependência de sessão de celular ou QR Code. |
| Escalabilidade | Melhor para muitos clientes, alto volume e automações. |
| Profissionalização | Número fica vinculado a estrutura empresarial/WABA. |
| Mensagens proativas | Permite envio fora da janela de atendimento usando templates aprovados. |
| Auditoria de cobrança | Melhor base para conciliar custos por mensagem, categoria e status. |
| Produto maduro | Mais adequado para clientes que usam o número principal como ativo crítico. |

### 5.3. Contras da API Oficial

| Critério | Impacto |
|---|---|
| Onboarding | Mais burocrático: Business Manager, WABA, número e permissões. |
| Templates | Mensagens ativas fora da janela exigem templates aprovados. |
| Custo variável | Marketing, utility e authentication podem gerar custo por mensagem entregue. |
| Explicação comercial | Cliente precisa entender consumo, janela de 24h e categorias. |
| Tempo de implantação | Pode levar dias ou semanas, dependendo de verificação e aprovação. |
| Dependência de BSP | Provedor pode ter taxa própria, regras, SLA e modelo comercial específicos. |

### 5.4. Quando usar API Oficial

A API oficial faz sentido quando:

- O cliente usa o número principal do negócio.
- O cliente tem maior volume.
- O Lead Flow quer vender um módulo profissional e confiável.
- Haverá automações e follow-ups fora da janela de atendimento.
- O cliente precisa de menor risco operacional.
- O módulo já foi validado e precisa escalar.

---

## 6. Comparativo direto

| Critério | Evolution API | API Oficial / BSP |
|---|---:|---:|
| Velocidade para MVP | Alta | Média/baixa |
| Custo inicial | Baixo | Médio |
| Custo por mensagem | Sem custo Meta direto | Variável por categoria |
| Risco de bloqueio | Médio/alto | Baixo |
| Templates obrigatórios | Não | Sim, fora da janela de atendimento |
| QR Code | Sim | Não no uso maduro |
| Infra própria | Sim | Pouca ou nenhuma, dependendo do BSP |
| Suporte operacional | Alto | Médio/baixo |
| Escalabilidade | Média | Alta |
| Confiabilidade | Variável | Alta |
| Recomendado para número principal | Não | Sim |
| Recomendado para MVP | Sim | Depende |
| Recomendado para produto maduro | Não como única opção | Sim |

---

## 7. Recomendação técnica

A melhor estratégia não é escolher apenas uma opção para sempre. A recomendação é evoluir por fases.

### 7.1. Fase 1: MVP

Usar **Evolution API**.

Objetivos:

- Lançar rápido.
- Validar uso real.
- Medir volume médio por time.
- Entender impacto em conversão.
- Medir carga de suporte.
- Descobrir se clientes aceitam pagar pelo módulo.

Condição:

```txt
Evolution deve ser vendida como modo beta/básico, com aviso claro de risco.
```

### 7.2. Fase 2: versão paga estável

Oferecer dois níveis:

```txt
WhatsApp Básico = Evolution API
WhatsApp Oficial = API Oficial / BSP
```

Assim, clientes pequenos podem começar barato e clientes que usam número principal podem contratar o modo oficial.

### 7.3. Fase 3: produto maduro

Tornar a API Oficial o caminho recomendado e manter a Evolution apenas para:

- Clientes beta.
- Casos específicos.
- Clientes pequenos que aceitam o risco.
- Testes internos.

---

## 8. Modelo de cobrança recomendado

A cobrança deve ser pensada em três blocos:

```txt
Mensalidade do módulo por time
+ consumo variável, quando houver
+ adicionais
```

---

## 9. Bloco 1: mensalidade do módulo por time

A mensalidade cobre o valor do produto, não apenas o custo técnico da API.

Ela remunera:

- Interface de conversas.
- Histórico no CRM.
- Integração com leads.
- Envio por operadores.
- Webhooks.
- Automações.
- Logs.
- Monitoramento.
- Suporte.
- Manutenção.
- Segurança.
- Infraestrutura.
- Margem do Lead Flow.

Faixa sugerida:

```txt
Módulo WhatsApp: R$ 99 a R$ 299 por time/mês
```

---

## 10. Bloco 2: consumo variável

### 10.1. Consumo na Evolution API

Na Evolution, a recomendação inicial é não cobrar por mensagem individual. O modelo mais simples é:

```txt
Mensalidade fixa por time
+ política de uso justo
```

Exemplo:

```txt
R$ 99/mês por time
Inclui 1 número conectado
Inclui até 2.000 mensagens enviadas/mês
```

Acima do uso justo:

```txt
Migrar para plano superior, reduzir automações ou migrar para API oficial.
```

### 10.2. Consumo na API Oficial

Na API oficial, o correto é repassar o custo variável.

Fórmula:

```txt
Total do time =
mensalidade do módulo
+ mensagens marketing entregues × tarifa marketing
+ mensagens utility cobradas × tarifa utility
+ mensagens authentication entregues × tarifa authentication
+ taxas do BSP
+ taxa administrativa do Lead Flow
```

A cobrança deve ser baseada em evento de cobrança/entrega retornado pelo provider, e não simplesmente no clique em “enviar”.

---

## 11. Bloco 3: adicionais

| Adicional | Sugestão |
|---|---:|
| Número adicional Evolution | R$ 49 a R$ 99/mês |
| Número adicional oficial | R$ 99 a R$ 149/mês + consumo |
| Setup assistido oficial | R$ 299 a R$ 999 único |
| Pacote de templates personalizados | R$ 49 a R$ 199 |
| Volume alto | Sob consulta |
| Disparos/campanhas | Plano separado |

---

## 12. Planos sugeridos

### 12.1. Modelo simples para MVP

| Plano | Preço | Inclui | Provider |
|---|---:|---|---|
| WhatsApp Beta | R$ 99/time/mês | 1 número, uso justo, QR Code | Evolution |
| WhatsApp Pro | R$ 199/time/mês + consumo | 1 número oficial, histórico e automações | Oficial/BSP |
| Número adicional | R$ 49 a R$ 99/mês | Número extra | Depende |

### 12.2. Modelo mais maduro

| Plano | Preço | Inclui |
|---|---:|---|
| WhatsApp Básico | R$ 99/mês | Evolution, 1 número, até 2.000 mensagens/mês |
| WhatsApp Oficial | R$ 199/mês + consumo | API oficial, 1 número, cobrança por uso |
| WhatsApp Oficial Plus | R$ 299/mês + consumo | API oficial, automações, templates e relatórios |
| Número adicional | R$ 99/mês | Por número extra |

### 12.3. Modelo com créditos inclusos

Este é o modelo comercialmente mais fácil de vender:

```txt
WhatsApp Oficial Pro
R$ 299/time/mês
Inclui R$ 50 em créditos de mensagens oficiais
Excedente cobrado conforme uso
```

Exemplo:

```txt
Mensalidade: R$ 299
Créditos inclusos: R$ 50
Consumo do mês: R$ 72
Excedente: R$ 22
Taxa administrativa sobre excedente: 20%
Total adicional: R$ 26,40
Total da fatura: R$ 325,40
```

---

## 13. Exemplo de cálculo na API Oficial

Exemplo hipotético para um time em um mês:

```txt
600 mensagens utility cobradas
80 mensagens marketing
0 mensagens authentication
1.200 mensagens service dentro da janela de 24h
```

Valores ilustrativos em USD:

```txt
Utility: US$ 0.00782
Marketing: US$ 0.07188
Authentication: US$ 0.00782
Service: US$ 0.00
```

Cálculo:

```txt
Utility:
600 × US$ 0.00782 = US$ 4.692

Marketing:
80 × US$ 0.07188 = US$ 5.7504

Subtotal:
US$ 10.4424
```

Com câmbio hipotético de R$ 5,30:

```txt
US$ 10.4424 × 5,30 = R$ 55,35
```

Se o Lead Flow cobrar:

```txt
Mensalidade do módulo: R$ 199
Taxa administrativa sobre consumo: 25%
```

Então:

```txt
Consumo oficial: R$ 55,35
Taxa administrativa: R$ 13,84
Total variável: R$ 69,19

Total do mês:
R$ 199 + R$ 69,19 = R$ 268,19
```

> Observação: valores reais devem vir da tabela vigente da Meta ou do BSP contratado, pois podem variar por país, moeda, categoria, contrato, data e provedor.

---

## 14. Política de uso justo para Evolution

Mesmo que a Evolution não tenha custo oficial por mensagem, não é recomendável vender como “ilimitado absoluto”.

Sugestão:

```txt
Inclui uso justo de até 2.000 mensagens enviadas por mês por time.
```

Motivos:

- Evita uso como ferramenta de disparo em massa.
- Reduz risco de bloqueio.
- Protege infraestrutura.
- Protege suporte.
- Cria gatilho natural para migração para API oficial.

Faixas possíveis:

| Faixa | Uso |
|---|---:|
| Pequeno time | Até 1.000 mensagens/mês |
| Uso normal | Até 2.000 mensagens/mês |
| Uso alto | 2.000 a 5.000 mensagens/mês |
| Acima disso | Plano oficial ou sob consulta |

---

## 15. Tela de cobrança sugerida

Criar uma tela em:

```txt
Configurações > WhatsApp > Consumo
```

Exemplo:

```txt
Período: Junho/2026

Plano:
WhatsApp Oficial Pro — R$ 299/mês

Número:
+55 11 99999-9999

Uso:
Service: 1.240 mensagens — R$ 0,00
Utility: 420 mensagens — R$ 17,40
Marketing: 80 mensagens — R$ 32,80
Authentication: 0 mensagens — R$ 0,00

Créditos inclusos:
R$ 50,00

Consumo bruto:
R$ 50,20

Excedente:
R$ 0,20

Total estimado:
R$ 299,20
```

Essa tela reduz atrito comercial porque deixa claro o que é mensalidade, o que é consumo e o que é excedente.

---

## 16. Dados necessários para faturamento correto

Para não errar a cobrança, o sistema deve persistir eventos de uso com detalhes suficientes para auditoria.

```txt
WhatsAppUsageEvent
 ├── id
 ├── teamId
 ├── provider
 ├── providerMessageId
 ├── direction
 ├── category
 ├── countryCode
 ├── pricingModel
 ├── billable
 ├── currency
 ├── unitCost
 ├── providerFee
 ├── totalCost
 ├── deliveredAt
 ├── invoiceMonth
 └── rawPayload
```

Regras importantes:

1. Não cobrar no momento do clique em enviar.
2. Cobrar quando houver confirmação de entrega/cobrança do provider.
3. Guardar o payload bruto do webhook para auditoria.
4. Usar idempotência para não duplicar cobrança.
5. Separar custo Meta/BSP da mensalidade Lead Flow.

Chave de idempotência sugerida:

```txt
teamId + providerMessageId + billingEventType
```

---

## 17. Recomendação comercial final

### 17.1. Lançamento inicial

```txt
WhatsApp Básico — Evolution
R$ 99/time/mês
1 número conectado
Uso justo de 2.000 mensagens/mês
```

Bom para validar rapidamente e gerar aprendizado real de uso.

### 17.2. Depois da validação

```txt
WhatsApp Oficial
R$ 199/time/mês
+ consumo oficial
+ taxa administrativa de 20% a 30%
```

Bom para clientes que usam o número principal e precisam de mais segurança.

### 17.3. Plano premium recomendado

```txt
WhatsApp Oficial Pro
R$ 299/time/mês
Inclui R$ 50 em créditos de mensagens
Excedente conforme uso
Templates e suporte assistido inclusos
```

Este tende a ser o plano com melhor equilíbrio entre previsibilidade para o cliente e margem para o Lead Flow.

---

## 18. Resumo executivo

| Cenário | Provider recomendado | Cobrança recomendada |
|---|---|---|
| MVP e validação | Evolution API | R$ 99/time/mês com uso justo |
| Cliente pequeno | Evolution API | R$ 99 a R$ 149/time/mês |
| Cliente usa número principal | API Oficial/BSP | R$ 199 a R$ 299/time/mês + consumo |
| Cliente quer previsibilidade | API Oficial com créditos | R$ 299/time/mês incluindo créditos |
| Múltiplos números | Evolution ou Oficial | Mensalidade por número adicional |
| Alto volume/disparo | API Oficial/BSP | Sob consulta |

Recomendação final:

```txt
Configuração:
1 número por time, compartilhado pelos operadores.

MVP:
Evolution API por R$ 99/time/mês com política de uso justo.

Produto maduro:
API Oficial por R$ 199 a R$ 299/time/mês + consumo oficial.

Melhor modelo comercial:
R$ 299/time/mês incluindo R$ 50 de créditos de mensagens,
com excedente cobrado conforme uso.
```

Em uma frase:

> A Evolution API é melhor para lançar rápido e barato; a API oficial é melhor para vender confiança, proteger o número do cliente e escalar o módulo como produto maduro.

---

## 19. Referências úteis

- [Evolution API — Instances Overview](https://docs.evoapicloud.com/instances/overview)
- [Evolution API — Docker Hub](https://hub.docker.com/r/atendai/evolution-api)
- [Meta for Developers — WhatsApp Business Platform Pricing](https://developers.facebook.com/docs/whatsapp/pricing/)
- [Gupshup — Pricing updates on the WhatsApp Business Platform](https://docs.gupshup.io/docs/pricing-updates-on-the-whatsapp-business-platform)
- [SleekFlow — WhatsApp Business API Pricing](https://help.sleekflow.io/en_US/whatsapp/pricing)
- [Vonage — 24-Hour Customer Care Window](https://api.support.vonage.com/hc/en-us/articles/23794412588572-What-is-the-24-Hour-Customer-Care-Window)
