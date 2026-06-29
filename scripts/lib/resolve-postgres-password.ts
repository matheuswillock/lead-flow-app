import "dotenv/config";

function passwordFromConnectionUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (!parsed.password) return undefined;
    return decodeURIComponent(parsed.password);
  } catch {
    return undefined;
  }
}

/** POSTGRES_PASSWORD ou senha extraída de DIRECT_URL / DATABASE_URL. */
export function resolvePostgresPassword(): string | undefined {
  const explicit = process.env.POSTGRES_PASSWORD?.trim();
  if (explicit) return explicit;

  const directUrl = process.env.DIRECT_URL?.trim();
  if (directUrl) {
    const fromDirect = passwordFromConnectionUrl(directUrl);
    if (fromDirect) return fromDirect;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    const fromDatabase = passwordFromConnectionUrl(databaseUrl);
    if (fromDatabase) return fromDatabase;
  }

  return undefined;
}
