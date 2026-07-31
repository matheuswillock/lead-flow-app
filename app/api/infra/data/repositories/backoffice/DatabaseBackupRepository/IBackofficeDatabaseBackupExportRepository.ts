export interface IBackofficeDatabaseBackupExportRepository {
  /**
   * Exporta todas as tabelas não-binárias em um snapshot RepeatableRead.
   * Retorna um map de nome-do-modelo → array de rows serializadas como string JSON.
   */
  exportSnapshot(): Promise<Map<string, string>>
}
