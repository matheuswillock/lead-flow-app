export interface AuthCallbackGoogleConnectionEventInput {
  eventType: "started" | "failed";
  flow: "login" | "account" | "backoffice";
  requestId: string;
  errorCategory?: string;
}

export interface IAuthCallbackGoogleConnectionService {
  recordConnectionEvent(input: AuthCallbackGoogleConnectionEventInput): Promise<boolean>;
}
