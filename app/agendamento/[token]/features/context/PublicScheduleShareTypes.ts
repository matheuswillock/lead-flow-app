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

export interface IPublicScheduleShareProviderProps {
  token: string;
  children: React.ReactNode;
  /** Dados pré-carregados pelo Server Component (evita requisição visível no Network). */
  initialData?: PublicScheduleShareData | null;
}
