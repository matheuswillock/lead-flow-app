# Fatos da landing — auto self checkout

| Claim | Valor exibido | Fonte | Pode ir ao ar |
|---|---|---|---|
| O visitante pode escolher um plano e ciclo disponíveis para contratação online | Opções dinâmicas do produto CRM padrão, carregadas do servidor | `app/api/services/backofficeAdhesion/BackofficeAdhesionService.ts:291-307`; `app/checkout/features/container/SelfCheckoutContainer.tsx:83-104` | Sim |
| Esta contratação é paga por PIX | PIX à vista na etapa seguinte | `app/api/services/backofficeAdhesion/BackofficeAdhesionService.ts:311-329`; `app/checkout/features/container/SelfCheckoutContainer.tsx:132` | Sim |
| Preço, desconto, gratuidade, prazo ou resultado comercial | Nenhum valor fixo ou promessa será anunciado pela landing neste CTA | A tela `/checkout` recebe os valores e ciclos configurados em runtime | Não se aplica |
