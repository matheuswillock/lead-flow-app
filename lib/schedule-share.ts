import { createHash, createHmac } from "node:crypto";

const SCHEDULE_SHARE_TTL_MS = 24 * 60 * 60 * 1000;
const MEETING_JOIN_EARLY_WINDOW_MS = 15 * 60 * 1000;

function getScheduleShareSecret(): string {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY não configurada para compartilhamento de agendamento.");
  }
  return secret;
}

function buildScheduleShareSignature(scheduleId: string, expiresAtIso: string): string {
  return createHmac("sha256", getScheduleShareSecret())
    .update(`${scheduleId}:${expiresAtIso}`)
    .digest("hex");
}

export function generateScheduleShareToken(scheduleId: string, expiresAt: Date): string {
  const expiresAtIso = expiresAt.toISOString();
  const signature = buildScheduleShareSignature(scheduleId, expiresAtIso);
  return Buffer.from(`${scheduleId}.${expiresAtIso}.${signature}`, "utf8").toString("base64url");
}

export function hashScheduleShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseScheduleShareToken(token: string): {
  scheduleId: string;
  expiresAt: Date;
} {
  const decoded = Buffer.from(token, "base64url").toString("utf8");
  const firstDot = decoded.indexOf(".");
  const lastDot = decoded.lastIndexOf(".");
  if (firstDot === -1 || firstDot === lastDot) {
    throw new Error("Token de agendamento inválido.");
  }
  const scheduleId = decoded.slice(0, firstDot);
  const expiresAtIso = decoded.slice(firstDot + 1, lastDot);
  const signature = decoded.slice(lastDot + 1);
  if (!scheduleId || !expiresAtIso || !signature) {
    throw new Error("Token de agendamento inválido.");
  }

  const expiresAt = new Date(expiresAtIso);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error("Token de agendamento inválido.");
  }

  const expectedSignature = buildScheduleShareSignature(scheduleId, expiresAtIso);
  if (signature !== expectedSignature) {
    throw new Error("Token de agendamento inválido.");
  }

  return { scheduleId, expiresAt };
}

export function getScheduleShareExpiry(meetingDate: Date): Date {
  return new Date(meetingDate.getTime() + SCHEDULE_SHARE_TTL_MS);
}

export function getScheduleJoinAvailableAt(meetingDate: Date): Date {
  return new Date(meetingDate.getTime() - MEETING_JOIN_EARLY_WINDOW_MS);
}

export function isScheduleShareExpired(expiresAt?: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}
