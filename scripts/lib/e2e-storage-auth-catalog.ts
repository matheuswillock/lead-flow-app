export type StorageAuthCatalog = {
  storageBuckets: boolean;
  storageObjects: boolean;
  authIdentities: boolean;
  authEmailChangeTokenCurrent: boolean;
};

export const STORAGE_AUTH_CATALOG_PROBE_SQL = `
SELECT
  to_regclass('storage.buckets') IS NOT NULL,
  to_regclass('storage.objects') IS NOT NULL,
  to_regclass('auth.identities') IS NOT NULL,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'users'
      AND column_name = 'email_change_token_current'
  );
`.trim();

function parsePsqlBool(value: string | undefined): boolean {
  return value === "t" || value === "true" || value === "1";
}

export function parseStorageAuthCatalog(stdout: string): StorageAuthCatalog | null {
  const line = stdout
    .split("\n")
    .map((row) => row.trim())
    .find((row) => row.includes("|"));
  if (!line) return null;
  const parts = line.split("|");
  if (parts.length !== 4) return null;
  return {
    storageBuckets: parsePsqlBool(parts[0]),
    storageObjects: parsePsqlBool(parts[1]),
    authIdentities: parsePsqlBool(parts[2]),
    authEmailChangeTokenCurrent: parsePsqlBool(parts[3]),
  };
}
