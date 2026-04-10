'use client'

interface HtmlEditorProps {
  value: string
  onChange: (html: string) => void
}

export function HtmlEditor({ value, onChange }: HtmlEditorProps) {
  return (
    <div className="flex h-full">
      {/* Code editor — left */}
      <div className="flex-1 flex flex-col border-r border-white/10">
        <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/30 bg-[#1a1a1a] border-b border-white/10 shrink-0">
          HTML
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-[#1a1a1a] text-[#d4d4d4] font-mono text-sm p-4 outline-none resize-none leading-relaxed"
          placeholder="Cole ou escreva o HTML do email aqui..."
          spellCheck={false}
        />
      </div>

      {/* Live preview — right */}
      <div className="flex-1 flex flex-col">
        <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/30 bg-[#252525] border-b border-white/10 shrink-0">
          Visualização
        </div>
        <div className="flex-1 bg-white overflow-auto" style={{ colorScheme: 'light' }}>
          <iframe
            srcDoc={
              value ||
              '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-family:sans-serif;font-size:13px;padding:32px;">Nenhum HTML para visualizar</div>'
            }
            className="w-full h-full border-0"
            sandbox="allow-same-origin"
            title="Visualização do email"
          />
        </div>
      </div>
    </div>
  )
}
