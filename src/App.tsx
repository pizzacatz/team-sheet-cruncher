import { useCallback, useMemo, useState } from 'react'
import { extractPdfText } from './pdf/extractText'
import { decodeText } from './decode/tsbv1'
import type { ParseOutcome } from './decode/types'
import { toRows } from './model/rows'
import { aggregate } from './model/aggregate'
import { toCsv, toXlsx, downloadBlob } from './export/spreadsheet'
import { DropZone } from './components/DropZone'
import { FileStatusList } from './components/FileStatusList'
import { TeamsTable } from './components/TeamsTable'
import { Dashboard } from './components/Dashboard'

interface Progress {
  done: number
  total: number
}

type Tab = 'teams' | 'dashboard' | 'files'

export default function App() {
  const [outcomes, setOutcomes] = useState<ParseOutcome[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [tab, setTab] = useState<Tab>('teams')

  const processFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter(
      (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
    )
    if (pdfs.length === 0) return
    setProgress({ done: 0, total: pdfs.length })

    // Sequential keeps memory bounded on large batches; PDF.js parses off the
    // main thread in its worker, so the UI stays responsive either way.
    for (const file of pdfs) {
      let outcome: ParseOutcome
      try {
        const pages = await extractPdfText(await file.arrayBuffer())
        // The staff page is page 1 in a combined "Both" PDF, but scan every
        // page so page order never matters. First page with a payload wins.
        let team = null
        for (const pageText of pages) {
          team = decodeText(pageText, file.name)
          if (team) break
        }
        outcome = team
          ? { status: 'ok', team }
          : {
              status: 'skipped',
              sourceFile: file.name,
              reason: 'no TSBv1 payload — not a Team Sheet Builder staff sheet (or an Open sheet)',
            }
      } catch (err) {
        outcome = {
          status: 'error',
          sourceFile: file.name,
          reason: err instanceof Error ? err.message : String(err),
        }
      }
      setOutcomes((prev) => [...prev, outcome])
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
    }
    setProgress(null)
  }, [])

  const teams = useMemo(
    () => outcomes.flatMap((o) => (o.status === 'ok' ? [o.team] : [])),
    [outcomes],
  )
  const rows = useMemo(() => teams.flatMap(toRows), [teams])
  const aggregates = useMemo(() => aggregate(teams), [teams])
  const failures = outcomes.length - teams.length

  return (
    <div className="app">
      <header className="app-header">
        <h1>Team Sheet Data Cruncher</h1>
        <p className="tagline">
          Drop Team Sheet Builder staff-sheet PDFs to extract the embedded,
          PII-free team data — everything stays in your browser.
        </p>
      </header>

      <DropZone onFiles={processFiles} busy={progress !== null} />

      {progress && (
        <div className="progress" role="status">
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <span>
            Parsing {progress.done} / {progress.total} PDFs…
          </span>
        </div>
      )}

      {outcomes.length > 0 && (
        <>
          <div className="toolbar">
            <nav className="tabs" aria-label="Views">
              <button className={tab === 'teams' ? 'tab active' : 'tab'} onClick={() => setTab('teams')}>
                Teams ({teams.length})
              </button>
              <button className={tab === 'dashboard' ? 'tab active' : 'tab'} onClick={() => setTab('dashboard')}>
                Dashboard
              </button>
              <button className={tab === 'files' ? 'tab active' : 'tab'} onClick={() => setTab('files')}>
                Files ({outcomes.length}{failures > 0 ? `, ${failures} skipped` : ''})
              </button>
            </nav>
            <div className="exports">
              <button
                disabled={rows.length === 0}
                onClick={() => downloadBlob(toCsv(rows), 'team-sheets.csv', 'text/csv')}
              >
                Download CSV
              </button>
              <button
                disabled={rows.length === 0}
                onClick={() =>
                  downloadBlob(toXlsx(rows), 'team-sheets.xlsx',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                }
              >
                Download XLSX
              </button>
            </div>
          </div>

          {tab === 'teams' && <TeamsTable rows={rows} />}
          {tab === 'dashboard' && <Dashboard aggregates={aggregates} failures={failures} sheets={outcomes.length} />}
          {tab === 'files' && <FileStatusList outcomes={outcomes} />}
        </>
      )}
    </div>
  )
}
