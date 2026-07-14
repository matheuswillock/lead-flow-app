# Auditoria — Aceite eletrônico

**Data da revisão:** 2026-07-14  
**Resultado:** arquitetura aprovada após correções; rollout condicionado à publicação jurídica do primeiro conjunto documental.

## Achados corrigidos

| Severidade | Achado original                                               | Correção aplicada                                                                |
| ---------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Crítica    | Token consumido podia continuar devolvendo link de senha      | Replay devolve apenas protocolo/data; recuperação é tarefa idempotente do outbox |
| Crítica    | Usuário existente recebia fluxo `invite` depois do aceite     | Pós-aceite usa exclusivamente link Supabase `recovery`                           |
| Crítica    | Gate dependia de middleware/Proxy                             | Bloqueio foi incorporado a `getAccountAccessStatus` e `getTeamAccess`            |
| Alta       | PDF/e-mail dependiam de execução best-effort após o POST      | Outbox é gravado na mesma transação, com lock, retry e backoff                   |
| Alta       | Três documentos ativos podiam formar combinação inconsistente | Publicação atômica de `BackofficeLegalDocumentSet`                               |
| Alta       | Evidência guardava apenas referências mutáveis                | Snapshot de título, versão, schema, conteúdo, publicação e hash por documento    |
| Alta       | Token permanecia na URL                                       | Exchange para cookie HttpOnly e redirecionamento para URL limpa                  |
| Alta       | Concorrência podia duplicar aceite                            | Transação serializável, unique por adesão e retorno do vencedor                  |
| Média      | Primeiro acesso dependia de `last_sign_in_at`                 | Evento persistido em `firstPlatformAccessAt`                                     |
| Média      | Não havia download autorizado                                 | URL assinada privada de cinco minutos para o backoffice                          |
| Média      | Pipeline do cliente não existia                               | Jornada derivada `Nova adesão → Pago → Aceite → Primeiro acesso`                 |

## Controles confirmados

- Token com 256 bits de entropia e hash SHA-256 persistido.
- Binding explícito entre o que foi exibido e o que foi aceito.
- Documentos publicados e evidências protegidos por constraints/triggers.
- Bucket privado e RLS deny-by-default nas novas tabelas.
- PDF gerado no runtime Node, sem depender do navegador.
- Credenciais e metadados probatórios coletados no servidor.
- Nenhum campo ou adapter específico de ICP-Brasil no domínio atual.

## Riscos operacionais remanescentes

1. **Conteúdo jurídico:** o repositório não contém um contrato aprovado para seed. A funcionalidade não deve ser ativada sem o primeiro conjunto revisado e publicado.
2. **Retenção LGPD:** prazo, descarte e atendimento de exportação dependem de decisão do controlador/jurídico.
3. **Disponibilidade externa:** falhas de Supabase Storage, Auth ou Resend são recuperadas, mas precisam de alerta sobre tarefas em estado `failed`.
4. **Migração local:** a geração automática foi bloqueada por drift preexistente no índice `whatsapp_conversations_configId_externalChatId_key`. A aplicação incremental também encontrou a versão remota/local ausente `20260714190438`. Foi criada migration SQL explícita; o histórico local deve ser reparado e a migration validada em banco limpo antes do remoto.
5. **Gestão editorial:** esta entrega implementa o domínio/publicação atômica no banco, mas não adiciona editor jurídico WYSIWYG.

## Itens deliberadamente adiados

- Reaceite da base instalada quando um novo conjunto for publicado.
- Unificação das páginas públicas `/terms` e `/privacy-policy` com o conteúdo versionado.
- ICP-Brasil, provedores externos e certificados digitais.
- Selagem criptográfica externa ou carimbo de tempo qualificado.
- Dashboard dedicado de observabilidade do outbox; inicialmente serão usados logs e consulta administrativa.

## Parecer

O aceite eletrônico está tecnicamente adequado para uma primeira entrega após aplicação da migration, publicação do conjunto jurídico e teste ponta a ponta. A estratégia preserva autoria, integridade, contexto e versões sem atribuir ao fluxo a terminologia de assinatura qualificada.
