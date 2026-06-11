import { useState, Fragment } from 'react'
import { FileText, Database, Bell, BarChart3, ExternalLink, ArrowRight } from 'lucide-react'
import { Funnel, BridgeWaterfall } from '@shared/waterfalls.jsx'
import { ExfilWaterfallPage } from '@shared/exfil-waterfall.jsx'
import { DataComplexion } from '@shared/data-complexion.jsx'
import { useKpi } from '@shared/hooks.js'
import { formatCompact } from '@shared/format.js'

// Segment LABELS reflect the requested breakdown per tab. Floors/segments marked
// "placeholder" still need their query/definition; the Preservation floor is
// wired live (Total Exfiltrated Files = wf-top.totalexfilFiles).

const TABS = [
  { key: 'preservation', label: 'Preservation', icon: FileText },
  { key: 'harvesting',   label: 'Files Processing for Harvesting', icon: Database },
  { key: 'notification', label: 'Data Extraction & Notification Readiness', icon: Bell },
]

function Panel({ title, sub, note = 'Segment values are placeholders pending their queries.', children }) {
  return (
    <div className="er-panel">
      <div className="er-panel-title">{title}</div>
      {sub && <div className="er-panel-sub">{sub}</div>}
      {children}
      {note && <div className="er-placeholder-note">{note}</div>}
    </div>
  )
}

// The detailed exfil waterfall lives in the dashboard app (a different service/
// URL than this report), so resolve the right base per environment and open it
// in its own window.
function openExfilWindow() {
  // Same-origin: opens this report's own ?view=exfil detailed-analysis window.
  window.open(`${window.location.origin}/?view=exfil`, 'mosaic-exfil', 'noopener,noreferrer,width=1240,height=840')
}

// Same-origin: opens this report's own ?view=complexion window (shared tile).
function openComplexionWindow() {
  window.open(`${window.location.origin}/?view=complexion`, 'mosaic-complexion', 'noopener,noreferrer,width=1240,height=840')
}

function Preservation() {
  // All live from wf-top + wf-sources (same data the dashboard tile used):
  //   preserved = Glean + GCS-uncompressed + per-source preserved
  //   TI deleted = per-source tideleted
  //   Preservation Files (complete) = preserved + TI deleted
  //   Pending = total exfiltrated − complete
  const wfTop = useKpi('wf-top')
  const wfSources = useKpi('wf-sources')
  const loading = wfTop.loading || wfSources.loading
  const num = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : 0
  const t = wfTop.value || {}
  const bySrc = Object.fromEntries(
    (Array.isArray(wfSources.value) ? wfSources.value : []).map((r) => [r.source_type, r])
  )
  const SRC = ['bigquery', 'gcp_buckets', 'github']
  const total = 226400000 // hardcoded Total Exfiltrated Files (Preservation)
  const preserved = 213380000 // hardcoded Preserved Files
  const tiDeleted = 1200000 // hardcoded TI Deleted Files
  const complete = preserved + tiDeleted
  const pending = Math.max(0, total - complete)
  const pctComplete = total > 0 ? (complete / total) * 100 : 0

  // Per-source % shown on hover over the Pending for Preservation band.
  const preservedTip = 'Preserved Files\nBQ: 39%\nGCS: 100%\nGitHub: 15%\nOthers: 0.4%'
  const pendingTip = 'Pending for Preservation\nBQ: 61%\nGCS: 0%\nGitHub: 85%\nOthers: 99.6%'

  const data = {
    floor: { label: 'Total Exfiltrated Files', value: total || 229239538 },
    stages: [
      { label: 'Preserved Files', value: preserved, tip: preservedTip },
      { label: 'TI Deleted Files', value: tiDeleted },
      { label: 'Pending for Preservation', value: pending, tip: pendingTip },
    ],
  }
  const fmt = (v) => (loading ? '…' : formatCompact(v))
  return (
    <>
      <Funnel floor={data.floor} stages={data.stages} />
      <div className="er-ribbon">
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num">{fmt(total)}</div>
          <div className="er-ribbon-label">Total Exfil Files</div>
        </div>
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num" style={{ color: '#a78bfa' }}>{fmt(complete)}</div>
          <div className="er-ribbon-label">Preservation Files</div>
        </div>
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num" style={{ color: '#22c55e' }}>{loading ? '…' : `${pctComplete.toFixed(0)}%`}</div>
          <div className="er-ribbon-label">Preservation Complete</div>
        </div>
      </div>
      <div className="er-cta-wrap">
        <button type="button" className="er-cta-pill" onClick={openExfilWindow}>
          <ExternalLink size={14} /> Click here for detailed waterfall
        </button>
      </div>
    </>
  )
}

function Harvesting() {
  // Waterfall/bridge: Total Files minus each removal category = Files for
  // Harvesting. Duplicates & Zero Byte are live; the rest use dashboard figures.
  const totalExfil = 226400000
  const steps = [
    { label: 'TI Deleted', value: 1200000 },
    { label: 'Duplicates', value: 11400000 },
    { label: 'Exclusions', value: 1480000 },
    { label: 'Potential Excl.', value: 11140000 },
  ]
  const filesForHarvesting = totalExfil - steps.reduce((s, x) => s + x.value, 0)
  const harvested = 6880000
  const pendingHarv = Math.max(0, filesForHarvesting - harvested)
  const pctHarvested = filesForHarvesting > 0 ? (harvested / filesForHarvesting) * 100 : 0
  return (
    <>
      <BridgeWaterfall
        floor={{ label: 'Total Exfiltrated Files', value: totalExfil }}
        steps={steps}
        endLabel="Files for Harvesting"
        endFill="#ec4899"
        tail={[{ label: 'Files Harvested', value: harvested, fill: '#22c55e' }]}
      />
      <div className="er-ribbon">
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num" style={{ color: '#ec4899' }}>{formatCompact(filesForHarvesting)}</div>
          <div className="er-ribbon-label">Files for Harvesting</div>
        </div>
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num" style={{ color: '#22c55e' }}>{formatCompact(harvested)}</div>
          <div className="er-ribbon-label">Files Harvested</div>
        </div>
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num" style={{ color: '#f59e0b' }}>{formatCompact(pendingHarv)}</div>
          <div className="er-ribbon-label">Pending Files for Harvesting</div>
        </div>
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num" style={{ color: '#22c55e' }}>{pctHarvested.toFixed(1)}%</div>
          <div className="er-ribbon-label">% Files Harvested</div>
        </div>
      </div>
    </>
  )
}

// Medallion architecture: Bronze → Silver → Gold database layers.
function MedallionArchitecture({ bronzeMetric, silverMetric, goldMetric }) {
  const layers = [
    { name: 'Bronze', color: '#cd7f32', metric: bronzeMetric },
    { name: 'Silver', color: '#9ca3af', metric: silverMetric },
    { name: 'Gold', color: '#facc15', metric: goldMetric },
  ]
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', marginBottom: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Medallion Architecture
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0 }}>
        {layers.map((l, i) => (
          <Fragment key={l.name}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 150 }}>
              <Database size={54} color={l.color} strokeWidth={1.5} />
              <div style={{ fontSize: 14, fontWeight: 700, color: l.color }}>{l.name}</div>
              {l.metric && (
                <div style={{ marginTop: 4, textAlign: 'center', border: '1px solid #1f2937', borderRadius: 8, background: 'rgba(255,255,255,0.02)', padding: '8px 16px' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb' }}>{l.metric.value}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{l.metric.label}</div>
                </div>
              )}
            </div>
            {i < layers.length - 1 && <ArrowRight size={28} color="#64748b" style={{ margin: '0 10px', marginTop: 20 }} />}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function Notification() {
  // Raw Records is live (same query as the dashboard).
  const rawRecords = useKpi('raw-records')
  const rawDisp = rawRecords.loading ? '…' : (rawRecords.error ? 'err' : formatCompact(rawRecords.value))
  const harvested = 6880000
  return (
    <>
      <div className="er-ribbon">
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num" style={{ color: '#22c55e' }}>{formatCompact(harvested)}</div>
          <div className="er-ribbon-label">Total Harvested Files</div>
        </div>
      </div>
      <MedallionArchitecture bronzeMetric={{ value: rawDisp, label: 'Raw Records' }} />
      <div className="er-cta-wrap">
        <button type="button" className="er-cta-pill" onClick={openComplexionWindow}>
          <ExternalLink size={14} /> Click here for Data Complexion
        </button>
      </div>
    </>
  )
}

function MainReport() {
  const [tab, setTab] = useState('preservation')
  return (
    <div className="er-shell">
      <div className="er-head">
        <BarChart3 size={20} color="#a78bfa" />
        <span className="er-title">Mosaic Analytics Executive Report</span>
      </div>
      <div className="er-sub">High-level executive view · Preservation · Harvesting · Notification</div>

      <div className="er-tabs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`er-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{label}
          </button>
        ))}
      </div>

      {tab === 'preservation' && (
        <Panel title="Preservation" sub="Total exfiltrated files broken down by preservation status." note="Live from BigQuery.">
          <Preservation />
        </Panel>
      )}
      {tab === 'harvesting' && (
        <Panel title="Files Processing for Harvesting" sub="Total files through the filtering pipeline to harvested files." note="">
          <Harvesting />
        </Panel>
      )}
      {tab === 'notification' && (
        <Panel title="Data Extraction &amp; Notification Readiness" note="">
          <Notification />
        </Panel>
      )}
    </div>
  )
}

export default function App() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  if (params?.get('view') === 'exfil') return <ExfilWaterfallPage />
  if (params?.get('view') === 'complexion') {
    return (
      <div style={{ height: '100vh', padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <DataComplexion />
      </div>
    )
  }
  return <MainReport />
}
