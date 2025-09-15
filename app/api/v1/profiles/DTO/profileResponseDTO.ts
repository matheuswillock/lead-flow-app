import type { Profile, UserRole } from "@prisma/client";
import { Output } from "@/lib/output";

export interface ProfileResponseDTO {
  email: string;
  phone: string | null;
  fullName: string | null;
  role: UserRole;
  managerId: string | null;
  profileIconId: string | null;
  profileIconUrl: string | null;
}

export function createProfileResponseDTO(profile: Profile): ProfileResponseDTO {
  return {
    email: profile.email,
    phone: profile.phone,
    fullName: profile.fullName,
    role: profile.role,
    managerId: profile.managerId,
    profileIconId: profile.profileIconId,
    profileIconUrl: profile.profileIconUrl,
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
  profile: Profile | null
): Output {
  const successMessage = "Profile retrieved successfully";
  const notFoundMessage = "Profile not found";

  if (!profile) {
    return new Output(false, [], [notFoundMessage], null);
  }

  return new Output(true, [successMessage], [], createProfileResponseDTO(profile));
}