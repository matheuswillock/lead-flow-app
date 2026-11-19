const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBrl(value: number | null | undefined): string {
  return value == null ? "—" : brl.format(value);
}

export function formatVidas(n: number): string {
  return `${n} ${n === 1 ? "vida" : "vidas"}`;
}
