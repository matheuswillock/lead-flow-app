export const STUDIO_BOT_PUSH_HOURLY_LIMIT = 12;

export function isWithinPushRateLimit(sentCountLastHour: number): boolean {
  return sentCountLastHour < STUDIO_BOT_PUSH_HOURLY_LIMIT;
}
