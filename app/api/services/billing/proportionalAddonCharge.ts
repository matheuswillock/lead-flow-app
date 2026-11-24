export class ProportionalChargeError extends Error {
  constructor() {
    super("Não foi possível calcular a cobrança proporcional: a assinatura não tem data de fim de ciclo.");
    this.name = "ProportionalChargeError";
  }
}

export type ProportionalAddonCharge = {
  remainingMonths: number;
  totalCharge: number;
};

type ProportionalAddonChargeInput = {
  billingDelta: number;
  endDate: Date | null;
  now?: Date;
};

const roundCurrency = (value: number) => Number(value.toFixed(2));
const roundMonths = (value: number) => Math.round(value * 100) / 100;

// Limitação: os dias são contados em UTC (a data é normalizada para o dia UTC). Perto da virada
// do dia no fuso do master, a contagem pode diferir em até um dia.
const utcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

// Data do mesmo dia do mês, `months` meses depois (dia limitado ao último dia do mês de destino).
function addMonthsUtc(startDay: number, months: number): number {
  const start = new Date(startDay);
  const year = start.getUTCFullYear();
  const targetMonth = start.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  return Date.UTC(year, targetMonth, Math.min(start.getUTCDate(), lastDayOfTargetMonth));
}

// Meses inteiros completos (aniversários do dia de hoje que não passaram do fim) + fração do mês parcial.
function monthsUntil(today: number, endDay: number): number {
  let fullMonths = 0;
  while (addMonthsUtc(today, fullMonths + 1) <= endDay) fullMonths++;

  const periodStart = addMonthsUtc(today, fullMonths);
  const periodEnd = addMonthsUtc(today, fullMonths + 1);
  return fullMonths + (endDay - periodStart) / (periodEnd - periodStart);
}

// Sem data de fim não há cobrança possível: lança em vez de cobrar um mês por suposição.
// Sem delta (assinatura permanente) não há cobrança a calcular, então não exige a data.
export function calculateProportionalAddonCharge({
  billingDelta,
  endDate,
  now = new Date(),
}: ProportionalAddonChargeInput): ProportionalAddonCharge {
  if (!endDate || Number.isNaN(endDate.getTime())) {
    if (billingDelta <= 0) return { remainingMonths: 0, totalCharge: 0 };
    throw new ProportionalChargeError();
  }

  const today = utcDay(now);
  const endDay = utcDay(endDate);
  const exactMonths = endDay <= today ? 0 : monthsUntil(today, endDay);
  const remainingMonths = Math.max(1, roundMonths(exactMonths));

  return {
    remainingMonths,
    totalCharge: roundCurrency(billingDelta * remainingMonths),
  };
}
