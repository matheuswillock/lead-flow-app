import { teamExportDataRepository } from "@/app/api/infra/data/repositories/teamDeletion/TeamExportDataRepository"
import type { ITeamDataExporter } from "@/app/api/shared/teamDeletion/teamDeletionTypes"
import { buildTeamExportZip, type ExportTable } from "./TeamExportBuilder"

export interface ITeamExportTableSource {
  collect(teamId: string): Promise<ExportTable[]>
}

/** Lê as informações do time e monta o ZIP de planilhas da exportação. */
export class TeamDataExporter implements ITeamDataExporter {
  constructor(private readonly source: ITeamExportTableSource = teamExportDataRepository) {}

  async buildZip(input: { teamId: string; teamName: string; generatedAt: Date }) {
    const tables = await this.source.collect(input.teamId)
    return buildTeamExportZip({ teamName: input.teamName, generatedAt: input.generatedAt, tables })
  }
}

export const teamDataExporter = new TeamDataExporter()
