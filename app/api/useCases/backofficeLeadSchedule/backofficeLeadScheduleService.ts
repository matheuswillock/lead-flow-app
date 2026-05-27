import { BackofficeLeadScheduleService } from "@/app/api/services/Backoffice/backofficeLeadSchedule/BackofficeLeadScheduleService"
import { BackofficeLeadScheduleRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadSchedule/BackofficeLeadScheduleRepository"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/BackofficeLeadRepository"
import { backofficeGoogleConnectionResolverService } from "@/app/api/services/Backoffice/backofficeGoogleConnection/BackofficeGoogleConnectionResolverService"
import {
  backofficeGoogleCalendarService,
} from "@/app/api/services/Backoffice/backofficeGoogleCalendar/BackofficeGoogleCalendarService"
import {
  backofficeLeadScheduleInviteService,
} from "@/app/api/services/Backoffice/backofficeLeadSchedule/BackofficeLeadScheduleInviteService"

export const backofficeLeadScheduleService = new BackofficeLeadScheduleService(
  new BackofficeLeadScheduleRepository(),
  new BackofficeUserRepository(),
  backofficeGoogleConnectionResolverService,
  new BackofficeLeadRepository(),
  backofficeGoogleCalendarService,
  backofficeLeadScheduleInviteService
)
