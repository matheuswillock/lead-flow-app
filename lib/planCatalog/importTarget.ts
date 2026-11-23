/**
 * Trava de destino da importação. O importador só grava se o host do
 * DATABASE_URL for exatamente o host confirmado pelo operador. Evita
 * importar no banco errado por uma variável de ambiente herdada.
 */
export function assertImportTarget(databaseUrl: string | undefined, confirmHost: string | undefined): { host: string } {
  if (!databaseUrl) throw new Error("DATABASE_URL ausente.");
  if (!confirmHost) throw new Error("Informe --confirm-host com o host do banco de destino.");

  const host = new URL(databaseUrl).hostname;
  if (host !== confirmHost) {
    throw new Error(`Host do banco (${host}) diferente do confirmado (${confirmHost}). Nada foi gravado.`);
  }
  return { host };
}
