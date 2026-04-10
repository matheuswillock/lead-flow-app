import readXlsxFile from "read-excel-file/node";

export async function readXlsxRowsFromBuffer(buffer: ArrayBuffer): Promise<unknown[][]> {
  const [sheet] = await readXlsxFile(Buffer.from(buffer));
  return sheet?.data ?? [];
}

export async function readXlsxRowsFromFile(filePath: string): Promise<unknown[][]> {
  const [sheet] = await readXlsxFile(filePath);
  return sheet?.data ?? [];
}
