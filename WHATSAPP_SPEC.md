# SPEC — WhatsApp Inbox de Leads por Time

**Versão:** 2.1 · **Atualizada:** 2026-07-20 · **Status:** SPEC viva; implementação registrada por commit na worktree `feat/whatsapp-inbox-v2-closure`.

## Registro de implementação

| Data | Fase | Status | Implementado | Decisão e limite conhecido |
|---|---|---|---|---|
| 2026-07-20 | V2.1 | Concluída | Cron de outbox, recuperação de `PROCESSING` abandonado, auditoria de handoff e fluxo único de microfone com o mesmo `MediaStream`. | O cron executa a cada 5 minutos e não altera permissões do navegador. |
| 2026-07-20 | V2.2 | Em implementação | Retry agendado com backoff, concorrência limitada a 10, `UNKNOWN` para comando sem confirmação, reprocessamento auditado de dead-letter. | A Evolution continua sendo a fonte de confirmação; `UNKNOWN` não é reenviado automaticamente. |
| 2026-07-20 | V2.2 | Pendente | Purge de mídia/mensagens após 90 dias e limpeza de payload legado. | Depende de cron dedicado e validação de storage local antes de ativação. |
| 2026-07-20 | V2.3–V2.5 | Pendente | Filas, explicabilidade, documentação contextual, painel, alertas e rollout. | Nenhum item pendente é anunciado como disponível na documentação do produto. |
| 2026-07-20 | V2.4 | Concluída parcialmente | Links contextuais do Inbox, Configurações e Auto-respostas para capítulos diretos; revisão de conteúdo que prometia simulação e purge ainda indisponíveis. | FAQ de filas, `UNKNOWN` e microfone será ampliado junto às respectivas entregas funcionais. |

### Contratos adicionados em V2.2

- `whatsapp_webhook_events.nextAttemptAt` e `processingStartedAt` controlam o retry e a recuperação de processamento interrompido.
- `whatsapp_outbound_commands.reconciledAt` registra a transição automática de `PENDING` para `UNKNOWN` após dez minutos sem confirmação.
- `POST /api/v1/teams/:teamId/whatsapp/webhook-events/:eventId/requeue` exige gestor, aceita somente eventos `DEAD_LETTER` do próprio time e cria auditoria `webhook.dead_letter.requeue`.
- A migration `20260720210000_whatsapp_outbox_reliability.sql` não cria tabela exposta nem grants; as tabelas permanecem acessadas pelo servidor.

Este é o documento canônico do módulo WhatsApp. Ele substitui os estágios anteriores como plano de execução: descreve o que já existe, as lacunas verificadas e a ordem obrigatória para evoluir o produto sem regredir segurança, confiabilidade ou fluidez.

## 1. Objetivo de produto

Entregar um inbox operacional de WhatsApp para times de vendas: rápido, claro e seguro para atender leads, associar conversas ao CRM, usar automações sem conflito com humanos e operar em desktop ou mobile.

O padrão de experiência é o de um mensageiro profissional — familiar e direto — e não uma cópia visual do WhatsApp. O Corretor Studio mantém seus próprios tokens, componentes e identidade visual.

### Resultados mensuráveis

- 100% das conversas individuais com telefone conhecido mostram nome ou número; zero uso de `Contato` como identidade.
- Nenhum prompt/banner de microfone aparece antes de a pessoa tocar em gravar.
- Mensagem manual nunca recebe uma auto-resposta concorrente depois do envio.
- Nenhum envio duplicado por retry do usuário ou timeout ambíguo.
- 99,9% dos webhooks aceitos são persistidos ou encaminhados para processamento durável; falhas são rastreáveis.
- API e Realtime aplicam a mesma regra de visibilidade, coberta por teste de paridade.

## 2. Escopo e não escopo

### Incluído

- Inbox, lista, conversa, composição de texto, mídia, áudio e leitura.
- Configuração de instância, histórico, contatos, grupos, tags e auto-respostas.
- Webhook Evolution, provider, persistência, RLS, Realtime, observabilidade e backoffice operacional.
- Integração com Lead/CDP, atribuição, handoff e atividades.

### Fora do escopo

- Copiar integralmente a interface, marcas ou ativos proprietários do WhatsApp.
- Escrever contatos na agenda do celular: a Evolution/Baileys não oferece essa capacidade.
- Fazer Bethânia interceptar o inbox de leads. A instância dela é separada e o acoplamento só pode ocorrer por contrato explícito futuro.
- Migrar para Meta Cloud API nesta entrega. A arquitetura deve, porém, manter o caminho aberto.

## 3. Auditoria consolidada

### Método e cobertura

- Leitura de rotas, use cases, serviços, repositório, schema Prisma, migrations, RLS e hooks da feature.
- Auditoria visual baseada na captura fornecida e nos componentes do inbox.
- Execução de 56 testes WhatsApp/Evolution em 16 arquivos: todos passaram.
- Auditoria estática de acessibilidade/design nos componentes do inbox: sem achados automáticos; os problemas abaixo foram confirmados por leitura e fluxo.

### Inventário atual

| Domínio | Estado atual verificado |
|---|---|
| Configuração e multi-tenancy | Uma configuração por time; espelhamento controlado entre times do mesmo master; política de telefone e QR/reconnect. |
| Webhook | Endpoint por segredo, header adicional com rollout, validação estrutural, idempotência por IDs do provider e alerta de falhas consecutivas. |
| Persistência | Conversas, mensagens, uso, regras, logs, contatos e tags com FKs/índices; RLS para conversas e mensagens no Realtime. |
| RBAC | Master/manager veem o time; operator vê suas conversas e não atribuídas. Regra TypeScript e SQL possuem teste de paridade. |
| Atendimento | Texto, mídia, áudio, status, read receipt, atribuição, handoff, arquivar, excluir, lead vinculado/criado e card de lead. |
| Automação | Regras de boas-vindas, fora do horário e palavra-chave; CAS/log idempotente; envio humano assume handoff. |
| UI | Inbox, configurações e auto-respostas no padrão `features/`; Realtime e fallback de polling. |
| Testes | Boa cobertura de helpers e casos de use case; não há cobertura UI, acessibilidade automatizada ou fluxo E2E completo. |

### Saúde do módulo

| Dimensão | Nota | Diagnóstico |
|---|---:|---|
| Segurança e isolamento | 3/4 | RBAC/RLS e webhook header existem; retenção de payload e auditoria destrutiva precisam endurecimento. |
| Confiabilidade | 2/4 | Idempotência inbound é boa; envio outbound e efeitos pós-webhook ainda não são duráveis end-to-end. |
| UX e acessibilidade | 2/4 | Fluxos funcionam, mas identidade, microfone, rolagem, targets e mobile causam fricção. |
| Performance e escala | 2/4 | Realtime foi corrigido; hook monolítico, mídia Base64 no banco e paginação/recuperação precisam evolução. |
| Manutenibilidade | 2/4 | Camadas existem; `WhatsAppInboxHook` (1812 linhas), serviço (1079) e processador de webhook (892) concentram responsabilidades. |
| **Total** | **11/20** | Base viável, mas exige as fases 0–2 antes de expansão comercial. |

### Achados priorizados

| Prioridade | Achado factual | Impacto |
|---|---|---|
| P0 | Não há P0 confirmado no fluxo básico de texto. | — |
| P1 | `whatsappDisplay.ts` e `contact-name.ts` retornam `Contato`/`Contato vinculado` para `@lid` ou fallback. | Atendente não identifica o cliente apesar de telefone sincronizado. |
| P1 | `MessageComposer` renderiza alerta de microfone nos estados `prompt` e `unknown`. | Erro visual e CTA enganoso antes de qualquer intenção de gravar. |
| P1 | Envio chama o provider antes de persistir a mensagem, sem chave de idempotência do comando. | Timeout/erro após entrega pode induzir retry e duplicar uma mensagem. |
| P1 | Mídia outbound é colocada em `rawPayload.outboundMedia.base64`. | Dados sensíveis e grandes no banco; custo, retenção e superfície de vazamento desnecessários. |
| P1 | Webhook executa CDP, automação e efeitos no request síncrono. | Um efeito lento/transitório pode resultar em timeout/retry e operação difícil de recuperar. |
| P1 | Layout mantém lista e painel comprimidos sem modo mobile; rolagem vai ao fim em toda alteração de `messages`. | Uso em celular quebra e leitura de histórico é interrompida. |
| P1 | A barra de gravação renderiza 56 colunas com largura mínima de 1 px, raio total e nível inicial fixo `0.08`. | Sem variação perceptível de volume, a forma de onda aparece como uma fileira de bolinhas, sem feedback de captação. |
| P2 | Ícones do compositor usam 32–40 px; filtros não expõem `aria-pressed`; há `dark:` local. | Não atende a área mínima de toque nem a consistência do design system. |
| P2 | Delete é hard delete com apenas `console.info`; `rawPayload` não tem política explícita de retenção. | Auditoria e privacidade insuficientes para operação madura. |
| P2 | Sem testes de UI/E2E/contrato de webhook e sem testes de regressão visual. | Regressões de atendimento chegam ao usuário. |
| P2 | Hook/contexto e serviços excessivamente grandes; componente de tags faz fetch direto. | Maior risco de corrida, difícil revisão e quebra do padrão de camadas. |

### Pontos fortes a preservar

- Separação Route → UseCase → Service → Repository e contrato `Output` no backend.
- Idempotência inbound por `providerMessageId`/`providerEventId`, healing de redelivery e logs CAS de auto-resposta.
- Provider `IWhatsAppProvider` e implementação Evolution já isolada.
- Handoff humano no envio manual e controles de atribuição.
- Paridade de visibilidade TypeScript × RLS já testada.
- Realtime baseado no estado real do canal, sem heurística de “staleness”.

## 4. Contratos e decisões permanentes

### 4.1 Identidade do contato

Para conversa individual e LID, a regra única é:

1. `contactName` válido, respeitando a precedência `MANUAL > LEAD > PHONE_BOOK > PUSH_NAME`.
2. `formatDisplayPhone(contactPhone)` quando houver número válido — por exemplo, `11939534668` é exibido como `(11) 93953-4668`.
3. `Número não disponível` quando nenhum identificador utilizável foi sincronizado.

`Contato` e `Contato vinculado` são proibidos como fallback. Grupo preserva nome do grupo ou `Grupo`. Lista, cabeçalho, avatar e busca devem consumir o mesmo helper puro de identidade.

### 4.2 Handoff e atribuição

- `BOT` permite auto-respostas; `HUMAN` as bloqueia.
- Primeiro envio humano muda `BOT → HUMAN` e atribui a conversa ao remetente se estiver sem responsável.
- “Devolver ao bot” preserva o responsável e somente muda o modo.
- Auto-resposta nunca sobrescreve conversa `HUMAN` e não deve ser acionada por mensagem outbound.

### 4.3 Visibilidade e autorização

- Master e manager: todas as conversas do time.
- Operator: atribuídas a ele, sem responsável, ou vinculadas aos seus leads conforme regra existente.
- Toda mutação consulta `assertCanAccessConversation`; a evolução de visibilidade deve alterar TypeScript, RLS e teste de paridade na mesma PR.
- Não decidir autorização por `user_metadata`; manter identidade e papel server-side.

### 4.4 Dados e privacidade

- Arquivo de mídia deve ficar em storage privado; banco guarda metadados, chave de storage, hash, tamanho e MIME — nunca Base64.
- `rawPayload` é para metadados mínimos de reconciliação, com sanitização e allowlist. Segredos, QR, áudio/imagem e conteúdo redundante são removidos.
- Mídia é servida por URL assinada curta, verificada pelo mesmo acesso da conversa.
- Excluir conversa vira soft delete com trilha de auditoria; purge definitivo é job com retenção aprovada por produto/jurídico.

### 4.5 Integrações externas

| Integração | Onde implementar | Contrato |
|---|---|---|
| Evolution API | `app/api/services/whatsapp/provider/EvolutionWhatsAppProvider.ts` e cliente `evo/` | Implementa `IWhatsAppProvider`; nenhum componente/UI chama Evolution. |
| Meta Cloud API futura | Nova implementação de `IWhatsAppProvider` | Mesmo contrato neutro; migração por config de provider, sem bifurcar o domínio. |
| Supabase Postgres/Realtime/Storage | Prisma + migrations em `supabase/migrations` + RLS | RLS em toda tabela exposta; migration local primeiro; não aplicar remoto sem autorização. |
| CDP/Lead | Use cases de sync e atividade | Efeito assíncrono idempotente por evento de domínio. |
| Sentry/observabilidade | Webhook, worker e clientes | IDs técnicos e métricas; nunca conteúdo, Base64, telefone completo ou segredo. |

## 5. Arquitetura-alvo

```text
Evolution / Meta
  → webhook autenticado
  → inbox_event (durável, idempotente)
  → worker de processamento
       → conversa/mensagem/usage
       → outbox: CDP, auto-resposta, mídia, notificação
  → Realtime (RLS) → contexto do inbox → UI

Usuário → API versionada → UseCase → Service/Provider/Repository
        → command idempotente → outbox → provider → reconciliação webhook
```

Regras:

- Rotas somente parseiam HTTP/autorizam e chamam UseCase; não usam Prisma diretamente.
- Provider não conhece RBAC, tela ou regras de lead.
- A confirmação do provider e a persistência local são reconciliáveis; não se assume transação distribuída.
- Migrations são geradas pela ferramenta do projeto, revisadas e testadas localmente. RLS deve incluir `SELECT`, `USING` e `WITH CHECK` quando aplicável.

## 6. Roadmap de implementação

Cada fase só inicia após os critérios da anterior. Mudanças devem ser pequenas, reversíveis por feature flag quando afetarem webhook/envio e acompanhadas de Postman/contratos de API quando criarem endpoints.

### Fase 0 — Segurança, dados e confiabilidade de envio (bloqueadora)

**Objetivo:** eliminar duplicidade outbound, conteúdo sensível persistido e efeitos críticos sem recuperação.

1. **Comando de envio idempotente.**
   - Adicionar `clientMessageId` UUID no POST de mensagens, gerado no cliente antes do primeiro request e reutilizado nos retries.
   - Criar `WhatsAppOutboundCommand` ou campos equivalentes com unique `(teamId, clientMessageId)`, estado `PENDING|SENT|UNKNOWN|FAILED`, tentativa, erro seguro e `providerMessageId`.
   - Persistir comando `PENDING` antes da chamada externa. Reuso do mesmo ID retorna o resultado já conhecido; `UNKNOWN` mostra “confirme no histórico antes de reenviar”, nunca reenvia automaticamente.
   - Webhook outbound associa `providerMessageId`, atualiza comando e mensagem; cron/worker reconcilia `PENDING/UNKNOWN` por prazo configurado.
2. **Mídia privada fora do banco.**
   - Criar bucket privado `whatsapp-media` e prefixo `teamId/conversationId/messageId`.
   - Upload server-side ou URL assinada de upload; validar tipo, tamanho, duração e hash antes do provider.
   - Remover `outboundMedia.base64` de `rawPayload`; migration de limpeza para registros existentes com estratégia aprovada de retenção.
   - Endpoint de mídia devolve URL assinada de curta duração, apenas após `assertCanAccessConversation`.
3. **Webhook/outbox durável.**
   - Persistir envelope normalizado em tabela de eventos idempotente antes de CDP, automação, download de mídia e alertas.
   - Responder 200 após persistência de evento válido; worker consome com lock, tentativas exponenciais, dead-letter e chave de deduplicação.
   - Eventos estruturalmente inválidos retornam 200 `{ processed: false }` para evitar loop; falhas transitórias permanecem rastreáveis e reprocessáveis.
4. **Segredos e auditoria.**
   - Ativar enforcement do header do webhook por configuração graduada, monitorar instâncias legadas e rotacionar segredo.
   - Criar audit trail persistente para arquivar, excluir/restaurar, atribuir, handoff, vínculo de lead e alteração de regra.
   - Reavaliar todas as políticas RLS e grants com advisor antes de deploy.

**Aceite:** retry de uma mensagem não duplica envio; falha após provider não perde rastreabilidade; nenhuma nova mídia Base64 entra no Postgres; webhook pode ser reprocessado sem efeitos duplicados.

### Fase 1 — Inbox perfeito e acessível (bloqueadora de UX)

**Objetivo:** tornar o atendimento fluido em desktop e mobile.

1. **Identidade única.**
   - Unificar `resolveDisplayName` e `getConversationDisplayName` em helper único e remover fallback genérico duplicado.
   - Cabeçalho/lista mostram `(11) 93953-4668` para o número de exemplo sem nome; LID com número segue a mesma regra.
   - Avatar usa o título resolvido; subtítulo exibe telefone apenas quando há nome, ou `WhatsApp` quando o telefone já é título.
2. **Microfone just-in-time.**
   - Nenhum alerta para `prompt` ou estado desconhecido ao abrir a conversa.
   - Clique em “Gravar áudio” solicita `getUserMedia` no mesmo gesto; permitir inicia gravação.
   - Criar um único fluxo `requestMicrophoneAndStart` no `MessageComposer`: a primeira instrução executada pelo `onClick` deve ser `navigator.mediaDevices.getUserMedia({ audio: true })`, sem `setTimeout`, `requestAnimationFrame`, `useEffect`, Popover, toast ou nova interação intermediária. Somente depois do `MediaStream` concedido o gravador recebe o stream e inicia `MediaRecorder`.
   - O hook do gravador passa a aceitar `startWithStream(stream)`; ele não pode abrir uma segunda solicitação de permissão. Remover o fluxo paralelo `handleRequestMicrophone` que abre o prompt, fecha os tracks e exige um segundo toque para gravar.
   - A consulta passiva a `navigator.permissions` é apenas informativa e não pode bloquear, desabilitar ou substituir a solicitação pelo clique. Navegadores sem Permissions API seguem diretamente pelo `getUserMedia`.
   - `denied`/`NotAllowedError` exibe callout compacto e dispensável: “O microfone está bloqueado neste navegador.” + “Como liberar”.
   - Dialog acessível ensina permissões de site por browser; não promete abrir/reverter configurações automaticamente.
   - Assinar `PermissionStatus.onchange` quando houver suporte e limpar o aviso após liberação.
3. **Estrutura responsiva.**
   - Desktop: lista 288–368 px, painel `minmax(0,1fr)`, rolagem independente e divisor único.
   - Mobile: lista **ou** conversa; seleção abre painel integral e botão Voltar restaura a lista sem refetch.
   - Usar `100dvh` respeitando o header; cabeçalho e compositor ficam fixos no painel.
   - Recolher ações secundárias em menu em largura insuficiente; status de conexão compacto, com texto para leitor de tela.
4. **Compositor e rolagem.**
   - Anexar, emoji, gravar, enviar, pausar e cancelar têm área de 44 × 44 px, foco visível, tooltip/`aria-label` e estado disabled/loading.
   - Filtros usam `aria-pressed`; não usar `dark:` manual nem cor fora dos tokens.
   - Só rolar ao fim quando usuário estiver a até 80 px do fim ou após envio próprio; caso contrário mostrar “Novas mensagens”.
   - Ao carregar página anterior, preservar a âncora visual.
5. **Forma de onda de gravação.**
   - Substituir a representação atual de colunas arredondadas por barras verticais com largura visual estável (2–3 px), espaçamento de 1–2 px, altura mínima de 2 px e altura máxima proporcional ao RMS normalizado do `AnalyserNode`.
   - Não iniciar todas as barras em `0.08`. O estado ocioso deve ser uma linha discreta de baixa amplitude; durante a captação, aplicar gate de ruído, suavização temporal e ganho limitado para que fala normal ocupe aproximadamente 25–80% da altura disponível, sem “estourar” em 100%.
   - Separar os conceitos de amostra e playhead: a amostra mais recente recebe cor de gravação; as anteriores mantêm contraste legível. Remover a linha vertical que compete visualmente com as barras se não representar um cursor acionável.
   - Atualizar no máximo uma vez por frame e respeitar `prefers-reduced-motion`; quando `AudioContext`/analisador não estiver disponível, exibir temporizador + indicador “Gravando áudio”, sem simular uma onda falsa.
   - Testar o algoritmo puro de normalização com silêncio, fala baixa, fala normal e pico. Validar visualmente em 320 px, 375 px e desktop para confirmar barras — não círculos — e nenhuma perda dos controles de pausar, descartar e enviar.

**Aceite:** em 375 px não há sobreposição; ao primeiro clique em Gravar áudio o prompt nativo do navegador aparece imediatamente e, ao permitir, a barra de gravação abre no mesmo gesto; a voz gera barras de alturas variadas em vez de bolinhas sequenciais; leitura de histórico não salta; todos os controles são navegáveis por teclado e têm alvo mínimo.

### Fase 2 — Operação, automação e dados de CRM

**Objetivo:** tornar o inbox previsível para o time e auditável para gestão.

1. Consolidar hub de configurações: conexão, uso, tags, regras, retenção, permissões operacionais e saúde da instância.
2. Completar lead no chat: criação pré-preenchida, sheet de lead, vínculo/desvínculo com confirmação e atividade idempotente.
3. Criar fila operacional: Não atribuídas, Minhas, Arquivadas, Com bot, Com humano, Sem lead, Falha de envio e filtros de tags.
4. Revisar auto-respostas: prioridade determinística, simulação de regra, pausa por conversa, limite anti-loop e log explicável (“regra X respondeu porque…”).
5. Implementar soft delete/restauração e purge por política de retenção; ocultar conteúdo purgado, manter evento de auditoria mínimo.
6. Extrair o hook de inbox em módulos: consulta/paginação, realtime, mutations otimistas e estado de UI. Nenhum componente faz fetch direto; inclusive tags passam pelo service/context.

**Aceite:** gestor identifica filas e falhas sem consultar logs; atendente controla bot/humano e lead sem sair do chat; exclusão é recuperável dentro da janela definida.

### Fase 3 — Escala, observabilidade e qualidade de entrega

**Objetivo:** operar com segurança sob carga e evitar regressões.

1. Tornar rate limit atômico no banco/Redis transacional; contagem atual por query não pode permitir rajadas concorrentes acima do limite.
2. Adicionar métricas: latência webhook→mensagem, fila/dead-letter, duplicatas evitadas, falha de envio, reconnect, Realtime, mídia, microfone e taxa de fallback de identidade. Dados agregados, sem mensagem/telefone.
3. Painel backoffice: instância, conexão, última entrega, backlog, tentativas, falhas, uso/quota e reprocessamento autorizado por permissão.
4. Criar alertas SLO: webhook com falhas consecutivas, fila atrasada, conexão desconectada, aumento de `UNKNOWN`, erro de RLS/Reatime e quota próxima do limite.
5. Testes: unitários de helpers/estados, integração de UseCases+repository, contrato Evolution, RLS local, Playwright desktop/mobile e acessibilidade (axe). Adicionar teste visual das áreas críticas.
6. Carga: simular webhook duplicado, 30+ envios concorrentes, 1.000 conversas paginadas e reconexão Realtime; registrar limites observados e tuning de índices.

**Aceite:** dashboard mostra a saúde sem dados pessoais; alertas são acionáveis; suites bloqueiam regressões de identidade, áudio, RBAC, idempotência e layout.

### Fase 4 — Providers e recursos avançados (após estabilidade)

1. Implementar Meta Cloud API como `IWhatsAppProvider`, com testes de contrato compartilhados e seleção por config.
2. Definir capacidades por provider (`audio`, `readReceipt`, `historySync`, `contacts`, `groups`) para UI degradar com transparência.
3. Avaliar busca full-text e sumarização somente com consentimento, retenção, redaction e auditoria; Bethânia permanece em fronteira separada até contrato aprovado.

## 7. Matriz de testes obrigatória

| Fluxo | Automação | Manual |
|---|---|---|
| RBAC/RLS | matriz master/manager/operator e paridade SQL × TS | 3 perfis, conversa nova/atribuída/sem responsável. |
| Webhook | assinatura/header, duplicata, payload inválido, retry, dead-letter | reenviar evento real sem duplicar mensagem. |
| Envio | `clientMessageId`, timeout, `UNKNOWN`, limite concorrente | desligar rede após provider e validar reconciliação. |
| Mídia | MIME/tamanho/hash, URL assinada, acesso negado | imagem, documento, áudio e vídeo em desktop/mobile. |
| Handoff/bot | humano bloqueia bot, devolução reativa, CAS | responder sem “assumir”, depois disparar keyword. |
| Identidade | nome, telefone, LID, grupo, indisponível | validar lista/cabeçalho/avatar no número `11939534668`. |
| Microfone | prompt/granted/denied/unsupported | Chrome e Safari/Firefox quando disponíveis. |
| UX | Playwright 375/768/1440, teclado, axe | leitura de histórico, novas mensagens e orientação de tela. |
| Realtime | subscribe/error/reconnect e fallback | duas sessões no mesmo time. |

## 8. Segurança e rollout

1. Toda migration começa localmente e passa por advisor; mudanças remotas requerem autorização explícita.
2. Bucket e tabelas expostas usam RLS e políticas de mínimo privilégio. Nenhuma chave secreta chega ao browser.
3. Feature flags: `whatsapp_outbox_enabled`, `whatsapp_media_storage_v2`, `whatsapp_webhook_header_enforce`, `whatsapp_inbox_v2`.
4. Rollout: ambiente local → staging com replay sanitizado → 5% dos times internos → 25% → 100%, com rollback por flag e plano de reconciliação.
5. Não registrar em logs/Sentry: texto de mensagem, Base64, QR, segredo de webhook, token ou telefone completo.

## 9. Checklist de cada PR

- [ ] Escopo limitado a uma fase/feature flag; sem regressão em handoff, RLS ou idempotência.
- [ ] Rotas novas seguem Route → UseCase → Service → Repository e atualizam Postman.
- [ ] Migration gerada pelo fluxo do projeto, RLS/grants revisados e índices justificados.
- [ ] UI usa shadcn/Lucide/tokens semânticos, Poppins, sem hex/dark manual e com alvos de 44 px.
- [ ] Testes da matriz afetada incluídos; `bun test` focal verde.
- [ ] Validações: `bun run typecheck`, `bun run lint`, `bun run governance:check`, `bun run lint:pt-br`, `bun run design:check` e, quando houver schema, `bun run db:migrate:reset:local`.
- [ ] Métrica, log seguro e plano de rollback definidos para qualquer efeito externo.

## 10. Decisões registradas

| Data | Decisão |
|---|---|
| 2026-07-03 | Provider permanece abstraído por `IWhatsAppProvider`; Evolution não vaza para UI. |
| 2026-07-03 | Handoff usa `BOT|HUMAN`; envio humano assume atendimento. |
| 2026-07-03 | Nome é resolvido internamente com precedência; agenda do celular não é alvo de escrita. |
| 2026-07-17 | Número formatado é fallback obrigatório da identidade; `Contato` é proibido para conversa individual. |
| 2026-07-17 | Permissão de microfone é solicitada somente por gesto explícito; negação recebe instrução, não promessa de reversão. |
| 2026-07-17 | Mídia e efeitos de webhook passam a ter armazenamento/processamento duráveis antes de expansão de recursos. |
| 2026-07-18 | Fase 0 parcial entregue: mídia outbound em bucket `whatsapp-media` (sem Base64 novo), webhook aceita e processa via `after()`, soft-delete + `WhatsAppAuditEvent`. Fase 1 parcial: mic só alerta em `denied`, mobile lista↔painel, waveform RMS. `WHATSAPP_AUDIT.md` marcado histórico; `WHATSAPP_BOT_SPEC.md` adiada. |
