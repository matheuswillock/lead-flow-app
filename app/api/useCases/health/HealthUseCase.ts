import { Output } from "@/lib/output";
import { healthRepository } from "@/app/api/infra/data/repositories/health/HealthRepository";
import type { IHealthRepository } from "@/app/api/infra/data/repositories/health/IHealthRepository";

/**
 * Health check de infraestrutura consumido pelo smoke test pós-deploy.
 *
 * Responde à única pergunta que as verificações de artefato não respondem:
 * o serviço publicado consegue mesmo falar com o banco? Verificar commit,
 * arquivos e `readyState` prova procedência, não funcionamento.
 */
export class HealthUseCase {
  constructor(private readonly repository: IHealthRepository = healthRepository) {}

  async checkDatabase(): Promise<Output> {
    try {
      await this.repository.pingDatabase();
      return new Output(true, ["Banco acessível"], [], { database: "ok" });
    } catch (error) {
      // Sem detalhe interno no retorno: o endpoint é público e quem consome só
      // precisa do veredito. O diagnóstico fica no log.
      console.error("[HealthUseCase][checkDatabase]", error);
      return new Output(false, [], ["Banco inacessível"], { database: "unreachable" });
    }
  }
}

export const healthUseCase = new HealthUseCase();
