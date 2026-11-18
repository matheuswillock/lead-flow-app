// Busca unificada: o servidor combina `search` (nome) e `documentSearch` (documento) com AND,
// então o texto vai para um só dos dois campos conforme o formato.
const DOCUMENT_LIKE = /^[\d.\-/\s]+$/;

export function splitUnifiedSearch(raw: string): { search: string; documentSearch: string } {
  const value = raw.trim();
  if (value && /\d/.test(value) && DOCUMENT_LIKE.test(value)) {
    return { search: "", documentSearch: value };
  }
  return { search: value, documentSearch: "" };
}
