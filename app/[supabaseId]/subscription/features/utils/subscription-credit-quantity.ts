/**
 * E4 (T-21.11): `Number(event.target.value)` com input vazio produz `NaN`, e
 * `NaN < 1`/`NaN > max` avaliam `false` em JS — o `NaN` passava direto na
 * validação antiga, habilitando o botão com um payload `"quantity": null`.
 *
 * `parseCreditQuantityInput` preserva o valor numérico **completo** e deixa
 * a rejeição para `isCreditQuantityInvalid`, que checa `Number.isInteger`
 * explicitamente. Usar `Number.parseInt` aqui seria pior que o bug original:
 * ele truncaria silenciosamente `1.5` para `1` e o checkout sairia com uma
 * quantidade diferente da que o usuário digitou (achado P2 do Codex no
 * PR #1199). Campo vazio continua virando `NaN` de propósito — `Number('')`
 * é `0`, que passaria como número e só seria pego pelo `< 1`.
 */
export function parseCreditQuantityInput(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return Number.NaN;
  return Number(trimmed);
}

export function isCreditQuantityInvalid(input: {
  quantity: number;
  action: 'add' | 'remove';
  maxRemovable: number;
}): boolean {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return true;
  if (input.action === 'remove' && input.quantity > input.maxRemovable) return true;
  return false;
}
