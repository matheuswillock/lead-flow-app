import { describe, expect, it } from "bun:test";
import {
  CONTACT_IMPORT_MAX_FILE_BYTES,
  CONTACT_IMPORT_MAX_PAYLOAD_BYTES,
  evaluateContactImportBlocks,
  measureContactImportPayloadBytes,
} from "./evaluateContactImportBlocks";

const LISTA4_FILE_BYTES = Math.round(3.45 * 1024 * 1024);
const TWELVE_MB = 12 * 1024 * 1024;

describe("evaluateContactImportBlocks", () => {
  it("bloqueia planilha com duas abas e cita os nomes", () => {
    const blocks = evaluateContactImportBlocks({
      sheetNames: ["Sheet1", "Planilha1"],
      fileSizeBytes: LISTA4_FILE_BYTES,
      payloadJsonBytes: 1024,
    });

    expect(blocks).toEqual([
      {
        kind: "multiple_sheets",
        message:
          "A planilha tem mais de uma aba (Sheet1, Planilha1). Deixe apenas uma aba e envie de novo.",
      },
    ]);
  });

  it("bloqueia payload de 12 MB e cita o limite de 4 MB", () => {
    const blocks = evaluateContactImportBlocks({
      sheetNames: ["Sheet1"],
      fileSizeBytes: LISTA4_FILE_BYTES,
      payloadJsonBytes: TWELVE_MB,
    });

    expect(blocks).toEqual([
      {
        kind: "payload_too_large",
        message:
          "Os dados mapeados ficam grandes demais para enviar (cerca de 12 MB; o limite é 4 MB). Remova colunas pesadas ou divida o arquivo.",
      },
    ]);
  });

  it("não bloqueia quando o arquivo e o JSON estão dentro do limite", () => {
    const rows = [{ email: "contato@exemplo.com.br", name: "Contato" }];
    const payloadJsonBytes = measureContactImportPayloadBytes(rows);

    expect(LISTA4_FILE_BYTES).toBeLessThanOrEqual(CONTACT_IMPORT_MAX_FILE_BYTES);
    expect(payloadJsonBytes).toBeLessThanOrEqual(CONTACT_IMPORT_MAX_PAYLOAD_BYTES);

    const blocks = evaluateContactImportBlocks({
      sheetNames: ["Sheet1"],
      fileSizeBytes: LISTA4_FILE_BYTES,
      payloadJsonBytes,
    });

    expect(blocks).toEqual([]);
  });

  it("acumula multi-aba e payload grande no mesmo resultado", () => {
    const blocks = evaluateContactImportBlocks({
      sheetNames: ["Sheet1", "Planilha1"],
      fileSizeBytes: LISTA4_FILE_BYTES,
      payloadJsonBytes: TWELVE_MB,
    });

    expect(blocks.map((block) => block.kind)).toEqual([
      "multiple_sheets",
      "payload_too_large",
    ]);
  });
});
