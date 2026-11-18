import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { ReadOnlyFieldset } from "./ReadOnlyFieldset"

test("em somente leitura desabilita os controles dentro, sem mexer no layout", () => {
  const markup = renderToStaticMarkup(
    <ReadOnlyFieldset readOnly>
      <button type="button">Salvar</button>
    </ReadOnlyFieldset>
  )

  expect(markup).toContain("<fieldset")
  expect(markup).toContain("disabled")
  expect(markup).toContain("contents")
  expect(markup).toContain("Salvar")
})

test("mantém legíveis só os campos visíveis: o input oculto do checkbox não pode ficar opaco", () => {
  const markup = renderToStaticMarkup(
    <ReadOnlyFieldset readOnly>
      <input aria-label="nome" />
    </ReadOnlyFieldset>
  )

  // O Radix cria um <input aria-hidden> com opacity 0 inline para o checkbox; forçar opacidade total nele o revela.
  expect(markup).toContain("input:disabled:not([aria-hidden=true])")
  expect(markup).not.toContain("[&_input:disabled]:opacity-100!")
  expect(markup).not.toContain("[&amp;_input:disabled]:opacity-100!")
})

test("com acesso pleno não adiciona nenhum elemento ao DOM", () => {
  const markup = renderToStaticMarkup(
    <ReadOnlyFieldset readOnly={false}>
      <button type="button">Salvar</button>
    </ReadOnlyFieldset>
  )

  expect(markup).toBe('<button type="button">Salvar</button>')
})
