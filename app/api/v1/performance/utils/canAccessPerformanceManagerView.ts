import type { TeamAccess } from '@/app/api/v1/utils/teamAccess';

export function canAccessPerformanceManagerView(access: TeamAccess): boolean {
  return access.isMaster || access.teamMember.role === 'manager';
}
