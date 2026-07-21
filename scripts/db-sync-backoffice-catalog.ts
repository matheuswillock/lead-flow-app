/**
 * Sincroniza o catálogo canônico de produtos/features do backoffice no banco local.
 * Uso: bun run db:sync:backoffice-catalog
 */
import { ensureBackofficeCatalog, LOCAL_DB_URL } from "./lib/sync-backoffice-catalog";

try {
  const synced = ensureBackofficeCatalog(LOCAL_DB_URL);
  if (synced) {
    console.info("[db:sync:backoffice-catalog] Catálogo sincronizado com sucesso.");
  } else {
    console.info("[db:sync:backoffice-catalog] Catálogo já estava completo — nada a fazer.");
  }
} catch (err) {
  console.error(
    "[db:sync:backoffice-catalog] Falhou:",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
}
