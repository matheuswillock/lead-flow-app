import { GlobalRegistrator } from "@happy-dom/global-registrator"

/**
 * Preload usado apenas pelos testes de UI (`bun run test:ui`).
 * Registra o DOM antes de qualquer import de React/Testing Library, o que não
 * seria possível dentro do próprio arquivo de teste (imports ESM são hoisted).
 */
GlobalRegistrator.register({ url: "http://localhost/" })
