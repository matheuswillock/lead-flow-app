export const MEETING_LINK_MAX_LENGTH = 2048;

const CONTROL_CHAR_REGEX = /[\u0000-\u001f\u007f]/;
const SQL_INJECTION_SIGNATURES = [/'/, /;/, /--/, /\/\*/, /\*\//];

export type MeetingLinkValidationResult =
  | { isValid: true; normalized?: string }
  | { isValid: false; error: string };

interface ValidateMeetingLinkOptions {
  required?: boolean;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasSqlInjectionSignature(value: string): boolean {
  return SQL_INJECTION_SIGNATURES.some((pattern) => pattern.test(value));
}

export function validateMeetingLinkValue(
  rawValue: string | null | undefined,
  options: ValidateMeetingLinkOptions = {}
): MeetingLinkValidationResult {
  const required = options.required ?? false;
  const value = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!value) {
    if (required) {
      return {
        isValid: false,
        error: "Informe um link da reunião válido (http/https).",
      };
    }

    return { isValid: true, normalized: undefined };
  }

  if (value.length > MEETING_LINK_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Link da reunião excede ${MEETING_LINK_MAX_LENGTH} caracteres.`,
    };
  }

  const decodedValue = safeDecodeURIComponent(value);

  if (CONTROL_CHAR_REGEX.test(value) || CONTROL_CHAR_REGEX.test(decodedValue)) {
    return {
      isValid: false,
      error: "Link da reunião contém caracteres inválidos.",
    };
  }

  if (
    hasSqlInjectionSignature(value) ||
    hasSqlInjectionSignature(decodedValue)
  ) {
    return {
      isValid: false,
      error: "Link da reunião contém padrões inválidos.",
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value);
  } catch {
    return { isValid: false, error: "Link da reunião inválido." };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return {
      isValid: false,
      error: "Informe um link da reunião válido (http/https).",
    };
  }

  return { isValid: true, normalized: parsedUrl.toString() };
}
