# PAY-PROV-T016 — acceptance gates

- [x] **G1** Child adapters have HTTP-fake coverage for creation, query, refund, webhook and validation paths.
  CHECK: `bun test --isolate app/api/infra/providers lib/payment-provider`
  EXPECT: `0 fail`
- [x] **G2** Timeout, 429 and 5xx creation/query failures produce `UNKNOWN`/reconciliation outcomes without retrying blindly.
  CHECK: `bun test --isolate app/api/infra/providers/AbacatePayProvider.test.ts`
  EXPECT: `0 fail`
- [x] **G3** `success:false`, missing IDs, divergent amounts, invalid dates, invalid installments and altered raw webhook bodies fail safely.
  CHECK: `bun test --isolate app/api/infra/providers/AbacatePayProvider.test.ts`
  EXPECT: `0 fail`
- [x] **G4** Refund idempotency is restricted to remote code `ALREADY_REFUNDED` with HTTP 409; other failures remain errors.
  CHECK: `bun test --isolate app/api/infra/providers/AbacatePayProvider.test.ts`
  EXPECT: `0 fail`
- [x] **G5** Runtime webhook provenance is instance-bound through a private `WeakSet`; forged and cross-instance verified objects are rejected, and secrets/card data do not leak through logs/results.
  CHECK: `bun test --isolate app/api/infra/providers/AbacatePayProvider.test.ts`
  EXPECT: `0 fail`
- [x] **G6** Static, formatting, governance, pt-BR and diff validation pass.
  CHECK: `bun run typecheck && bunx prettier --check app/api/infra/providers lib/payment-provider && bun run governance:check && bun run lint:pt-br:strict && git diff --check`
  EXPECT: `exit 0`
- [x] **G7** Bugbot and Security Review plus re-reviews completed.
  EVIDENCE: Reviews found and drove fixes for `success:false` across all operations, arbitrary HTTP 409 refund acceptance, exported/forgeable webhook branding, and cross-instance webhook provenance. Final Bugbot and Security Review returned "sem achados".
