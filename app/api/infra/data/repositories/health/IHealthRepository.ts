/**
 * Sonda de conectividade com o banco, usada pelo health check de
 * infraestrutura. Não expõe dados — só responde se a camada de dados está
 * operante no runtime publicado.
 */
export interface IHealthRepository {
  /** Executa a query mais barata possível. Lança se o banco estiver inalcançável. */
  pingDatabase(): Promise<void>;
}
