/**
 * E4 (T-21.11): `Number(event.target.value)` com input vazio produz `NaN`, e
 * `NaN < 1`/`NaN > max` avaliam `false` em JS — o `NaN` passava direto na
 * validação antiga, habilitando o botão com um payload `"quantity": null`.
 * `parseCreditQuantityInput` usa `Number.parseInt` e nunca disfarça um campo
 * vazio/inválido como um número válido; `isCreditQuantityInvalid` checa
 * `Number.isInteger` explicitamente antes de qualquer comparação numérica.
 */
export function parseCreditQuantityInput(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return Number.NaN;
  return Number.parseInt(trimmed, 10);
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
