import * as XLSX from "xlsx";
import type {
  DialerContactParseResult,
  IDialerContactParserService,
  ParsedDialerContact,
} from "./IDialerContactParserService";

export const DIALER_CONTACTS_UPLOAD_LIMIT = 10_000;

const NAME_KEYS = ["name", "nome", "contato", "cliente"];
const PHONE_KEYS = ["phone", "telefone", "celular", "fone", "whatsapp"];
const EMAIL_KEYS = ["email", "e-mail"];

type RawRow = Record<string, unknown>;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function pickField(row: RawRow, candidates: string[]): unknown {
  for (const [key, value] of Object.entries(row)) {
    if (candidates.includes(normalizeKey(key))) {
      return value;
    }
  }
  return undefined;
}

/**
 * Normaliza um telefone brasileiro para E.164 (+55DDDNUMERO).
 * Aceita formatos com mascara, DDI 55 opcional e numeros de 10/11 digitos.
 * Retorna null quando o valor nao forma um telefone valido.
 */
export function normalizeBrazilianPhoneToE164(rawValue: unknown): string | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const digitsOnly = String(rawValue).replace(/\D/g, "");
  if (!digitsOnly) {
    return null;
  }

  let nationalNumber = digitsOnly;
  if (nationalNumber.startsWith("0055")) {
    nationalNumber = nationalNumber.slice(4);
  } else if (nationalNumber.startsWith("55") && nationalNumber.length >= 12) {
    nationalNumber = nationalNumber.slice(2);
  }
  if (nationalNumber.startsWith("0") && nationalNumber.length > 10) {
    nationalNumber = nationalNumber.slice(1);
  }

  if (nationalNumber.length !== 10 && nationalNumber.length !== 11) {
    return null;
  }

  const areaCode = nationalNumber.slice(0, 2);
  if (Number(areaCode) < 11) {
    return null;
  }

  return `+55${nationalNumber}`;
}

function buildContactFromRow(row: RawRow, rowLabel: string): {
  contact: ParsedDialerContact | null;
  error: string | null;
} {
  const rawName = pickField(row, NAME_KEYS);
  const rawPhone = pickField(row, PHONE_KEYS);
  const rawEmail = pickField(row, EMAIL_KEYS);

  const name = rawName !== null && rawName !== undefined ? String(rawName).trim() : "";
  if (!name) {
    return { contact: null, error: `${rowLabel}: campo "name" ausente ou vazio` };
  }

  const phone = normalizeBrazilianPhoneToE164(rawPhone);
  if (!phone) {
    return { contact: null, error: `${rowLabel}: telefone inválido (${String(rawPhone ?? "")})` };
  }

  const email = rawEmail !== null && rawEmail !== undefined ? String(rawEmail).trim() : "";

  const knownKeys = [...NAME_KEYS, ...PHONE_KEYS, ...EMAIL_KEYS];
  const extraEntries = Object.entries(row).filter(
    ([key, value]) =>
      !knownKeys.includes(normalizeKey(key)) && value !== null && value !== undefined && value !== ""
  );

  return {
    contact: {
      name,
      phone,
      email: email || null,
      metadata: extraEntries.length > 0 ? Object.fromEntries(extraEntries) : null,
    },
    error: null,
  };
}

function buildResult(rows: RawRow[], rowLabelPrefix: string): DialerContactParseResult {
  const contacts: ParsedDialerContact[] = [];
  const errors: string[] = [];
  let skipped = 0;
  const seenPhones = new Set<string>();

  rows.forEach((row, index) => {
    const { contact, error } = buildContactFromRow(row, `${rowLabelPrefix} ${index + 1}`);
    if (!contact) {
      skipped += 1;
      if (error && errors.length < 20) {
        errors.push(error);
      }
      return;
    }

    if (seenPhones.has(contact.phone)) {
      skipped += 1;
      return;
    }

    seenPhones.add(contact.phone);
    contacts.push(contact);
  });

  return { contacts, skipped, errors };
}

export class DialerContactParserService implements IDialerContactParserService {
  parseXlsx(buffer: Buffer): DialerContactParseResult {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { contacts: [], skipped: 0, errors: ["Planilha sem abas"] };
    }

    const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheetName], {
      defval: null,
    });
    return buildResult(rows, "Linha");
  }

  parseJson(content: string): DialerContactParseResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { contacts: [], skipped: 0, errors: ["JSON inválido"] };
    }

    const rows = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as RawRow).contacts)
        ? ((parsed as RawRow).contacts as unknown[])
        : null;

    if (!rows) {
      return {
        contacts: [],
        skipped: 0,
        errors: ['JSON deve ser um array de contatos ou um objeto com a chave "contacts"'],
      };
    }

    const objectRows = rows.filter(
      (row): row is RawRow => typeof row === "object" && row !== null && !Array.isArray(row)
    );

    return buildResult(objectRows, "Item");
  }
}
