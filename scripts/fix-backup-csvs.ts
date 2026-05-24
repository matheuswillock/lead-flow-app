/**
 * Converts backup CSVs from UTF-16 to UTF-8, removes duplicate columns,
 * and fixes empty enum values. Uses a full document-level CSV parser that
 * correctly handles multi-line quoted fields (e.g. lead activity body text
 * that contains embedded newlines).
 */

import { readdirSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';

const BACKUP_DIR = 'C:\\Users\\mathe\\Downloads\\backup';
const OUTPUT_DIR = 'C:\\Users\\mathe\\Downloads\\backup\\fixed';

// Column-level default values for empty enum fields.
// Key: "filename:columnName", value: replacement string.
const ENUM_DEFAULTS: Record<string, string> = {
  'backoffice_leads_rows.csv:status': 'new_opportunity',
  'backoffice_leads_rows.csv:origin': 'manual',
};

/** Full CSV document parser — handles multi-line quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = i + 1 < text.length ? text[i + 1] : '';

    if (c === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++; // skip escaped double-quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++; // consume CRLF as one
      fields.push(current);
      current = '';
      // Skip entirely empty rows (trailing newline)
      if (fields.length > 1 || fields[0] !== '') {
        rows.push(fields);
      }
      fields = [];
    } else {
      current += c;
    }
  }

  // Last row with no trailing newline
  fields.push(current);
  if (fields.length > 1 || fields[0] !== '') {
    rows.push(fields);
  }

  return rows;
}

function joinCsvRow(fields: string[]): string {
  return fields
    .map((f) => {
      // Quote any field that contains comma, quote, CR, or LF
      if (f.includes(',') || f.includes('"') || f.includes('\r') || f.includes('\n')) {
        return `"${f.replace(/"/g, '""')}"`;
      }
      return f;
    })
    .join(',');
}

function joinCsv(rows: string[][]): string {
  return rows.map(joinCsvRow).join('\n');
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const files = readdirSync(BACKUP_DIR).filter((f) => {
  if (!f.endsWith('.csv')) return false;
  return statSync(join(BACKUP_DIR, f)).isFile();
});

console.info(`Processing ${files.length} CSV files...\n`);

for (const file of files) {
  const inputPath = join(BACKUP_DIR, file);
  const outputPath = join(OUTPUT_DIR, file);

  const buffer = await Bun.file(inputPath).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const isUtf16Le = bytes[0] === 0xff && bytes[1] === 0xfe;
  const isUtf16Be = bytes[0] === 0xfe && bytes[1] === 0xff;
  const encoding = isUtf16Le || isUtf16Be ? (isUtf16Le ? 'utf-16le' : 'utf-16be') : 'utf-8';

  const decoder = new TextDecoder(encoding);
  let text = decoder.decode(buffer);

  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = parseCsv(text);
  if (rows.length === 0) {
    await Bun.write(outputPath, '');
    console.info(`${file}: empty, skipped`);
    continue;
  }

  const headerRow = rows[0];

  // Find and remove duplicate columns
  const seen = new Map<string, number>();
  const keepIndices: number[] = [];
  for (let i = 0; i < headerRow.length; i++) {
    const col = headerRow[i];
    if (!seen.has(col)) {
      seen.set(col, i);
      keepIndices.push(i);
    }
  }

  const duplicateCount = headerRow.length - keepIndices.length;

  // Build column index → enum default mapping for this file
  const enumDefaults = new Map<number, string>();
  for (let ki = 0; ki < keepIndices.length; ki++) {
    const col = headerRow[keepIndices[ki]];
    const key = `${file}:${col}`;
    if (ENUM_DEFAULTS[key]) {
      enumDefaults.set(ki, ENUM_DEFAULTS[key]);
    }
  }

  const newRows: string[][] = [];
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const newRow = keepIndices.map((idx, ki) => {
      const val = idx < row.length ? row[idx] : '';
      // Replace empty enum values with default
      if (val === '' && enumDefaults.has(ki)) {
        return enumDefaults.get(ki)!;
      }
      return val;
    });
    newRows.push(newRow);
  }

  await Bun.write(outputPath, joinCsv(newRows));

  const encodingNote = encoding !== 'utf-8' ? ` [${encoding}→utf-8]` : '';
  const dupNote = duplicateCount > 0 ? ` [removed ${duplicateCount} dup col(s)]` : '';
  const enumNote = enumDefaults.size > 0 ? ` [enum defaults applied: ${[...enumDefaults.values()].join(', ')}]` : '';
  console.info(`${file}${encodingNote}${dupNote}${enumNote}`);
}

console.info(`\nDone. Fixed files → ${OUTPUT_DIR}`);
