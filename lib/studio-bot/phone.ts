const E164_RE = /^\+[1-9]\d{6,14}$/;

export function normalizePhoneE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  if (raw.trim().startsWith("+") && E164_RE.test(raw.trim())) {
    return raw.trim();
  }

  if (digits.length === 10 || digits.length === 11) {
    const normalized = `+55${digits}`;
    return E164_RE.test(normalized) ? normalized : null;
  }

  if (digits.length >= 12 && digits.length <= 15) {
    const normalized = `+${digits}`;
    return E164_RE.test(normalized) ? normalized : null;
  }

  return null;
}

export function parseVincularCode(text: string): string | null {
  const trimmed = text.trim();
  const vincularMatch = /^VINCULAR\s+(\d{6})$/i.exec(trimmed);
  if (vincularMatch) {
    return vincularMatch[1];
  }

  if (/^\d{6}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
