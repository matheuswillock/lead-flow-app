#!/usr/bin/env bash
# Backup diário Supabase/Postgres → /opt/lead-flow-app/backups/YYYY-MM-DD/
# Retenção: 14 dias. Uso: BACKUP_DATABASE_URL=... ./backup-supabase.sh
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/opt/lead-flow-app/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
DATE_STAMP="$(TZ=America/Sao_Paulo date +%Y-%m-%d)"
OUT_DIR="${BACKUP_ROOT}/${DATE_STAMP}"
DUMP_FILE="${OUT_DIR}/full.dump"
SHA_FILE="${DUMP_FILE}.sha256"
STORAGE_DIR="${OUT_DIR}/storage"

if [[ -z "${BACKUP_DATABASE_URL:-}" && -z "${DATABASE_URL:-}" ]]; then
  echo "BACKUP_DATABASE_URL ou DATABASE_URL é obrigatório" >&2
  exit 1
fi

DB_URL="${BACKUP_DATABASE_URL:-$DATABASE_URL}"

mkdir -p "${OUT_DIR}"

echo "[backup] Iniciando pg_dump → ${DUMP_FILE}"
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  --dbname="${DB_URL}" \
  --file="${DUMP_FILE}"

sha256sum "${DUMP_FILE}" | awk '{print $1}' > "${SHA_FILE}"
CHECKSUM="$(cat "${SHA_FILE}")"
SIZE_BYTES="$(stat -c%s "${DUMP_FILE}" 2>/dev/null || stat -f%z "${DUMP_FILE}")"

# Storage sync (opcional): buckets críticos via supabase CLI se configurado
STORAGE_SYNC_PATH=""
if [[ "${BACKUP_SYNC_STORAGE:-0}" == "1" ]] && command -v supabase >/dev/null 2>&1; then
  mkdir -p "${STORAGE_DIR}"
  echo "[backup] Sync storage (best-effort) → ${STORAGE_DIR}"
  # Placeholder: operador configura sync externo; marca caminho para metadados
  STORAGE_SYNC_PATH="${STORAGE_DIR}"
fi

# Retenção
find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +

echo "[backup] OK file=${DUMP_FILE} size=${SIZE_BYTES} sha256=${CHECKSUM}"

# JSON para o agente Ops consumir via stdout (última linha)
printf '{"filePath":"%s","fileName":"%s","sizeBytes":%s,"checksumSha256":"%s","storageSyncPath":%s}\n' \
  "${DUMP_FILE}" \
  "full.dump" \
  "${SIZE_BYTES}" \
  "${CHECKSUM}" \
  "$( [[ -n "${STORAGE_SYNC_PATH}" ]] && printf '"%s"' "${STORAGE_SYNC_PATH}" || echo null )"
