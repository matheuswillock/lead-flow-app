const MAX_EXTRA_GUESTS = 10;
const MAX_EMAIL_LENGTH = 254;
const MAX_EXTRA_GUESTS_PAYLOAD_LENGTH = 4_096;
const MAX_SCHEDULE_HORIZON_DAYS = 365;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ExtraGuestsValidation =
  | { valid: true; guests: string[] }
  | { valid: false; error: string };

export function normalizeExtraGuests(input: string[] | null | undefined): ExtraGuestsValidation {
  if (!input || input.length === 0) return { valid: true, guests: [] };
  if (input.length > MAX_EXTRA_GUESTS) {
    return { valid: false, error: `Informe no máximo ${MAX_EXTRA_GUESTS} convidados extras.` };
  }
  const guests: string[] = [];
  let payloadLength = 0;
  for (const value of input) {
    if (typeof value !== "string") {
      return { valid: false, error: "Convidados extras devem conter emails válidos." };
    }
    const email = value.trim().toLowerCase();
    if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      return { valid: false, error: "Convidados extras devem conter emails válidos." };
    }
    payloadLength += email.length;
    if (payloadLength > MAX_EXTRA_GUESTS_PAYLOAD_LENGTH) {
      return { valid: false, error: "O tamanho total dos convidados extras excede o limite permitido." };
    }
    if (!guests.includes(email)) guests.push(email);
  }
  return { valid: true, guests };
}

export function validateFutureMeetingDate(date: Date, now = new Date()): string | null {
  if (date.getTime() <= now.getTime()) return "A data da reunião deve ser futura.";
  const latestAllowed = new Date(now.getTime() + MAX_SCHEDULE_HORIZON_DAYS * 24 * 60 * 60 * 1_000);
  if (date.getTime() > latestAllowed.getTime()) {
    return `A data da reunião deve estar dentro dos próximos ${MAX_SCHEDULE_HORIZON_DAYS} dias.`;
  }
  return null;
}

export { MAX_EXTRA_GUESTS, MAX_EMAIL_LENGTH, MAX_EXTRA_GUESTS_PAYLOAD_LENGTH, MAX_SCHEDULE_HORIZON_DAYS };
