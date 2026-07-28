# Impeccable Critique — WhatsApp Inbox V3 Phase 4

**Date:** 2026-07-28  
**Surface:** Inbox thread + composer + settings ops card  
**Companion:** `impeccable-audit.md`

## Intent

Atendimento de conversa WhatsApp com paridade de bolha (quote, menu, forward) e sinal operacional sem PII.

## Hierarchy

1. Lista de conversas / busca global (`/`)
2. Thread com separadores de dia + bolhas + context menu
3. Composer com barra “Respondendo a…”
4. Settings: conexão, SLO, tags

## Critique

**Strengths**
- Reply preview na bolha e no composer reduz erro de contexto.
- ContextMenu e DropdownMenu compartilham `getMessageActions` (WA-024).
- Capabilities honestas: toast/`CAPABILITY_UNAVAILABLE` em vez de delete local falso.
- Wallpaper e assets próprios Corretor Studio.

**Friction**
- Encaminhamento multi-destino pode gerar fila longa; progresso por destino mitiga.
- Ops card só para quem gerencia infra — correto, mas operadores sem papel de gestor não veem dead-letter (esperado).

## P0 / P1 abertos após correção

Nenhum P0/P1 de UI bloqueante restante nesta superfície. Gates ops/SLO 7d e migrations remotas ficam fora do código.

## Re-run

Critique reavaliada após fix do `MessageActionUseCase` e inclusão do `OpsSloCard` + runbook §17.2.2. Aceite de código da Fase 4: **aprovado** com pendências ops explícitas no SPEC §2.1.
