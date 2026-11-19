import { describe, expect, it } from "bun:test";
import { splitUnifiedSearch } from "./unifiedSearch";

describe("splitUnifiedSearch", () => {
  it("envia texto com letras só como nome", () => {
    expect(splitUnifiedSearch("Empresa E2E Carteira LTDA")).toEqual({
      search: "Empresa E2E Carteira LTDA",
      documentSearch: "",
    });
  });

  it("envia CPF/CNPJ só como documento", () => {
    expect(splitUnifiedSearch("12345678000199")).toEqual({ search: "", documentSearch: "12345678000199" });
    expect(splitUnifiedSearch("123.456.789-00")).toEqual({ search: "", documentSearch: "123.456.789-00" });
    expect(splitUnifiedSearch("12.345.678/0001-99")).toEqual({ search: "", documentSearch: "12.345.678/0001-99" });
  });

  it("trata nome com número como nome", () => {
    expect(splitUnifiedSearch("João 123")).toEqual({ search: "João 123", documentSearch: "" });
  });

  it("não envia nada para busca vazia ou só com espaços", () => {
    expect(splitUnifiedSearch("")).toEqual({ search: "", documentSearch: "" });
    expect(splitUnifiedSearch("   ")).toEqual({ search: "", documentSearch: "" });
  });
});
