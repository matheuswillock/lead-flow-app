import { TopPerformerCard } from "./TopPerformerCard";

export function PerfTopHighlights() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TopPerformerCard
        title="Top Closer do mês"
        subtitle="Atualizado agora"
        name="Ana Souza"
        role="Closer · Time Comercial Sul"
        avatar="avatar-1"
        value="18"
        suffix="vendas"
        helper="R$ 1.248k em receita"
        accent="primary"
      />

      <TopPerformerCard
        title="Top SDR do mês"
        subtitle="Atualizado agora"
        name="Bruno Lima"
        role="SDR · Time Pré-vendas"
        avatar="avatar-2"
        value="62"
        suffix="agend."
        helper="92% taxa de presença"
        accent="info"
      />
    </div>
  )
}