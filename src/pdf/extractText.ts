import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Extract the text of every page of a PDF, one string per page, with text
 * items joined by newlines. The TSBv1 carrier is real (transparent) text, so
 * it comes back verbatim through getTextContent (SPEC.md §2.1).
 *
 * The returned text is only ever fed to the TSBv1 sentinel matcher — the
 * visible sheet contains player PII which must never be surfaced (SPEC.md §3).
 */
export async function extractPdfText(data: ArrayBuffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data }).promise
  try {
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      pages.push(
        content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join('\n'),
      )
      page.cleanup()
    }
    return pages
  } finally {
    await doc.destroy()
  }
}
