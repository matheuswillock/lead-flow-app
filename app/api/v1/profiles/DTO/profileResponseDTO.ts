import type { UserRole } from "@prisma/client";
import { Output } from "@/lib/output";

export interface UserAssociated {
  id: string; 
  name: string; 
  avatarImageUrl: string;
  email: string;
  role: UserRole;
}

export interface ProfileResponseDTO {
  id: string;
  email: string;
  supabaseId: string | null;
  phone: string | null;
  fullName: string | null;
  role: UserRole;
  isMaster: boolean;
  hasPermanentSubscription: boolean;
  managerId: string | null;
  profileIconId: string | null;
  profileIconUrl: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  createdAt: string;
  updatedAt: string;
  usersAssociated: UserAssociated[];
}

export function createProfileResponseDTO(profile: any): ProfileResponseDTO {
  const usersAssociated: UserAssociated[] = [];
  
  // SEMPRE incluir o próprio usuário no array como primeiro item
  const currentUser: UserAssociated = {
    id: profile.id,
    name: profile.fullName || 'N/A',
    avatarImageUrl: profile.profileIconUrl || '',
    email: profile.email,
    role: profile.role
  };
  
  usersAssociated.push(currentUser);
  
  // Se for manager, incluir TAMBÉM todos os operadores (evitando duplicatas)
  if (profile.role === 'manager' && profile.operators && profile.operators.length > 0) {
    const operators = profile.operators
      .filter((operator: any) => operator.id !== profile.id) // Evitar duplicar o próprio usuário
      .map((operator: any) => ({
        id: operator.id,
        name: operator.fullName || 'N/A',
        avatarImageUrl: operator.profileIconUrl || '',
        email: operator.email,
        role: operator.role
      }));
    
    usersAssociated.push(...operators);
  }
  
  // Garantir que sempre há pelo menos 1 usuário (o próprio)
  if (usersAssociated.length === 0) {
    usersAssociated.push(currentUser);
  }
  
  return {
    id: profile.id,
    email: profile.email,
    supabaseId: profile.supabaseId,
    phone: profile.phone,
    fullName: profile.fullName,
    role: profile.role,
    isMaster: profile.isMaster ?? false,
    hasPermanentSubscription: profile.hasPermanentSubscription ?? false,
    managerId: profile.managerId,
    profileIconId: profile.profileIconId,
    profileIconUrl: profile.profileIconUrl,
    subscriptionId: profile.subscriptionId ?? null,
    subscriptionStatus: profile.subscriptionStatus ?? null,
    createdAt: (profile.createdAt instanceof Date ? profile.createdAt.toISOString() : profile.createdAt) as string,
    updatedAt: (profile.updatedAt instanceof Date ? profile.updatedAt.toISOString() : profile.updatedAt) as string,
    usersAssociated,
  };
}

/**
 * Creates an Output object from a profile
 * @param profile - The profile object (can be null)
 * @param successMessage - Message to use when profile is found
 * @param notFoundMessage - Message to use when profile is null
 * @returns Output object with appropriate success/error state
 */
export function createProfileOutput(
  profile: any | null
): Output {
  const successMessage = "Profile retrieved successfully";
  const notFoundMessage = "Profile not found";

  if (!profile) {
    return new Output(false, [], [notFoundMessage], null);
  }

  return new Output(true, [successMessage], [], createProfileResponseDTO(profile));
}

