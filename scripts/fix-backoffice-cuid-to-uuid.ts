/**
 * Fixes backoffice CSV files where old CUID primary keys need to become UUIDs.
 *
 * Backoffice tables previously used Prisma's CUID default for some models.
 * The new schema uses @db.Uuid for all IDs. This script:
 *   1. Reads all backoffice_* CSVs from the fixed/ directory
 *   2. Finds all CUID-format values in any column
 *   3. Creates a deterministic CUID→UUID mapping (one UUID per unique CUID)
 *   4. Applies the mapping across all files, overwriting them in fixed/
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const FIXED_DIR = 'C:\\Users\\mathe\\Downloads\\backup\\fixed';

function isCuid(value: string): boolean {
  // CUIDs are ~25 chars (cuid1) or up to ~32 chars (cuid2).
  // SHA-256 hashes that start with 'c' are 64 hex chars — excluded by the upper bound.
  return /^c[a-z0-9]{19,31}$/.test(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Deterministic UUID v5-like from a CUID: same CUID always → same UUID */
function cuidToUuid(cuid: string): string {
  const hash = createHash('sha256').update(`backoffice-cuid-to-uuid:${cuid}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    (((parseInt(hash[16], 16) & 0x3) | 0x8)).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  fields.push(current);
  return fields;
}

function joinCsvLine(fields: string[]): string {
  return fields
    .map((f) => {
      if (f.includes(',') || f.includes('"') || f.includes('\n') || f.includes('\r')) {
        return `"${f.replace(/"/g, '""')}"`;
      }
      return f;
    })
    .join(',');
}

// Step 1: Collect all CUIDs from backoffice CSV files
// Only process files known to contain Prisma-generated CUID primary keys or
// FK references to BackofficeProduct.id. Do NOT include files with external
// CUID-shaped IDs (e.g. leads_schedule has googleEventId from Google Calendar).
const CUID_AFFECTED_FILES = new Set([
  'backoffice_adhesions_rows.csv',
  'backoffice_clients_rows.csv',
  'backoffice_features_rows.csv',
  'backoffice_feature_access_rules_rows.csv',
  'backoffice_feature_grants_rows.csv',
  'backoffice_leads_rows.csv',
  'backoffice_leads_schedule_rows.csv',
  'backoffice_payments_rows.csv',
  'backoffice_products_rows.csv',
  'backoffice_product_payment_rules_rows.csv',
  'backoffice_users_rows.csv',
  'backoffice_user_subscriptions_rows.csv',
  'backoffice_webhook_events_rows.csv',
  'backoffice_webhook_request_logs_rows.csv',
  'backoffice_webhook_tokens_rows.csv',
  'profile_subscriptions_rows.csv',
]);

const backofficeFiles = readdirSync(FIXED_DIR)
  .filter((f) => CUID_AFFECTED_FILES.has(f))
  .filter((f) => statSync(join(FIXED_DIR, f)).isFile());

const cuidMapping = new Map<string, string>(); // CUID → UUID

for (const file of backofficeFiles) {
  const content = await Bun.file(join(FIXED_DIR, file)).text();
  const lines = content.split(/\n/);
  if (lines.length < 2) continue;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCsvLine(lines[i]);
    for (const field of fields) {
      if (isCuid(field) && !cuidMapping.has(field)) {
        cuidMapping.set(field, cuidToUuid(field));
      }
    }
  }
}

if (cuidMapping.size === 0) {
  console.log('No CUIDs found in backoffice CSV files. Nothing to do.');
  process.exit(0);
}

console.log(`Found ${cuidMapping.size} unique CUID(s) to replace:\n`);
for (const [cuid, uuid] of cuidMapping) {
  console.log(`  ${cuid}  →  ${uuid}`);
}
console.log('');

// Step 2: Apply mapping to ALL backoffice files
let totalReplacements = 0;

for (const file of backofficeFiles) {
  const filePath = join(FIXED_DIR, file);
  const content = await Bun.file(filePath).text();
  const lines = content.split(/\n/);
  if (lines.length < 2) continue;

  let fileReplacements = 0;
  const newLines: string[] = [lines[0]]; // header unchanged

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const fields = parseCsvLine(line);
    const newFields = fields.map((f) => {
      if (cuidMapping.has(f)) {
        fileReplacements++;
        return cuidMapping.get(f)!;
      }
      return f;
    });
    newLines.push(joinCsvLine(newFields));
  }

  if (fileReplacements > 0) {
    await Bun.write(filePath, newLines.join('\n'));
    console.log(`${file}: replaced ${fileReplacements} CUID value(s)`);
    totalReplacements += fileReplacements;
  }
}

console.log(`\nDone. Total replacements: ${totalReplacements}`);
console.log('Mapping saved below for reference:');
for (const [cuid, uuid] of cuidMapping) {
  console.log(`  ${cuid} → ${uuid}`);
}
