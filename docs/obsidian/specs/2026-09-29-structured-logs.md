# Logs estruturados e observabilidade na Vercel

## Objetivo

Padronizar logs server-side em uma linha JSON por evento e capturar erros relevantes do browser sem transportar segredos para a Vercel.

## Decisões

- O destino primário é stdout: a Vercel já coleta, indexa e permite filtrar os campos JSON.
- O logger interno evita uma dependência de transporte adicional e mantém baixo o custo por chamada.
- Cada entrada possui `ts`, `level`, `scope` e `msg`; contexto adicional é estruturado no mesmo nível.
- `child()` mantém correlação por `requestId`, `clientId` e identificadores de fluxo.
- Chaves sensíveis e padrões conhecidos (`Bearer`, JWT, `sk-` e URLs de banco com senha) são redigidos antes da serialização.
- O tamanho de uma linha é limitado para evitar custo e ruído em produção.
- Erros do browser chegam por endpoint allowlisted, limitado por IP e sem payload arbitrário.

## Formato

```json
{"ts":"2026-09-29T12:00:00.000Z","level":"error","scope":"health","msg":"database unreachable","error":{"name":"Error","message":"timeout"}}
```

## Performance e segurança

- Sanitização ocorre uma vez antes da serialização.
- O writer é injetável nos testes e stdout é usado em produção.
- Objetos circulares não derrubam a requisição.
- Mensagens e campos acima do limite são reduzidos a um registro compacto válido.
- O endpoint client-side aceita apenas `warn`/`error`, mensagem, stack, rota e `requestId`.
- O endpoint não recebe cookies, headers, tokens ou corpo arbitrário.

## Operação na Vercel

Filtrar por `scope`, `level`, `requestId` ou `source`. Em incidentes, começar por `level:error` e correlacionar com o `requestId` da requisição.

## Limitações

O rate limit baseado na tabela compartilhada protege o endpoint entre instâncias. A captura client-side é best-effort: falha de rede não altera o comportamento da aplicação.
