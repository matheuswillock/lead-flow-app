import { readFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export const MIGRATIONS_DIR = join("supabase", "migrations");

export type MigrationFileInfo = {
  file: string;
  path: string;
  mtime: number;
};

export function normalizeMigrationName(name: string): string | null {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || null;
}

/** Compara sufixos ignorando hífen vs underscore (ex.: seed-a-b ≡ seed_a_b). */
export function canonicalMigrationSuffix(suffix: string): string {
  return suffix.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function fileMigrationSuffix(file: string): string | null {
  const match = file.match(/^\d+_(.+)\.sql$/);
  return match?.[1] ?? null;
}

export function fileMatchesMigrationSuffix(file: string, suffix: string): boolean {
  const fileSuffix = fileMigrationSuffix(file);
  if (!fileSuffix) return false;
  return canonicalMigrationSuffix(fileSuffix) === canonicalMigrationSuffix(suffix);
}

export function findMigrationFilesBySuffix(suffix: string): MigrationFileInfo[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql") && fileMatchesMigrationSuffix(file, suffix))
    .map((file) => {
      const path = join(MIGRATIONS_DIR, file);
      return {
        file,
        path,
        mtime: statSync(path).mtimeMs,
      };
    })
    .sort((a, b) => a.mtime - b.mtime);
}

export function isEmptyMigrationContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  return (
    lower.includes("no schema changes") ||
    lower.includes("no difference") ||
    lower.includes("this is an empty migration")
  );
}

export function isEmptyMigrationFile(path: string): boolean {
  try {
    return isEmptyMigrationContent(readFileSync(path, "utf8"));
  } catch {
    return true;
  }
}

export function removeMigrationFile(path: string): void {
  unlinkSync(path);
  console.info(`   removido: ${path}`);
}

/** Remove arquivos vazios com o mesmo sufixo (stale de `db:migrate:new` antes do diff). */
export function cleanupEmptyMigrationsBySuffix(suffix: string): string[] {
  const removed: string[] = [];

  for (const { path } of findMigrationFilesBySuffix(suffix)) {
    if (isEmptyMigrationFile(path)) {
      removeMigrationFile(path);
      removed.push(path);
    }
  }

  return removed;
}

/**
 * Mantém uma única migration por sufixo: preserva a mais recente com conteúdo
 * e remove vazias ou duplicatas extras.
 */
export function dedupeMigrationsBySuffix(suffix: string): string | null {
  const files = findMigrationFilesBySuffix(suffix);
  if (files.length === 0) return null;
  if (files.length === 1) return files[0].path;

  const withContent = files.filter((f) => !isEmptyMigrationFile(f.path));
  const empty = files.filter((f) => isEmptyMigrationFile(f.path));

  for (const { path } of empty) {
    removeMigrationFile(path);
  }

  if (withContent.length === 0) return null;
  if (withContent.length === 1) return withContent[0].path;

  const sorted = [...withContent].sort((a, b) => b.mtime - a.mtime);
  for (const { file, path } of sorted.slice(1)) {
    console.warn(
      `⚠️  Migration duplicada removida (conteúdo mantido em ${sorted[0].file}): ${file}`,
    );
    removeMigrationFile(path);
  }

  return sorted[0].path;
}

export function findNonEmptyMigrationsBySuffix(suffix: string): MigrationFileInfo[] {
  return findMigrationFilesBySuffix(suffix).filter((f) => !isEmptyMigrationFile(f.path));
}
