import type { PublicScheduleShareData } from "../services/IPublicScheduleShareService";

export type PublicScheduleShareStatus = "loading" | "ready" | "error";

export interface IPublicScheduleShareState {
  token: string;
  status: PublicScheduleShareStatus;
  data: PublicScheduleShareData | null;
  error: string | null;
}

export interface IPublicScheduleShareActions {
  refresh: () => Promise<void>;
}

export interface IPublicScheduleShareContext
  extends IPublicScheduleShareState,
    IPublicScheduleShareActions {}
