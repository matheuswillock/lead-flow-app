import type { ReactNode } from "react"

type ReadOnlyFieldsetProps = {
  readOnly: boolean
  children: ReactNode
}

/**
 * Em somente leitura, desabilita todos os controles nativos dos filhos (inputs, selects,
 * botões) sem criar caixa no layout. Com acesso pleno devolve os filhos como estão.
 */
export function ReadOnlyFieldset({ readOnly, children }: ReadOnlyFieldsetProps) {
  if (!readOnly) return <>{children}</>

  return (
    // Os dados precisam continuar legíveis: campos de leitura mantêm a opacidade normal;
    // só os botões seguem esmaecidos para não parecerem clicáveis. O input oculto do checkbox
    // (Radix, aria-hidden, opacity 0 inline) fica de fora, senão apareceria como um quadradinho solto.
    <fieldset
      disabled
      className="contents [&_input:disabled:not([aria-hidden=true])]:opacity-100! [&_textarea:disabled]:opacity-100! [&_[role=combobox]:disabled]:opacity-100!"
      data-read-only="true"
    >
      {children}
    </fieldset>
  )
}
