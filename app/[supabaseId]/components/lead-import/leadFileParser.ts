export interface ParsedLeadRow {
  /** Linha original no arquivo (planilha) ou posição do item (JSON), começando em 1. */
  line: number;
  values: Record<string, string>;
}

export interface ParsedLeadFile {
  columns: string[];
  rows: ParsedLeadRow[];
}

const toCellString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${value.getFullYear()}`;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (typeof value === "object") return "";
  return String(value).trim();
};

const buildRows = (columns: string[], matrix: unknown[][], firstLine: number): ParsedLeadRow[] =>
  matrix
    .map((cells, index) => {
      const values: Record<string, string> = {};
      columns.forEach((column, columnIndex) => {
        values[column] = toCellString(cells[columnIndex]);
      });
      return { line: firstLine + index, values };
    })
    .filter((row) => Object.values(row.values).some((value) => value !== ""));

const parseXlsxFile = async (file: File): Promise<ParsedLeadFile> => {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("A planilha está vazia");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: true,
  });

  const headerRow = matrix[0] ?? [];
  const columns = headerRow
    .map((cell) => toCellString(cell))
    .map((cell, index) => cell || `Coluna ${index + 1}`);

  if (columns.length === 0) {
    throw new Error("Não foi possível identificar as colunas da planilha");
  }

  return { columns, rows: buildRows(columns, matrix.slice(1), 2) };
};

const parseJsonFile = async (file: File): Promise<ParsedLeadFile> => {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("O arquivo JSON é inválido");
  }

  let items: unknown[] | null = null;
  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === "object") {
    const arrayValues = Object.values(data).filter((value) => Array.isArray(value));
    if (arrayValues.length === 1) {
      items = arrayValues[0] as unknown[];
    }
  }

  if (!items) {
    throw new Error("O JSON deve ser uma lista de objetos ou um objeto com uma única lista de leads");
  }

  const objects = items.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
  if (objects.length === 0) {
    throw new Error("Nenhum objeto de lead foi encontrado no JSON");
  }

  const columnSet = new Set<string>();
  objects.forEach((item) => {
    Object.keys(item).forEach((key) => columnSet.add(key));
  });
  const columns = Array.from(columnSet);

  const rows = objects
    .map((item, index) => {
      const values: Record<string, string> = {};
      columns.forEach((column) => {
        values[column] = toCellString(item[column]);
      });
      return { line: index + 1, values };
    })
    .filter((row) => Object.values(row.values).some((value) => value !== ""));

  return { columns, rows };
};

export async function parseLeadFile(file: File): Promise<ParsedLeadFile> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".xlsx")) {
    return parseXlsxFile(file);
  }
  if (fileName.endsWith(".json")) {
    return parseJsonFile(file);
  }
  throw new Error("Formato não suportado. Envie um arquivo .xlsx ou .json");
}
