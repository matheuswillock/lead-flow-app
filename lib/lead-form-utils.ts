export const MAX_CURRENCY_VALUE = 9_999_999_999.99;
export const MAX_CURRENCY_LABEL = "10.000.000.000,00";

export const parseCurrencyValue = (value: string): number | null => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  const cents = digits.slice(-2).padStart(2, "0");
  const intPart = digits.slice(0, -2) || "0";
  return parseFloat(`${intPart}.${cents}`);
};

export const toCurrencyStorageValue = (value: string): string | null => {
  const parsed = parseCurrencyValue(value);
  if (parsed === null || Number.isNaN(parsed)) return null;
  return parsed.toFixed(2);
};

export const formatCurrencyInput = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const cents = digits.slice(-2).padStart(2, "0");
  const intPart = digits.slice(0, -2) || "0";
  const formattedInt = Number(intPart).toLocaleString("pt-BR");
  return `R$ ${formattedInt},${cents}`;
};
