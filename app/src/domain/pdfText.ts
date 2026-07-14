/**
 * Extração de texto de PDF no navegador via pdf.js 3.11.174 — mesma versão e
 * mesma forma de junção ("\n") usadas na calibração dos parsers. Não alterar
 * sem rodar a regressão contra os PDFs reais (tests/).
 */
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractTextFromPdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map((it) => ('str' in it ? it.str : '')).join('\n') + '\n'
  }
  return fullText
}
