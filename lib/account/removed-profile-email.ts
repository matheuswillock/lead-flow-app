/**
 * E-mail de tombstone de um perfil removido (soft-delete).
 *
 * `Profile.email` é único e a remoção não apaga a linha, então sem trocar o
 * e-mail o endereço fica preso e impede uma nova adesão. O tombstone é único
 * por perfil e não é um endereço real.
 */
export function removedProfileEmailFor(profileId: string): string {
  return `removido-${profileId}@removido.invalid`
}
