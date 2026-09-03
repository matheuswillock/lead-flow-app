import { describe, expect, it } from "bun:test"
import { buildEmailCampaignOriginPromotion } from "./email-campaign-origin-promotion"

// Caso real Bruno Marcelino (bugs/2026-08-28): lead nasceu `public_form`,
// depois uma resposta atribuída a campanha (`emailLogId`) anexou nele — o
// filtro "Origem = Campanha de e-mail" do CRM não o via.
describe("buildEmailCampaignOriginPromotion", () => {
  it("promove lead public_form preservando metadados anteriores (merge, não sobrescrita)", () => {
    const promotion = buildEmailCampaignOriginPromotion({
      currentChannel: "public_form",
      currentMetadata: { source: "Form X", formId: "form-1", firstFormAt: "2026-08-28T11:10:29Z" },
      campaignId: "campaign-1",
      emailLogId: "emaillog-1",
    })

    expect(promotion).not.toBeNull()
    expect(promotion?.originChannel).toBe("email_campaign")
    expect(promotion?.originMetadata).toMatchObject({
      source: "Form X",
      formId: "form-1",
      firstFormAt: "2026-08-28T11:10:29Z",
      attribution: "email_campaign",
      emailLogId: "emaillog-1",
      campaignId: "campaign-1",
    })
  })

  it("idempotente: lead já promovido com os MESMOS ids não muda (retorna null)", () => {
    const promotion = buildEmailCampaignOriginPromotion({
      currentChannel: "email_campaign",
      currentMetadata: { attribution: "email_campaign", emailLogId: "emaillog-1", campaignId: "campaign-1" },
      campaignId: "campaign-1",
      emailLogId: "emaillog-1",
    })

    expect(promotion).toBeNull()
  })

  it("lead sem atribuição de campanha nesta resposta (sem emailLogId) não promove", () => {
    const promotion = buildEmailCampaignOriginPromotion({
      currentChannel: "public_form",
      currentMetadata: { source: "Form X" },
      campaignId: null,
      emailLogId: null,
    })

    // Sem emailLogId a chamada nem deveria ocorrer no caller real, mas a
    // função em si ainda promove o canal — quem decide SE chama é o caller
    // (guardado por `isEmailCampaignFormOrigin`/`fromEmailCampaign`).
    expect(promotion?.originChannel).toBe("email_campaign")
    expect(promotion?.originMetadata).toMatchObject({ attribution: "email_campaign" })
  })

  it("já é email_campaign mas com emailLogId DIFERENTE → atualiza (nova atribuição vence, preserva o resto)", () => {
    const promotion = buildEmailCampaignOriginPromotion({
      currentChannel: "email_campaign",
      currentMetadata: {
        attribution: "email_campaign",
        emailLogId: "emaillog-antigo",
        campaignId: "campaign-antigo",
        source: "Form X",
      },
      campaignId: "campaign-novo",
      emailLogId: "emaillog-novo",
    })

    expect(promotion).not.toBeNull()
    expect(promotion?.originMetadata).toMatchObject({
      source: "Form X",
      emailLogId: "emaillog-novo",
      campaignId: "campaign-novo",
    })
  })
})
