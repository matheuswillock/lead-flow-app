export function normalizePhone(value?: string | null): string | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (digits.length === 10 || digits.length === 11) {
    normalized = `55${digits}`;
  }

  if (!normalized.startsWith("+")) {
    normalized = `+${normalized}`;
  }

  return normalized;
}

export function normalizePhoneForSearch(value?: string | null): string | null {
  const normalized = normalizePhone(value);
  if (!normalized) return null;
  return normalized.replace(/^\+/, "");
}
