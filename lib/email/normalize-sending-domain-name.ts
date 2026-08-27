const PROTOCOL_PREFIX_RE = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * Normaliza o que o operador digita no campo de domínio para o formato que o
 * provedor aceita: só o host, minúsculo, sem esquema, sem caminho e sem
 * espaços.
 *
 * Existe porque a primeira tentativa real de conectar `suitseguros.com.br`
 * (27/08) foi enviada como `http://suitseguros.com.br/` e tomou 422 do
 * provedor — colar a URL da barra de endereço é o caminho natural de quem está
 * na tela, não um erro exótico.
 *
 * Devolve string vazia quando não sobra host nenhum; a validação de tamanho
 * fica com quem chama, para manter a mensagem de erro do fluxo.
 */
export function normalizeSendingDomainName(rawDomainName: string): string {
  const withoutProtocol = rawDomainName.trim().replace(PROTOCOL_PREFIX_RE, "")
  const hostOnly = withoutProtocol.split("/")[0] ?? ""
  return hostOnly.trim().toLowerCase()
}
