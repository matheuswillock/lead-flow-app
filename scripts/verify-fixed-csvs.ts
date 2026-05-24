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

const FIXED = 'C:\\Users\\mathe\\Downloads\\backup\\fixed';

// --- backoffice_leads ---
const leadsText = await Bun.file(`${FIXED}\\backoffice_leads_rows.csv`).text();
const leadsRows = parseCsv(leadsText);
const lHeader = leadsRows[0];
const statusIdx = lHeader.indexOf('status');
const originIdx = lHeader.indexOf('origin');
console.info(`\nbackoffice_leads: ${leadsRows.length - 1} data rows`);
const statuses: Record<string, number> = {};
const origins: Record<string, number> = {};
for (let i = 1; i < leadsRows.length; i++) {
  const s = leadsRows[i][statusIdx] || '(empty)';
  statuses[s] = (statuses[s] ?? 0) + 1;
  const o = leadsRows[i][originIdx] || '(empty)';
  origins[o] = (origins[o] ?? 0) + 1;
}
console.info('  status:', JSON.stringify(statuses));
console.info('  origin:', JSON.stringify(origins));

// --- lead_activities ---
const actText = await Bun.file(`${FIXED}\\lead_activities_rows.csv`).text();
const actRows = parseCsv(actText);
const aHeader = actRows[0];
const createdAtIdx = aHeader.indexOf('createdAt');
console.info(`\nlead_activities: ${actRows.length - 1} logical rows`);
let emptyTs = 0;
for (let i = 1; i < actRows.length; i++) {
  if (!actRows[i][createdAtIdx]?.trim()) emptyTs++;
}
console.info(`  empty createdAt values: ${emptyTs}`);

export {}
