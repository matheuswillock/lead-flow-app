import { operatorsData } from "@/lib/landing/operators-data"

export function OperatorsMarquee() {
  const loop = [...operatorsData, ...operatorsData]

  return (
    <section className="border-y border-landing-line bg-card py-6" aria-label="Operadoras atendidas">
      <div className="landing-marquee">
        <div className="landing-marquee-track">
          {loop.map((operator, index) => (
            <span
              key={`${operator}-${index}`}
              className="landing-operator-mark"
              aria-hidden={index >= operatorsData.length}
            >
              {operator}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
