import { describe, expect, it } from "bun:test";
import {
  isLeadEmailRequiredForMeetingType,
  isLeadEmailValidForMeetingType,
} from "./email-requirement";

describe("lead schedule email requirement", () => {
  it("requires email for online meetings", () => {
    expect(isLeadEmailRequiredForMeetingType("online")).toBe(true);
  });

  it("allows call and whatsapp meetings without email", () => {
    expect(isLeadEmailRequiredForMeetingType("call")).toBe(false);
    expect(isLeadEmailRequiredForMeetingType("whatsapp")).toBe(false);
  });

  it("accepts empty email only for call and whatsapp", () => {
    expect(isLeadEmailValidForMeetingType("online", "")).toBe(false);
    expect(isLeadEmailValidForMeetingType("call", "")).toBe(true);
    expect(isLeadEmailValidForMeetingType("whatsapp", "")).toBe(true);
  });

  it("rejects an invalid email when one is provided", () => {
    expect(isLeadEmailValidForMeetingType("call", "invalid")).toBe(false);
    expect(isLeadEmailValidForMeetingType("whatsapp", "invalid")).toBe(false);
  });
});
