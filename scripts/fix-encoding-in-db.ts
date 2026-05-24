/**
 * Fixes encoding corruption in the remote Supabase database.
 *
 * The backup CSVs were UTF-16 LE. Some tables were imported from the original
 * (non-fixed) files, causing characters like ú, ã, ç, é to be stored as
 * garbage sequences (e.g. ├║ instead of ú).
 *
 * This script reads the FIXED CSVs (properly decoded UTF-8) and generates
 * UPDATE statements to correct the affected rows directly in the remote DB
 * via the Supabase MCP execute_sql tool.
 *
 * Usage: bun run scripts/fix-encoding-in-db.ts
 * Then paste the generated SQL into the Supabase SQL Editor.
 */

const FIXED = 'C:\\Users\\mathe\\Downloads\\backup\\fixed';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = i + 1 < text.length ? text[i + 1] : '';
    if (c === '"') {
      if (inQuotes && next === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) { fields.push(current); current = ''; }
    else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      fields.push(current); current = '';
      if (fields.length > 1 || fields[0] !== '') rows.push(fields);
      fields = [];
    } else current += c;
  }
  fields.push(current);
  if (fields.length > 1 || fields[0] !== '') rows.push(fields);
  return rows;
}

function esc(val: string): string {
  return val.replace(/'/g, "''");
}

// ── profiles ── fix fullName (and other text fields with accents)
const profileText = await Bun.file(`${FIXED}\\profiles_rows.csv`).text();
const profileRows = parseCsv(profileText);
const profileHeader = profileRows[0];
const pId = profileHeader.indexOf('id');
const pName = profileHeader.indexOf('fullName');

const profileSql: string[] = [];
for (let i = 1; i < profileRows.length; i++) {
  const row = profileRows[i];
  const id = row[pId];
  const name = row[pName];
  if (name) {
    profileSql.push(
      `UPDATE corretor_studio_profiles SET "fullName" = '${esc(name)}' WHERE id = '${id}';`
    );
  }
}

// ── teams ── fix name
const teamsText = await Bun.file(`${FIXED}\\teams_rows.csv`).text();
const teamsRows = parseCsv(teamsText);
const teamsHeader = teamsRows[0];
const tId = teamsHeader.indexOf('id');
const tName = teamsHeader.indexOf('name');

const teamsSql: string[] = [];
for (let i = 1; i < teamsRows.length; i++) {
  const row = teamsRows[i];
  teamsSql.push(
    `UPDATE corretor_studio_teams SET name = '${esc(row[tName])}' WHERE id = '${row[tId]}';`
  );
}

// ── notifications ── too many to UPDATE individually; TRUNCATE + re-import
// We generate the DELETE + INSERT block for notifications below.
console.info('-- ══════════════════════════════════════════════════════');
console.info('-- STEP 1: Fix profiles fullName (147 UPDATEs)');
console.info('-- ══════════════════════════════════════════════════════');
console.info(profileSql.join('\n'));

console.info('\n-- ══════════════════════════════════════════════════════');
console.info('-- STEP 2: Fix teams name (50 UPDATEs)');
console.info('-- ══════════════════════════════════════════════════════');
console.info(teamsSql.join('\n'));

console.info('\n-- ══════════════════════════════════════════════════════');
console.info('-- STEP 3: Notifications — TRUNCATE then re-import from fixed CSV');
console.info('-- Run this SQL first:');
console.info('-- ══════════════════════════════════════════════════════');
console.info('TRUNCATE TABLE corretor_studio_notifications;');
console.info('-- Then re-import: fixed/notifications_rows.csv via Table Editor → Import data');
