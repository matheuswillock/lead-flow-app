# Bug: Solicitação de documentos retorna erro genérico

## Status

- Data da investigação: 2026-08-26
- Status: investigado
- Commit da correção: pendente
- PR da correção: pendente

## Achado

Clientes reportaram erro ao criar uma nova solicitação de documentos pelo modal "Nova solicitação de documentos". A tela exibia apenas "Ocorreu um erro.", sem explicar o motivo da falha.

## Evidências

- Em 2026-08-25, a Vercel registrou tráfego em `POST /api/q/leads/.../document-requests` com `7` respostas `400`, `2` respostas `201` e `26` respostas `200`.
- Exemplo observado: `POST /api/q/leads/6c503819-b7e3-4ad4-a882-363448955dfa/document-requests` retornou `400` às `15:42:59Z` e `15:43:21Z`.
- A imagem anexada ao bug mostra o modal com vários documentos longos e o toast genérico.
- A consulta ao Sentry não retornou evidências adicionais nesta investigação porque o acesso disponível retornou `403`.

## Hipótese

A rota valida cada documento com limite de `200` caracteres e a mensagem com limite de `1000`. A UI não antecipa esses limites, e mensagens técnicas ou em inglês acabam mascaradas pelo helper de toast como "Ocorreu um erro.".

Referências de código:

- `app/api/v1/leads/[id]/document-requests/route.ts`
- `app/[supabaseId]/components/lead-document-requests/LeadDocumentRequestsTab.tsx`
- `lib/ui/to-user-toast-message.ts`

## Recomendação

Adicionar validação visual no modal, com limite e mensagem em português para documento longo ou mensagem longa. O erro retornado pela API deve ser exibido ao usuário quando for uma mensagem de produto.
