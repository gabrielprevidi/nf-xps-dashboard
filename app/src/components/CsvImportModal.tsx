import { useRef, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { Modal, Spinner } from './ui'
import { fileToTextLatin1, parseReceivablesCsv } from '../domain/receivablesCsv'
import { useData } from '../state/DataContext'
import type { Recebivel } from '../domain/types'
import { fmtBRL } from '../lib/format'

/** Importa o CSV "Lançamentos a Receber" do financeiro (merge por Sequência). */
export function CsvImportModal({ onClose }: { onClose: () => void }) {
  const { importRecebiveis } = useData()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<Recebivel[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  async function handleFile(f: File | undefined) {
    if (!f) return
    setError(null)
    setDone(null)
    setBusy(true)
    try {
      const text = await fileToTextLatin1(f)
      const rows = parseReceivablesCsv(text)
      if (!rows.length) {
        setError('Nenhum lançamento reconhecido — confira se é o CSV exportado do financeiro (separador ";").')
        setPreview(null)
      } else {
        setPreview(rows)
        setFileName(f.name)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!preview) return
    setBusy(true)
    setError(null)
    try {
      await importRecebiveis(preview)
      setDone(preview.length)
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const clientes = preview ? [...new Set(preview.map((r) => r.cliente))] : []

  return (
    <Modal title="Importar Contas a Receber (CSV)" onClose={onClose}>
      {done != null ? (
        <div className="text-center py-6">
          <div className="text-lg font-bold text-good-deep">{done} lançamento(s) importado(s)</div>
          <div className="mt-1 text-sm text-ink-2">
            Reimportar o mesmo relatório não duplica: os lançamentos são atualizados pela Sequência.
          </div>
          <button className="btn-primary mt-4" onClick={onClose}>
            Fechar
          </button>
        </div>
      ) : (
        <>
          <div
            className="border-2 border-dashed border-ink/15 rounded-xl p-8 text-center hover:border-accent/50 hover:bg-accent/3 transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              void handleFile(Array.from(e.dataTransfer.files)[0])
            }}
          >
            <FileSpreadsheet className="mx-auto text-accent" size={28} />
            <div className="mt-2 text-sm font-semibold">Arraste o CSV aqui ou clique para escolher</div>
            <div className="mt-1 text-xs text-ink-3">
              Relatório "Lançamentos a Receber" exportado do financeiro (separador ";", codificação Latin-1)
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>

          {busy && (
            <div className="mt-4">
              <Spinner label="Processando…" />
            </div>
          )}
          {error && <div className="mt-4 text-sm text-critical font-semibold">{error}</div>}

          {preview && (
            <div className="mt-4">
              <div className="text-sm">
                <b>{fileName}</b>: {preview.length} lançamento(s) · clientes: {clientes.join(', ')} · total{' '}
                <b className="tabular-nums">{fmtBRL(preview.reduce((s, r) => s + r.valorTitulo, 0))}</b>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setPreview(null)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={() => void confirm()} disabled={busy}>
                  Importar {preview.length} lançamento(s)
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
