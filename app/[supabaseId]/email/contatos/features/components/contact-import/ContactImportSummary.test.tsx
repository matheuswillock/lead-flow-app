import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { buildContactImportPreview } from "@/lib/emailContactImport/buildContactImportPreview";
import type { ContactImportBlock } from "@/lib/emailContactImport/evaluateContactImportBlocks";
import { ContactImportSummary } from "./ContactImportSummary";

const preview = buildContactImportPreview([
  { line: 1, email: "contato@exemplo.com.br", name: "Contato" },
]);

describe("ContactImportSummary", () => {
  it("mostra a tela de recusa no lugar de Pronto para importar", () => {
    const blocks: ContactImportBlock[] = [
      {
        kind: "multiple_sheets",
        message:
          "A planilha tem mais de uma aba (Sheet1, Planilha1). Deixe apenas uma aba e envie de novo.",
      },
      {
        kind: "payload_too_large",
        message:
          "Os dados mapeados ficam grandes demais para enviar (cerca de 12 MB; o limite é 4 MB). Remova colunas pesadas ou divida o arquivo.",
      },
    ];

    const html = renderToStaticMarkup(
      <ContactImportSummary
        fileName="contatos.xlsx"
        preview={preview}
        mapping={{ email: "email", name: "nome" }}
        blocks={blocks}
      />
    );

    expect(html).toContain("Não podemos importar por causa do seguinte:");
    expect(html).toContain("Sheet1, Planilha1");
    expect(html).toContain("cerca de 12 MB");
    expect(html).toContain("o limite é 4 MB");
    expect(html).not.toContain("Pronto para importar");
    expect(html).not.toContain("Iniciar importação");
    expect(html).not.toContain("processada em segundo plano");
  });
});
