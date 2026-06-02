export interface AgeRangeEntry {
  rangeKey: string;
  label: string;
  min: number;
  max: number;
}

export interface AgeRangeCount {
  rangeKey: string;
  count: number;
}

export const AGE_RANGES: AgeRangeEntry[] = [
  { rangeKey: "00_18", label: "00 a 18", min: 0, max: 18 },
  { rangeKey: "19_23", label: "19 a 23", min: 19, max: 23 },
  { rangeKey: "24_28", label: "24 a 28", min: 24, max: 28 },
  { rangeKey: "29_33", label: "29 a 33", min: 29, max: 33 },
  { rangeKey: "34_38", label: "34 a 38", min: 34, max: 38 },
  { rangeKey: "39_43", label: "39 a 43", min: 39, max: 43 },
  { rangeKey: "44_48", label: "44 a 48", min: 44, max: 48 },
  { rangeKey: "49_53", label: "49 a 53", min: 49, max: 53 },
  { rangeKey: "54_58", label: "54 a 58", min: 54, max: 58 },
  { rangeKey: "59_plus", label: "59 ou mais", min: 59, max: 999 },
];

export function mapAgeToRangeKey(age: number): string | null {
  for (const range of AGE_RANGES) {
    if (age >= range.min && age <= range.max) {
      return range.rangeKey;
    }
  }
  return null;
}

export function serializeAgeRanges(entries: AgeRangeCount[]): string {
  return entries
    .filter((e) => e.count > 0)
    .map((e) => `${e.rangeKey}:${e.count}`)
    .join(",");
}

export function deserializeAgeRanges(value: string): AgeRangeCount[] {
  if (!value || !value.trim()) return [];
  return value
    .split(",")
    .map((part) => {
      const [rangeKey, countStr] = part.trim().split(":");
      if (!rangeKey || !countStr) return null;
      const count = parseInt(countStr, 10);
      if (isNaN(count) || count < 0) return null;
      if (!AGE_RANGES.some((r) => r.rangeKey === rangeKey)) return null;
      return { rangeKey, count };
    })
    .filter((e): e is AgeRangeCount => e !== null);
}

export function parseCommaAges(value: string): AgeRangeCount[] {
  if (!value || !value.trim()) return [];
  const ages = value
    .split(/[,\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 200);

  const countMap = new Map<string, number>();
  for (const age of ages) {
    const key = mapAgeToRangeKey(age);
    if (key) {
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }
  }

  return Array.from(countMap.entries()).map(([rangeKey, count]) => ({
    rangeKey,
    count,
  }));
}

export function isNewAgeFormat(value: string): boolean {
  if (!value || !value.trim()) return false;
  return /^\w+:\d+(,\w+:\d+)*$/.test(value.trim());
}

export function getTotalBeneficiaries(entries: AgeRangeCount[]): number {
  return entries.reduce((sum, e) => sum + e.count, 0);
}

// --- Specific age entries (new format: "22:2,25:1") ---

export interface AgeEntry {
  age: number;
  count: number;
}

export function serializeAgeEntries(entries: AgeEntry[]): string {
  return entries
    .filter((e) => e.count > 0)
    .sort((a, b) => a.age - b.age)
    .map((e) => `${e.age}:${e.count}`)
    .join(",");
}

export function deserializeAgeEntries(value: string): AgeEntry[] {
  if (!value || !value.trim()) return [];
  // Only parse entries where the key is a plain number (new format).
  // Range-key format uses underscores (e.g. "00_18:2") — skip those silently.
  return value
    .split(",")
    .map((part) => {
      const [keyStr, countStr] = part.trim().split(":");
      if (!keyStr || !countStr) return null;
      if (!/^\d+$/.test(keyStr)) return null; // skip range keys like "00_18"
      const age = parseInt(keyStr, 10);
      const count = parseInt(countStr, 10);
      if (isNaN(age) || isNaN(count) || count < 1) return null;
      return { age, count };
    })
    .filter((e): e is AgeEntry => e !== null);
}

export function getTotalBeneficiariesFromEntries(entries: AgeEntry[]): number {
  return entries.reduce((sum, e) => sum + e.count, 0);
}

export function formatAgeRangeSummary(value: string): string {
  const entries = isNewAgeFormat(value)
    ? deserializeAgeRanges(value)
    : parseCommaAges(value);
  if (entries.length === 0) return "";

  return entries
    .map((e) => {
      const range = AGE_RANGES.find((r) => r.rangeKey === e.rangeKey);
      return `${range?.label ?? e.rangeKey}: ${e.count}`;
    })
    .join(", ");
}
