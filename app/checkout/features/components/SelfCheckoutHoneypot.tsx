"use client"

/**
 * Armadilha para robôs: fora da viewport, fora da ordem de tabulação e oculta de leitores de tela.
 * Pessoas nunca preenchem; o backend descarta qualquer pedido com valor aqui.
 * O pai precisa ser `relative` para o posicionamento não afetar o layout.
 */
export function SelfCheckoutHoneypot({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[9999px] top-0 size-px overflow-hidden opacity-0"
    >
      <label htmlFor="self-checkout-website">Não preencha este campo</label>
      <input
        id="self-checkout-website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
