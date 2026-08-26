# Bug: Domínio informado como já cadastrado sem cadastro local aparente

## Status

- Data da investigação: 2026-08-26
- Status: investigado
- Commit da investigação: `6209e77d`
- Commit da correção: não aplicado nesta etapa
- PR da correção: pendente

## Achado

Clientes tentaram cadastrar um novo domínio e receberam:

> Este domínio já está cadastrado. Verifique se não foi conectado antes ou use outro domínio.

O relato indica que o domínio não aparece cadastrado no sistema.

## Evidências

Evidência sanitizada do HAR fornecido:

- Data/hora: 2026-08-26 às `10:38:58-03`.
- Página: `/5b36cd1a-898b-4545-b8ed-97469fd24a34/email/configuracoes`.
- Endpoint: `POST /api/q/email/settings/domain`.
- Payload: `{"domainName":"onsidemarketing.com.br"}`.
- Resposta: `400`.
- Corpo da resposta: `{"isValid":false,"errorMessages":["Este domínio já está cadastrado. Verifique se não foi conectado antes ou use outro domínio."],"result":null}`.

Cookies, tokens e headers sensíveis foram omitidos.

A consulta ao Sentry não retornou evidências adicionais nesta investigação porque o acesso disponível retornou `403`.

## Investigação

A mensagem vem do mapeamento de erro do Resend em `lib/email/map-resend-domain-error.ts`. Quando o provedor retorna algo como `already exists`, a UI recebe uma mensagem que pode soar como cadastro local existente, mesmo quando o conflito está no provedor ou em um domínio órfão.

O use case `EmailTeamSettingsUseCase.connectDomain` já tenta evitar órfãos quando falha ao configurar tracking removendo o domínio recém-criado no Resend. Se essa limpeza falhar, o provedor pode continuar acusando domínio existente mesmo sem persistência local.

## Recomendação

Diferenciar as mensagens:

- domínio já conectado no time atual: orientar remover o domínio atual antes de conectar outro.
- domínio existente no provedor ou órfão: orientar contato com suporte/reconciliação, em vez de sugerir que o domínio está cadastrado localmente.

Não apagar domínio no Resend nem alterar banco remoto sem autorização explícita.

Referências de código:

- `app/api/useCases/email/EmailTeamSettingsUseCase.ts`
- `lib/email/map-resend-domain-error.ts`
