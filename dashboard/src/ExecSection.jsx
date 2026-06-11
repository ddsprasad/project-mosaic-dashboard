// Executive tab section (Preservation / Files Harvesting /
// Data Extraction & Notification Readiness), merged in from the former :3001
// report. Replaces the old File Preservation/Profiling/Harvesting/Data
// Complexion tiles on the dashboard. Chart primitives come from shared/; the
// "detailed waterfall" and "Data Complexion" pills open the dashboard's own
// same-origin ?view=exfil / ?view=complexion routes.
import { useState, Fragment } from 'react'
import { FileText, Database, Bell, ExternalLink, ArrowRight, Users } from 'lucide-react'
import { Funnel } from '@shared/waterfalls.jsx'
import { useKpi } from '@shared/hooks.js'
import { formatCompact } from '@shared/format.js'
import './exec-section.css'

const TABS = [
  { key: 'preservation', label: 'Preservation', icon: FileText },
  { key: 'harvesting',   label: 'Files Harvesting', icon: Database },
  { key: 'notification', label: 'Data Extraction & Notification Readiness', icon: Bell },
]

function Panel({ title, sub, note = '', children }) {
  return (
    <div className="er-panel">
      <div className="er-panel-title">{title}</div>
      {sub && <div className="er-panel-sub">{sub}</div>}
      {children}
      {note && <div className="er-placeholder-note">{note}</div>}
    </div>
  )
}

function openExfilWindow() {
  window.open(`${window.location.origin}/?view=exfil`, 'mosaic-exfil', 'noopener,noreferrer,width=1240,height=840')
}
function openComplexionWindow() {
  window.open(`${window.location.origin}/?view=complexion`, 'mosaic-complexion', 'noopener,noreferrer,width=1240,height=840')
}

function Preservation() {
  const total = 226400000
  const preserved = 213380000
  const tiDeleted = 1200000
  const complete = preserved + tiDeleted
  const pending = Math.max(0, total - complete)
  const pctComplete = total > 0 ? (complete / total) * 100 : 0
  const preservedTip = 'Preserved Files\nBQ: 39%\nGCS: 100%\nGitHub: 15%\nOthers: 0.4%'
  const pendingTip = 'Pending for Preservation\nBQ: 61%\nGCS: 0%\nGitHub: 85%\nOthers: 99.6%'
  const data = {
    floor: { label: 'Total Exfiltrated Files', value: total },
    stages: [
      { label: 'Preserved Files', value: preserved, tip: preservedTip },
      { label: 'TI Deleted Files', value: tiDeleted },
      { label: 'Pending for Preservation', value: pending, tip: pendingTip },
    ],
  }
  return (
    <>
      <Funnel floor={data.floor} stages={data.stages} />
      <div className="er-ribbon">
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num">{formatCompact(total)}</div>
          <div className="er-ribbon-label">Total Exfil Files</div>
        </div>
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num" style={{ color: '#a78bfa' }}>{formatCompact(complete)}</div>
          <div className="er-ribbon-label">Preservation Files</div>
        </div>
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num" style={{ color: '#22c55e' }}>{`${pctComplete.toFixed(0)}%`}</div>
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
  const totalExfil = 226400000
  const steps = [
    { label: 'TI Deleted', value: 1200000 },
    { label: 'Duplicates', value: 11400000 },
    { label: 'Exclusions', value: 1480000 },
    { label: 'Potential Excl.', value: 11140000 },
  ]
  const filesForHarvesting = totalExfil - steps.reduce((s, x) => s + x.value, 0)
  const harvested = 3840000
  const pendingHarv = Math.max(0, filesForHarvesting - harvested)
  const pctHarvested = filesForHarvesting > 0 ? (harvested / filesForHarvesting) * 100 : 0
  const bars = [
    { label: 'Total Exfiltrated Files', value: totalExfil, color: '#3b1a63' },
    ...steps.map((s) => ({ label: s.label, value: s.value, color: '#ef4444' })),
    { label: 'Files for Harvesting', value: filesForHarvesting, color: '#ec4899' },
    { label: 'Files Harvested', value: harvested, color: '#22c55e' },
  ]
  const max = Math.max(...bars.map((b) => b.value))
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
        {bars.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 180, textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#cbd5e1', flexShrink: 0 }}>{b.label}</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: `${Math.max(1.5, (b.value / max) * 100)}%`, minWidth: 6, height: 22, background: b.color, borderRadius: 4 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e5e7eb' }}>{formatCompact(b.value)}</span>
            </div>
          </div>
        ))}
      </div>
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
  const rawRecords = useKpi('raw-records')
  const rawDisp = rawRecords.loading ? '…' : (rawRecords.error ? 'err' : formatCompact(rawRecords.value))
  const harvested = 3840000
  return (
    <>
      <div className="er-ribbon">
        <div className="er-ribbon-cell">
          <div className="er-ribbon-num" style={{ color: '#22c55e' }}>{formatCompact(harvested)}</div>
          <div className="er-ribbon-label">Total Harvested Files</div>
        </div>
      </div>
      <MedallionArchitecture
        bronzeMetric={{ value: rawDisp, label: 'Raw Records' }}
        silverMetric={{ value: 'TBD', label: 'Raw Records' }}
        goldMetric={{ value: 'TBD', label: 'Raw Records' }}
      />
      <div className="er-cta-wrap">
        <button type="button" className="er-cta-pill" onClick={openComplexionWindow}>
          <ExternalLink size={14} /> Click here for Data Complexion
        </button>
      </div>
    </>
  )
}

export function ExecSection() {
  const [tab, setTab] = useState('preservation')
  return (
    <div className="er-embed">
      <div className="er-tabs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`er-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{label}
          </button>
        ))}
        <button
          className="er-tab er-tab-nav"
          onClick={() => window.open('?view=customer-all', '_blank', 'noopener,noreferrer')}
          title="Open all customer pages in a new tab"
        >
          <Users size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />All customer pages ↗
        </button>
      </div>
      {tab === 'preservation' && (
        <Panel title="Preservation" sub="Total exfiltrated files broken down by preservation status." note="Live from BigQuery.">
          <Preservation />
        </Panel>
      )}
      {tab === 'harvesting' && (
        <Panel title="Files Harvesting" sub="Total files through the filtering pipeline to harvested files.">
          <Harvesting />
        </Panel>
      )}
      {tab === 'notification' && (
        <Panel title="Data Extraction &amp; Notification Readiness">
          <Notification />
        </Panel>
      )}
    </div>
  )
}
