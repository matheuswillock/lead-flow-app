export const CONTACT_IMPORT_MAX_FILE_BYTES = Math.round(4.5 * 1024 * 1024);
export const CONTACT_IMPORT_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

export type ContactImportBlockKind =
  | "multiple_sheets"
  | "file_too_large"
  | "payload_too_large";

export type ContactImportBlock = {
  kind: ContactImportBlockKind;
  message: string;
};

export type EvaluateContactImportBlocksInput = {
  sheetNames: string[];
  fileSizeBytes: number;
  payloadJsonBytes: number;
};

function formatMegabytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  const rounded =
    megabytes >= 10 ? Math.round(megabytes) : Math.round(megabytes * 10) / 10;
  return `${String(rounded).replace(".", ",")} MB`;
}

function buildMultipleSheetsMessage(sheetNames: string[]): string {
  return `A planilha tem mais de uma aba (${sheetNames.join(", ")}). Deixe apenas uma aba e envie de novo.`;
}

function buildFileTooLargeMessage(fileSizeBytes: number): string {
  return `O arquivo tem ${formatMegabytes(fileSizeBytes)} (o limite é 4,5 MB). Envie um arquivo menor ou divida a planilha.`;
}

function buildPayloadTooLargeMessage(payloadJsonBytes: number): string {
  return `Os dados mapeados ficam grandes demais para enviar (cerca de ${formatMegabytes(payloadJsonBytes)}; o limite é 4 MB). Remova colunas pesadas ou divida o arquivo.`;
}

export function evaluateContactImportBlocks(
  input: EvaluateContactImportBlocksInput
): ContactImportBlock[] {
  const blocks: ContactImportBlock[] = [];

  if (input.sheetNames.length > 1) {
    blocks.push({
      kind: "multiple_sheets",
      message: buildMultipleSheetsMessage(input.sheetNames),
    });
  }

  if (input.fileSizeBytes > CONTACT_IMPORT_MAX_FILE_BYTES) {
    blocks.push({
      kind: "file_too_large",
      message: buildFileTooLargeMessage(input.fileSizeBytes),
    });
  }

  if (input.payloadJsonBytes > CONTACT_IMPORT_MAX_PAYLOAD_BYTES) {
    blocks.push({
      kind: "payload_too_large",
      message: buildPayloadTooLargeMessage(input.payloadJsonBytes),
    });
  }

  return blocks;
}

export function measureContactImportPayloadBytes(
  rows: unknown[]
): number {
  return JSON.stringify({ rows }).length;
}
