// lib/asaas.ts
//
// Reexport fino de `lib/asaas/index.ts` — E1 de
// [[10 — Fundações Multi-conta — Backend]] (DA2). Este arquivo existe só
// para não quebrar nenhum dos 85 call-sites que importam de `@/lib/asaas`;
// a implementação real (transporte multi-conta) vive em `lib/asaas/`.

export * from "./asaas/index"
