export type PasswordResetTelemetryEvent =
  | "page_opened"
  | "verification_started"
  | "token_verified"
  | "token_rejected"
  | "password_updated"
  | "password_update_failed"
  | "expired"
