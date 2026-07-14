import { useRef, useState } from 'react'
import { CheckCircle2, FileUp, XCircle } from 'lucide-react'
import { Modal, Spinner } from './ui'
import { extractTextFromPdf } from '../domain/pdfText'
import {
  buildNoteFromParsed,
  CAMPOS_OBRIGATORIOS_LOTE,
  parseNFSeText,
  type ParsedNota,
} from '../domain/nfseParser'
import { useData } from '../state/DataContext'
import type { NotaDraft } from './NotaForm'

interface FileResult {
  name: string
  ok: boolean
  msg: string
}

/**
 * Envio de PDFs de NFS-e.
 * 1 arquivo  → extrai e abre o formulário preenchido para revisão.
 * 2+ arquivos → extrai e salva direto (merge por número), com relatório por arquivo.
 */
export function PdfImportModal({
  onClose,
  onReviewSingle,
}: {
  onClose: () => void
  onReviewSingle: (draft: NotaDraft) => void
}) {
  const { saveNota, reload } = useData()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [results, setResults] = useState<FileResult[]>([])

  async function handleFiles(files: File[]) {
    if (!files.length) return
    setBusy(true)
    setResults([])
    try {
      if (files.length === 1) {
        setProgress(`Lendo ${files[0].name}…`)
        const text = await extractTextFromPdf(files[0])
        const parsed = parseNFSeText(text)
        if (!parsed.numero && !parsed.valorTotal) {
          setResults([{ name: files[0].name, ok: false, msg: 'Leiaute não reconhecido — lance manualmente.' }])
        } else {
          onReviewSingle(draftFromParsed(parsed))
        }
      } else {
        const out: FileResult[] = []
        let saved = 0
        for (const f of files) {
          setProgress(`Processando ${f.name}…`)
          try {
            const text = await extractTextFromPdf(f)
            const parsed = parseNFSeText(text)
            const missing = CAMPOS_OBRIGATORIOS_LOTE.filter((c) => parsed[c] == null || parsed[c] === '')
            if (missing.length) {
              out.push({
                name: f.name,
                ok: false,
                msg: `Campos não reconhecidos: ${missing.join(', ')} — lance manualmente.`,
              })
            } else {
              await saveNota(buildNoteFromParsed(parsed))
              saved++
              out.push({ name: f.name, ok: true, msg: `Nota nº ${parsed.numero} adicionada/atualizada.` })
            }
          } catch (err) {
            out.push({ name: f.name, ok: false, msg: err instanceof Error ? err.message : String(err) })
          }
          setResults([...out])
        }
        if (saved) await reload()
      }
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <Modal title="Importar NFS-e (PDF)" onClose={onClose}>
      <div
        className="border-2 border-dashed border-ink/15 rounded-xl p-8 text-center hover:border-accent/50 hover:bg-accent/3 transition-colors cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void handleFiles(Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith('.pdf')))
        }}
      >
        <FileUp className="mx-auto text-accent" size={28} />
        <div className="mt-2 text-sm font-semibold">Arraste PDFs aqui ou clique para escolher</div>
        <div className="mt-1 text-xs text-ink-3">
          1 arquivo abre o formulário para revisão · vários arquivos entram direto no painel
        </div>
        <div className="mt-1 text-xs text-ink-3">Leiautes suportados: Vinhedo e Osasco</div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {busy && (
        <div className="mt-4">
          <Spinner label={progress} />
        </div>
      )}

      {results.length > 0 && (
        <ul className="mt-4 space-y-1.5 max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {r.ok ? (
                <CheckCircle2 size={16} className="text-good mt-0.5 shrink-0" />
              ) : (
                <XCircle size={16} className="text-critical mt-0.5 shrink-0" />
              )}
              <span>
                <b>{r.name}</b> — <span className={r.ok ? 'text-ink-2' : 'text-critical'}>{r.msg}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function draftFromParsed(p: ParsedNota): NotaDraft {
  return {
    numero: p.numero,
    emitenteCnpj: p.emitenteCnpj,
    tomadorNome: p.tomadorNome,
    tomadorCnpj: p.tomadorCnpj,
    dataEmissao: p.dataEmissao,
    periodoLabel: p.periodoLabel,
    periodoInfo: p.periodoInfo,
    sortDate: p.sortDate,
    discriminacao: p.discriminacao,
    valorTotal: p.valorTotal,
    baseCalculoISS: p.baseCalculoISS,
    aliquota: p.aliquota,
    valorISS: p.valorISS,
    valorIBS: p.valorIBS,
    valorCBS: p.valorCBS,
    outrasRetTotal: p.outrasRetTotal,
    descServico: p.descServico,
    nbs: p.nbs,
    nbsDesc: p.nbsDesc,
    codVerificacao: p.codVerificacao,
    chaveAcesso: p.chaveAcesso ?? undefined,
  }
}
