import { Output } from "@/lib/output";
import type { Profile } from "@prisma/client";

/**
 * Interface para resposta de atualização de perfil
 * Contém apenas os campos que devem ser retornados: email, fullName e phone
 */
export interface ProfileUpdateResponse {
  email: string;
  fullName: string;
  phone: string;
}

/**
 * Cria um objeto Output com dados de resposta de atualização de perfil
 * @param profile - Profile completo do banco de dados
 * @returns Output com dados limitados ou erro se profile for null
 */
export function createProfileUpdateOutput(profile: Profile | null): Output {
  if (!profile) {
    return new Output(false, [], ["Profile not found"], null);
  }

  // Verificar se todos os campos obrigatórios estão presentes
  if (!profile.email || !profile.fullName || !profile.phone) {
    return new Output(false, [], ["Profile data is incomplete"], null);
  }

  const updateResponse: ProfileUpdateResponse = {
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phone
  };

  return new Output(
    true,
    ["Profile updated successfully"],
    [],
    updateResponse
  );
}

/**
 * Valida e cria resposta de atualização a partir de dados do profile
 * @param profile - Profile do banco de dados
 * @returns ProfileUpdateResponse com campos validados
 * @throws Error se algum campo obrigatório estiver ausente
 */
export function validateProfileUpdateResponse(profile: Profile): ProfileUpdateResponse {
  if (!profile.email || !profile.fullName || !profile.phone) {
    throw new Error('Profile data is incomplete. Missing required fields: email, fullName, or phone.');
  }

  return {
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phone
  };
}