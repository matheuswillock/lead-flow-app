/**
 * Shims de preload para rodar código de servidor do app em scripts Bun.
 *
 * `server-only`/`client-only` são guardas de bundler do Next que lançam quando
 * importados fora do runtime esperado. Em scripts operacionais (backfills), o
 * código roda em processo Bun puro — os guards não se aplicam, então viram
 * módulos vazios.
 *
 * Uso: bun --preload ./scripts/lib/bun-next-runtime-shims.ts scripts/<script>.ts
 */

import { plugin } from "bun"

plugin({
  name: "next-runtime-shims",
  setup(build) {
    build.module("server-only", () => ({ exports: {}, loader: "object" }))
    build.module("client-only", () => ({ exports: {}, loader: "object" }))
  },
})
