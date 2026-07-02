export const IMPORT_BATCH_SIZE = 25;

export type ImportOutputResponse<T> = {
  isValid?: boolean;
  errorMessages?: string[];
  result?: T;
};

export function getImportHttpErrorMessage(
  status: number,
  entityLabel = "itens"
): string {
  if (status === 504 || status === 502) {
    return `A importação demorou demais e foi interrompida. Tente novamente — os ${entityLabel} já importados foram salvos.`;
  }
  if (status === 429) {
    return "Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.";
  }
  if (status === 403) {
    return "Você não tem permissão para realizar esta importação.";
  }
  return "Erro ao importar";
}

export async function parseImportOutputResponse<T>(
  response: Response,
  entityLabel = "itens"
): Promise<ImportOutputResponse<T>> {
  const text = await response.text();

  if (!text) {
    if (!response.ok) {
      throw new Error(getImportHttpErrorMessage(response.status, entityLabel));
    }
    return {};
  }

  try {
    return JSON.parse(text) as ImportOutputResponse<T>;
  } catch {
    throw new Error(getImportHttpErrorMessage(response.status, entityLabel));
  }
}

export async function runImportInBatches<TRow, TResult>(options: {
  rows: TRow[];
  batchSize?: number;
  onProgress?: (processed: number, total: number) => void;
  importBatch: (batch: TRow[]) => Promise<TResult>;
  mergeResults: (current: TResult, batch: TResult) => TResult;
  emptyResult: TResult;
}): Promise<TResult> {
  const { rows, onProgress, importBatch, mergeResults, emptyResult } = options;
  const batchSize = options.batchSize ?? IMPORT_BATCH_SIZE;
  const total = rows.length;

  onProgress?.(0, total);

  let aggregated = emptyResult;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const batchResult = await importBatch(batch);
    aggregated = mergeResults(aggregated, batchResult);
    onProgress?.(Math.min(index + batch.length, total), total);
  }

  return aggregated;
}
