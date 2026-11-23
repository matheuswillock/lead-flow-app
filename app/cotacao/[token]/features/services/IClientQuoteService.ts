import type { ClientQuoteResult } from "../context/ClientQuoteTypes";

export interface IClientQuoteService {
  getByToken(token: string): Promise<ClientQuoteResult>;
}
