import { describe, expect, test } from "bun:test";
import { isOutsideWhatsAppWindow, resolveApprovedStudioBotHsmTemplate } from "./hsm";

describe("HSM policy", () => {
  test("requires an approved template outside WhatsApp's 24h window", () => {
    expect(isOutsideWhatsAppWindow(null)).toBeTrue();
    expect(resolveApprovedStudioBotHsmTemplate("meeting.reminder_30m")).toBe("bethania_meeting_reminder");
    expect(resolveApprovedStudioBotHsmTemplate("lead.assigned")).toBeNull();
  });
});
