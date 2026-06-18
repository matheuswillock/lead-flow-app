# Backfill: Profile -> TeamMember por grupos

Este documento consolida os grupos de tratamento definidos durante a validacao local para a migracao de `Profile` para `TeamMember`.

## Regra geral

- `TeamMember` e a fonte de verdade para `role`, `functions` e delegacoes por time.
- `Profile` nao deve mais ser usado como fonte de autorizacao tenant-aware.
- Nem todo profile sem `TeamMember` deve ser migrado automaticamente.
- Casos internos de backoffice e casos ambiguos explicitamente descartados nao devem bloquear o fluxo.

## Grupo 1 - Migrar automaticamente por `activeTeamId` valido

### Criterio

- Profile sem `TeamMember`
- `activeTeamId` preenchido
- `activeTeamId` pertence ao master esperado (`COALESCE(managerId, id)`)

### Acao

- Criar `TeamMember` usando `activeTeamId`
- Copiar `role` e `functions`
- Delegacoes sanitizadas por regra

### Justificativa

O time ja esta explicitamente definido no profile e e consistente com o master esperado. Nao ha ambiguidade de destino.

### Migration relacionada

- `20260617150048_backfill-profile-role-functions-to-team-members-deterministic.sql`

## Grupo 2 - Migrar automaticamente por time candidato unico

### Criterio

- Profile sem `TeamMember`
- `activeTeamId` nulo
- existe exatamente 1 time candidato no master

### Acao

- Definir `activeTeamId` para o time unico
- Criar `TeamMember` nesse time

### Justificativa

Mesmo sem `activeTeamId`, existe apenas um destino possivel dentro do master. O backfill e deterministico e nao introduz escolha arbitraria.

### Perfis tratados manualmente em migration dedicada

- `84183a6a-71f1-48b5-a6a7-4b3ccbc7e16b` - Areta Aparecida de Souza Vieira
- `26b6c2d6-6377-45ac-a760-9705984ac6f8` - Carlos Eduardo Sobrinho de Sousa
- `05750ae8-e9bd-4635-8988-b042b3b83c40` - ClickBot
- `35df9767-5413-4ddb-b360-4f3d585db38f` - Izadora Buiatte
- `7d20b50d-819e-4f41-82bf-898511aab581` - Raphael Martins Eleoterio
- `87daaaca-41f4-475e-9304-d23bb7f0085c` - Talita Caroline Marinho
- `c31d51be-0ced-418c-b353-026cb667a864` - Yasmim Goncalves

### Migration relacionada

- `20260618215805_backfill-corretor-seguro-single-team-profiles.sql`

## Grupo 3 - Correcao direcionada de vinculo incorreto

### Criterio

- Profile existente
- destino correto conhecido por regra de negocio
- precisa ser realocado para outro master/time especifico

### Acao

- Atualizar `managerId`
- Atualizar `activeTeamId`
- Criar `TeamMember` no time correto, se necessario

### Justificativa

Esse nao e um caso generico de backfill. E uma correcao de cadastro conhecida e validada manualmente.

### Perfil tratado

- `53b0ba0f-0fc2-451c-b3ea-9c27446be10e` - Rafael Nogueira
  - novo manager: Carlos Henrique (`df71451b-bcd2-4602-9b7b-230b32f08b65`)
  - novo time: Pathos Seguros (`c30e3590-04a3-4544-bf66-43228037bfc9`)

### Migration relacionada

- `20260618211731_migrate-rafael-nogueira-to-pathos-seguros.sql`

## Grupo 4 - Excluir por serem usuarios internos de backoffice

### Criterio

- Profile existe em `backoffice_users`
- nao participa do fluxo tenant-aware por time

### Acao

- Nao criar `TeamMember`
- Nao exigir `activeTeamId`
- Excluir da auditoria bloqueante e dos calculos de pendencia tenant-aware

### Justificativa

Esses usuarios pertencem ao dominio interno de backoffice e nao devem ser forçados a participar da modelagem de times do produto.

### Perfis excluidos

- `c646d676-c9c8-4121-9793-a2795df23881` - Bruna Geovanaa
- `d756734e-e4dd-4572-8f5e-6135514a7902` - Bruno Marcelino
- `f88f2b3b-3f45-4170-83e1-4e7999d2c012` - Matheus Willock
- `d336c741-6a21-4e77-8d38-6c72c923b6f4` - Nathiele Willock

### Migrations relacionadas

- `20260617150048_backfill-profile-role-functions-to-team-members-deterministic.sql`
- `20260617151009_audit-profile-role-functions-before-drop.sql`

## Grupo 5 - Excluir por ambiguidade com multiplos times candidatos

### Criterio

- Profile sem `TeamMember`
- `activeTeamId` nulo
- multiplos times candidatos
- decisao explicita: nao migrar automaticamente para nenhum time

### Acao

- Nao criar `TeamMember`
- Nao escolher time automaticamente
- Excluir da auditoria bloqueante

### Justificativa

O destino e ambiguo. A regra de negocio definida foi nao adicionar esses usuarios a nenhum time.

### Perfis excluidos

- `5de7227f-07e0-400c-af54-2b88c764c28b` - Brenda Kauany Soares Pereira
- `72d64455-d7df-44e0-a7a0-9b8eada7eba3` - Bruna Floripes Franca
- `cf0f1c1c-e470-47b6-a34d-439012931643` - Carol Prado
- `60bce55e-380e-4ff6-b3de-60146e187284` - Debora Cristiny
- `b6e058f5-cd15-4aff-aece-79c104d5f127` - Kelly Andrade
- `885da880-273c-4f77-8c31-184215e9ce2d` - Marcelo Vieira
- `9a09e391-dba9-48dc-a391-5cc8a8319ade` - Mariana De Souza
- `d538a1f7-7bbe-4183-b303-cc164708a740` - Miller Franca
- `c46898df-7135-4d06-8abe-c219fa7467e2` - Tatiana Acencio
- `492deb28-5593-4deb-b508-4fdeb3f8aba8` - Thaesly Farias

### Migration relacionada

- `20260617151009_audit-profile-role-functions-before-drop.sql`

## Grupo 6 - Manter pendente para decisao manual

### Criterio

- ainda sem `TeamMember`
- nao se encaixa em migracao automatica segura
- nao foi explicitamente excluido da auditoria

### Acao

- manter fora do backfill automatico
- resolver caso a caso antes do drop final, ou excluir explicitamente da auditoria se a regra de negocio assim determinar

### Justificativa

Esses casos ainda exigem decisao operacional ou saneamento de cadastro antes de qualquer remocao final de `Profile.role/functions`.

## Estado esperado da auditoria

A auditoria final antes do drop deve:

- ignorar `backoffice_users`
- ignorar os perfis ambiguos explicitamente excluidos
- continuar bloqueando qualquer profile tenant-aware relevante que ainda esteja sem `TeamMember` sem justificativa formal
