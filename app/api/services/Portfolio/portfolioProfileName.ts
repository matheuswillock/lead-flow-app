/**
 * Nome do SDR/closer na carteira. Quem saiu da corretora (perfil excluído) continua aparecendo com
 * o nome que estava atribuído ao cliente, marcado como desligado.
 */
export function portfolioProfileName(profile: { fullName: string | null; deletedAt: Date | null }): string {
  const name = profile.fullName ?? '';
  return profile.deletedAt && name ? `${name} (desligado)` : name;
}
