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

/** Extrai dígitos do ownerJid Evolution (`5511...@s.whatsapp.net`). */
export function phoneDigitsFromOwnerJid(ownerJid: string | null | undefined): string | null {
  if (!ownerJid) {
    return null;
  }

  const beforeAt = ownerJid.split("@")[0] ?? "";
  const digits = beforeAt.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

/** Formata dígitos E.164/BR para exibição (ex.: +55 (11) 98370-9790). */
export function formatWhatsappPhoneDisplay(raw: string | null | undefined): string | null {
  const digits = raw?.replace(/\D/g, "") ?? "";
  if (digits.length < 10) {
    return null;
  }

  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }

  return `+${digits}`;
}

/** Compara telefones ignorando formatação (+55, espaços, etc.). */
export function phoneDigitsEqual(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const leftDigits = left?.replace(/\D/g, "") ?? "";
  const rightDigits = right?.replace(/\D/g, "") ?? "";
  if (leftDigits.length < 10 || rightDigits.length < 10) {
    return false;
  }
  if (leftDigits === rightDigits) {
    return true;
  }

  const leftTail = leftDigits.slice(-11);
  const rightTail = rightDigits.slice(-11);
  return leftTail.length >= 10 && leftTail === rightTail;
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Detecta e-mail simples para o Caminho A (auth por canal). */
export function looksLikeEmail(text: string): string | null {
  const trimmed = text.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed) || trimmed.length > 254) {
    return null;
  }
  return trimmed;
}
