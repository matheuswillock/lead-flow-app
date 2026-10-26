export type LeadMeetingType = "online" | "call" | "whatsapp";

export function isLeadEmailRequiredForMeetingType(meetingType: LeadMeetingType): boolean {
  return meetingType === "online";
}

export function isLeadEmailValidForMeetingType(
  meetingType: LeadMeetingType,
  email: string,
): boolean {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) return !isLeadEmailRequiredForMeetingType(meetingType);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
}
