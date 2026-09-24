import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WebhookPayloadPreview } from "./WebhookPayloadPreview";

const writeText = mock(async (_value: string) => {});
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText },
});

describe("WebhookPayloadPreview", () => {
  test("exibe o payload do evento selecionado e acompanha mudanças de preset", () => {
    const view = render(
      <WebhookPayloadPreview selectedEvents={["lead_created"]} destinationPreset="generic" />
    );

    expect(screen.getByText(/"type": "lead_created"/)).toBeTruthy();

    view.rerender(
      <WebhookPayloadPreview selectedEvents={["activity_created"]} destinationPreset="teams" />
    );

    expect(screen.getByText(/"@type": "MessageCard"/)).toBeTruthy();
    expect(screen.getByText(/"title": "activity_created"/)).toBeTruthy();
  });

  test("copia exatamente o JSON exibido", async () => {
    writeText.mockClear();
    render(<WebhookPayloadPreview selectedEvents={["lead_created"]} destinationPreset="generic" />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar modelo do payload" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]?.[0]).toContain('"type": "lead_created"');
  });
});
