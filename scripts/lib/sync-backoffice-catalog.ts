import { spawnSync } from "node:child_process";

export const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
export const EXPECTED_ACTIVE_BACKOFFICE_FEATURES = 22;

export function countActiveBackofficeFeatures(dbUrl = LOCAL_DB_URL): number {
  const result = spawnSync(
    "psql",
    [dbUrl, "-t", "-A", "-c", 'SELECT count(*) FROM "public"."backoffice_features" WHERE "isActive" = true'],
    { encoding: "utf8", shell: process.platform === "win32" },
  );

  if (result.status !== 0) {
    throw new Error(
      `Could not count backoffice_features:\n${result.stderr || result.stdout}`,
    );
  }

  const parsed = Number(result.stdout.trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unexpected backoffice_features count: "${result.stdout}"`);
  }

  return parsed;
}

export function syncBackofficeCatalog(dbUrl = LOCAL_DB_URL): void {
  const result = spawnSync("bun", ["run", "db:seed:backoffice-products"], {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      DIRECT_URL: dbUrl,
    },
  });

  if (result.status !== 0) {
    throw new Error("`bun run db:seed:backoffice-products` failed");
  }
}

export function ensureBackofficeCatalog(dbUrl = LOCAL_DB_URL): boolean {
  const count = countActiveBackofficeFeatures(dbUrl);
  if (count >= EXPECTED_ACTIVE_BACKOFFICE_FEATURES) {
    return false;
  }

  syncBackofficeCatalog(dbUrl);
  return true;
}
