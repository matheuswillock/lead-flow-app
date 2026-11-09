import { teamDeletionJobRepository } from "@/app/api/infra/data/repositories/teamDeletion/TeamDeletionJobRepository"
import { teamDeletionSnapshotRepository } from "@/app/api/infra/data/repositories/teamDeletion/TeamDeletionSnapshotRepository"
import { memberRemovalFollowUpService } from "@/app/api/services/memberRemoval/MemberRemovalFollowUpService"
import { TeamDeletionService } from "@/app/api/services/teamDeletion/TeamDeletionService"
import { teamDataExporter } from "@/app/api/services/teamExport/TeamDataExporter"
import { teamExportNotifier } from "@/app/api/services/teamExport/TeamExportNotifier"
import { teamExportStorage, teamStorageCleaner } from "@/app/api/services/teamExport/TeamExportStorage"
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase"
import { teamManagementUseCase } from "@/app/api/useCases/teamManagement/TeamManagementUseCase"
import { TeamDeletionUseCase } from "./TeamDeletionUseCase"

const teamDeletionService = new TeamDeletionService(
  teamDeletionSnapshotRepository,
  teamManagementUseCase,
  memberRemovalFollowUpService,
  teamStorageCleaner,
  memberProBillingUseCase,
)

export const teamDeletionUseCase = new TeamDeletionUseCase(
  teamDeletionJobRepository,
  teamExportStorage,
  teamDataExporter,
  teamDeletionService,
  teamExportNotifier,
  teamDeletionSnapshotRepository,
)
