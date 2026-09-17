/**
 * Pedaço de NDJSON pronto para ser escrito no arquivo do modelo.
 *
 * O tamanho de `ndjson` é limitado por bytes acumulados (não por número de
 * registros), então nenhuma string cresce junto com o tamanho da tabela. Era
 * exatamente isso que estourava o limite máximo de string do V8 e produzia
 * `Invalid string length` quando o export serializava a tabela inteira de uma vez.
 */
export type BackupModelChunk = {
  modelName: string
  ndjson: string
  rowCount: number
}

/**
 * Consumidor dos pedaços produzidos pelo export.
 *
 * É aguardado (`await`) a cada pedaço, então funciona como contrapressão:
 * enquanto o destino não drena, o export para de ler o banco.
 */
export type BackupChunkWriter = (chunk: BackupModelChunk) => Promise<void>

export type BackupSnapshotSummary = {
  modelCount: number
  rowCount: number
}

export interface IBackofficeDatabaseBackupExportRepository {
  /**
   * Nomes dos modelos que entram no backup, na ordem em que serão exportados.
   * Permite que o consumidor crie os arquivos do container antes de começar.
   */
  listExportableModelNames(): string[]

  /**
   * Exporta todas as tabelas não-binárias em pedaços NDJSON, na ordem de
   * `listExportableModelNames()`.
   *
   * Consistência: cada modelo é lido dentro da própria transação
   * `RepeatableRead`, garantindo que todas as páginas de uma mesma tabela venham
   * do mesmo snapshot. Não há snapshot único do banco inteiro — ver a
   * justificativa em `BackofficeDatabaseBackupExportRepository`.
   */
  exportSnapshot(writeChunk: BackupChunkWriter): Promise<BackupSnapshotSummary>
}
