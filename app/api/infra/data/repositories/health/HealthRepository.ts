import { prisma } from "@/app/api/infra/data/prisma";
import type { IHealthRepository } from "./IHealthRepository";

class HealthRepository implements IHealthRepository {
  private readonly db = prisma;

  /**
   * `SELECT 1` é trivial de propósito: o objetivo não é medir o banco, é
   * provar que o Prisma Client carrega o query engine no runtime publicado e
   * consegue abrir conexão. Em 22/08/2026 um deploy íntegro subiu com o engine
   * compilado para outra plataforma e derrubou toda rota que tocava o banco.
   */
  async pingDatabase(): Promise<void> {
    await this.db.$queryRaw`SELECT 1`;
  }
}

export const healthRepository: IHealthRepository = new HealthRepository();
