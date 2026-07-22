export type ParsedDialerContact = {
  name: string;
  phone: string;
  email: string | null;
  metadata: Record<string, unknown> | null;
};

export type DialerContactParseResult = {
  contacts: ParsedDialerContact[];
  skipped: number;
  errors: string[];
};

export interface IDialerContactParserService {
  parseXlsx(buffer: Buffer): DialerContactParseResult;
  parseJson(content: string): DialerContactParseResult;
}
