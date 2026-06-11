import { useEffect, useRef, useState, createContext, useContext, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { Sun, Moon, RefreshCw, Download, FileText, Database, Users, GitBranch, X, Filter, PieChart as PieChartIcon } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LabelList,
} from 'recharts'
import './App.css'
import { ExecSection } from './ExecSection.jsx'

function formatCompact(n) {
  if (n == null) return '—'
  const trunc2 = (v) => (Math.floor(v * 100 + 1e-9) / 100).toFixed(2)
  if (n >= 1e9) return trunc2(n / 1e9) + 'B'
  if (n >= 1e6) return trunc2(n / 1e6) + 'M'
  if (n >= 1e3) return trunc2(n / 1e3) + 'K'
  return String(n)
}

function useKpi(id, refreshKey = 0) {
  const [state, setState] = useState({ value: null, loading: true, error: null })
  useEffect(() => {
    let cancelled = false
    setState(s => ({ ...s, loading: true }))
    const url = refreshKey > 0 ? `/api/kpi/${id}?refresh=1&_=${refreshKey}` : `/api/kpi/${id}`
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { if (!cancelled) setState({ value: d.value, loading: false, error: null }) })
      .catch(e => { if (!cancelled) setState({ value: null, loading: false, error: e.message }) })
    return () => { cancelled = true }
  }, [id, refreshKey])
  return state
}

function useTriage(refreshKey = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  useEffect(() => {
    let cancelled = false
    setState(s => ({ ...s, loading: true }))
    const url = refreshKey > 0 ? `/api/triage?refresh=1&_=${refreshKey}` : `/api/triage`
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { if (!cancelled) setState({ data: d, loading: false, error: null }) })
      .catch(e => { if (!cancelled) setState({ data: null, loading: false, error: e.message }) })
    return () => { cancelled = true }
  }, [refreshKey])
  return state
}

const C = {
  purple: '#8b5cf6',
  purpleLight: '#a78bfa',
  pink: '#fb7185',
  coral: '#f87171',
  orange: '#f59e0b',
  green: '#22c55e',
  greenLight: '#4ade80',
  teal: '#14b8a6',
  blue: '#3b82f6',
  gray: '#4b5563',
  text: '#e5e7eb',
  muted: '#6b7280',
}

function formatRefreshedAt(date) {
  if (!date) return ''
  const d = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  const t = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${d}, ${t}`
}

function Header({ onRefresh, refreshing, theme, onToggleTheme, onDownload, downloading, lastRefreshed }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2">
            <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z" />
          </svg>
        </div>
        <div>
          <div className="title-row">
            <span className="logo-title">Project Mosaic</span>
            <span className="live-badge">Live</span>
            {lastRefreshed && (
              <span className="muted-small" style={{ marginLeft: 4 }}>
                Updated {formatRefreshedAt(lastRefreshed)}
              </span>
            )}
          </div>
          <div className="logo-subtitle">Executive Status Reporting</div>
        </div>
      </div>
      <div className="header-right">
        <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button className="ghost-btn refresh" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? 'spinning' : ''} /> Refresh
        </button>
        <button className="icon-btn" onClick={onDownload} disabled={downloading} aria-label="Download report">
          <Download size={16} className={downloading ? 'spinning' : ''} />
        </button>
      </div>
    </header>
  )
}

function FilePreservation({ refreshKey }) {
  const profiling = useKpi('file-profiling', refreshKey)
  const totalExfil = { value: 226400000, loading: false, error: null }
  const preservationFiles = { value: 209980000, loading: false, error: null }
  const preservationPct = (totalExfil.value && preservationFiles.value != null)
    ? Math.min(100, (preservationFiles.value / totalExfil.value) * 100)
    : null
  const pctDisplay = totalExfil.loading || preservationFiles.loading
    ? '…'
    : (totalExfil.error || preservationFiles.error || preservationPct == null)
      ? 'err'
      : `${preservationPct.toFixed(0)}%`
  return (
    <div className="card preservation tile-files">
      <div className="preservation-left">
        <div className="card-title"><FileText size={14} /> File Preservation</div>
        <div className="muted-small">Overall preservation status across all data sources</div>
      </div>
      <div className="preservation-stats">
        <div className="ps-stat">
          <div className="ps-num green">{pctDisplay}</div>
          <div className="ps-label">Preservation Complete</div>
        </div>
        <div
          className="ps-stat"
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          title="Open the data-harvesting waterfall"
          onClick={() => window.open('?view=exfil', '_blank', 'noopener,noreferrer')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') window.open('?view=exfil', '_blank', 'noopener,noreferrer') }}
        >
          <div className="ps-num"><KpiValue kpi={totalExfil} /></div>
          <div className="ps-label">Total Exfil Files ↗</div>
        </div>
        <div className="ps-stat">
          <div className="ps-num purple"><KpiValue kpi={preservationFiles} /></div>
          <div className="ps-label">Preservation Files</div>
        </div>
      </div>
    </div>
  )
}

function kpiDisplay(kpi) {
  if (kpi.loading) return '…'
  if (kpi.error) return 'err'
  return formatCompact(kpi.value)
}

const RefreshContext = createContext(0)
const SvgContext = createContext(false)

function useCountUp(target, duration = 900, resetKey = 0) {
  const [current, setCurrent] = useState(0)
  const fromRef = useRef(0)
  const lastResetRef = useRef(resetKey)
  useEffect(() => {
    if (target == null || !Number.isFinite(target)) return
    if (resetKey !== lastResetRef.current) {
      fromRef.current = 0
      lastResetRef.current = resetKey
    } else if (target === fromRef.current) {
      return
    }
    let raf
    let start = null
    const from = fromRef.current
    const tick = (t) => {
      if (start == null) start = t
      const progress = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = from + (target - from) * eased
      setCurrent(value)
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, resetKey])
  return current
}

function KpiValue({ kpi, format = formatCompact, duration = 900 }) {
  const refreshKey = useContext(RefreshContext)
  const inSvg = useContext(SvgContext)
  const animated = useCountUp(kpi.value, duration, refreshKey)
  if (kpi.error) return 'err'
  if (kpi.value == null) return '…'
  const formatted = format(animated)
  if (inSvg) return formatted
  return <span title={kpi.value.toLocaleString()} style={{ cursor: 'help' }}>{formatted}</span>
}

function CountUp({ value, format = formatCompact, duration = 900 }) {
  const refreshKey = useContext(RefreshContext)
  const inSvg = useContext(SvgContext)
  const animated = useCountUp(value, duration, refreshKey)
  if (value == null) return '…'
  const formatted = format(animated)
  if (inSvg) return formatted
  return <span title={value.toLocaleString()} style={{ cursor: 'help' }}>{formatted}</span>
}

function BurndownNode({ x, y, w, h, fill, stroke, textColor, label, value, sub, title, onClick, clickable, visible = true }) {
  const cx = x + w / 2
  const labelLines = Array.isArray(label) ? label : [label]
  const labelStartY = y + 14
  const valueY = y + 14 + labelLines.length * 12 + 6
  return (
    <g
      onClick={visible ? onClick : undefined}
      style={{
        cursor: visible && clickable ? 'pointer' : 'default',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.45s ease',
      }}
    >
      {title && <title>{clickable ? `${title} — click to expand` : title}</title>}
      <rect
        x={x} y={y} width={w} height={h} rx={6} ry={6}
        fill={fill}
        stroke={clickable ? '#fbbf24' : (stroke ?? 'none')}
        strokeWidth={clickable ? 1.5 : (stroke ? 1 : 0)}
      />
      <text x={cx} y={labelStartY} fontSize={11} fill={textColor} textAnchor="middle" fontWeight={600} letterSpacing="0.1" opacity={0.95}>
        {labelLines.map((ln, i) => (
          <tspan key={i} x={cx} dy={i === 0 ? 0 : 12}>{ln}</tspan>
        ))}
      </text>
      <text x={cx} y={valueY} fontSize={16} fill={textColor} textAnchor="middle" fontWeight={700} letterSpacing="-0.3">{value}</text>
      {sub && <text x={cx} y={y + h - 5} fontSize={10} fill={textColor} textAnchor="middle" fontWeight={500} opacity={0.85}>{sub}</text>}
      {clickable && (
        <text x={x + w - 7} y={y + 13} fontSize={12} fill="#fbbf24" textAnchor="end" fontWeight={700}>+</text>
      )}
    </g>
  )
}

function BurndownTree({
  totalSift, siftBqGcs, siftOther, filesForHarv, duplicates, exclusions, pending, bqFiles, gcsFiles,
}) {
  const [level, setLevel] = useState(4)
  const expand = (target) => setLevel((l) => Math.max(l, target))
  const show = (n) => level >= n

  const pendingPres = (siftBqGcs.value != null && filesForHarv.value != null)
    ? siftBqGcs.value - filesForHarv.value : null
  const v = (k) => k.loading ? '…' : k.error ? 'err' : (k.value != null ? k.value.toLocaleString() : '—')
  const stroke = '#7c3aed'
  const lineProps = { stroke, strokeWidth: 1.2, fill: 'none' }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '2px 8px 4px', fontSize: 10, color: '#9ca3af',
      }}>
        <span>{level < 4 ? 'Click highlighted box to expand →' : 'Fully expanded'}</span>
        {level > 0 && (
          <button
            onClick={() => setLevel(0)}
            style={{
              background: 'transparent', border: '1px solid #374151',
              color: '#9ca3af', borderRadius: 4, padding: '2px 8px',
              fontSize: 10, cursor: 'pointer',
            }}
          >Reset</button>
        )}
      </div>
      <SvgContext.Provider value={true}>
      <svg
        viewBox="0 0 600 410"
        width="100%"
        height="100%"
        style={{
          display: 'block',
          flex: 1,
          minHeight: 0,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* connectors (always rendered, opacity-toggled) */}
        {[
          { d: 'M300,46 L300,59 L150,59 L150,72',  lvl: 1 },
          { d: 'M300,46 L300,59 L450,59 L450,72',  lvl: 1 },
          { d: 'M150,110 L150,134',                lvl: 2 },
          { d: 'M150,110 L150,122 L450,122 L450,134', lvl: 2 },
          { d: 'M282,158 L300,158 L300,210 L318,210', lvl: 3 },
          { d: 'M282,158 L300,158 L300,272',           lvl: 3 },
          { d: 'M300,324 L300,332 L102,332 L102,338', lvl: 4 },
          { d: 'M300,324 L300,338',                    lvl: 4 },
          { d: 'M300,324 L300,332 L498,332 L498,338', lvl: 4 },
        ].map((p, i) => (
          <path
            key={i}
            d={p.d}
            {...lineProps}
            style={{ opacity: show(p.lvl) ? 1 : 0, transition: 'opacity 0.45s ease' }}
          />
        ))}

        {/* level 0: Total */}
        <BurndownNode x={168} y={8} w={264} h={38} fill="#5b21b6" textColor="#fff"
          label="Total SIFT Objects" value={<KpiValue kpi={totalSift} />}
          title={`Total SIFT Objects (excluding Glean): ${v(totalSift)}`}
          clickable={level < 1} onClick={() => expand(1)} />

        {/* level 1: BQ/GCS, Other */}
        <BurndownNode visible={show(1)} x={18} y={72} w={264} h={38} fill="#7c3aed" textColor="#fff"
          label="SIFT Objects (BQ / GCS)" value={<KpiValue kpi={siftBqGcs} />} title={`SIFT Objects (BQ / GCS): ${v(siftBqGcs)}`}
          clickable={level < 2} onClick={() => expand(2)} />
        <BurndownNode visible={show(1)} x={318} y={72} w={264} h={38} fill="#6b7280" textColor="#fff"
          label="SIFT Objects (Other Sources)" value={<KpiValue kpi={siftOther} />} title={`SIFT Objects (Other Sources): ${v(siftOther)}`} />

        {/* level 2: Files for Harvesting, Pending Preservation */}
        <BurndownNode visible={show(2)} x={18} y={134} w={264} h={48} fill="#7c3aed" textColor="#fff"
          label={['Files for Harvesting /', 'Copied to Preservation']} value={<KpiValue kpi={filesForHarv} />}
          title={`Files for Harvesting: ${v(filesForHarv)}`}
          clickable={level < 3} onClick={() => expand(3)} />
        <BurndownNode visible={show(2)} x={318} y={134} w={264} h={38} fill="#d946ef" textColor="#fff"
          label="Pending Preservation" value={<CountUp value={pendingPres} />}
          title={`Pending Preservation (SIFT BQ/GCS − Files for Harvesting): ${pendingPres != null ? formatCompact(pendingPres) : '…'}`} />

        {/* level 3: Duplicates, Net box */}
        <BurndownNode visible={show(3)} x={318} y={184} w={264} h={52} fill="#f3f4f6" stroke="#9ca3af" textColor="#111827"
          label="Duplicates" value={<KpiValue kpi={duplicates} />} title={`Duplicates: ${v(duplicates)}`} />
        <BurndownNode visible={show(3)} x={168} y={272} w={264} h={52} fill="#7c3aed" textColor="#fff"
          label={['Files for Harvesting', '(excluding duplicates)']}
          value={<KpiValue kpi={pending} />} title={`Files for Harvesting − Duplicates: ${v(pending)}`}
          clickable={level < 4} onClick={() => expand(4)} />

        {/* level 4: Objects with Data Harvested, Exclusions, Pending Extraction */}
        <BurndownNode visible={show(4)} x={3} y={338} w={198} h={56} fill="#7c3aed" textColor="#fff"
          label="Objects with Data Harvested" value={<KpiValue kpi={bqFiles} />}
          sub={bqFiles.value != null ? `(${bqFiles.value.toLocaleString()} BQ Tables)` : null}
          title={`Objects with Data Harvested: ${v(bqFiles)}`} />
        <BurndownNode visible={show(4)} x={201} y={338} w={198} h={56} fill="#f3f4f6" stroke="#9ca3af" textColor="#111827"
          label="Potential Exclusions" value={<KpiValue kpi={exclusions} />}
          title={`Potential Exclusions (BQ empty + GCS no-extension dedup): ${v(exclusions)}`} />
        <BurndownNode visible={show(4)} x={399} y={338} w={198} h={56} fill="#7c3aed" textColor="#fff"
          label="Pending Extraction" value={<KpiValue kpi={gcsFiles} />}
          sub={gcsFiles.value != null ? `(${formatCompact(gcsFiles.value)} GCS Files)` : null}
          title={`Pending Extraction: ${v(gcsFiles)}`} />
      </svg>
      </SvgContext.Provider>
    </div>
  )
}

function BurndownBars({ rows, max }) {
  const denom = max || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0, justifyContent: 'center' }}>
      {rows.map((r, i) => {
        const val = r.kpi?.value
        const ready = val != null && Number.isFinite(val)
        const pct = ready ? Math.max(1, Math.min(100, (val / denom) * 100)) : 0
        const tip = ready ? `${r.label}: ${val.toLocaleString()}` : r.label
        return (
          <div key={i} title={tip} style={{ cursor: 'help' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, marginBottom: 3 }}>
              <span style={{ color: '#d1d5db' }}>{r.label}</span>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}><KpiValue kpi={r.kpi} /></span>
            </div>
            <div
              title={tip}
              style={{ height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}
            >
              <div style={{ height: '100%', width: `${pct}%`, background: r.color, borderRadius: 99, transition: 'width .6s ease' }} />
            </div>
            {r.note && (
              <div style={{ color: '#22c55e', fontSize: 10, marginTop: 2 }}>{r.note}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const STEP_SHORT = {
  0: 'On Hold',
  1: 'SIFT',
  2: 'Retrieval',
  3: 'In-Scope',
  4: 'Extraction',
  5: 'Interaction',
}
// Distinct hue per step so the Analytics Current step pill reads at a glance.
const STEP_COLORS = {
  0: '#94a3b8',  // slate — on hold
  1: '#a855f7',  // violet — SIFT
  2: '#06b6d4',  // cyan — retrieval
  3: '#ec4899',  // pink — in-scope
  4: '#f59e0b',  // amber — extraction
  5: '#10b981',  // emerald — interaction
}
const SENTIMENT_DISPLAY = {
  Green:  { label: 'Positive', dot: '#22c55e' },
  Yellow: { label: 'Neutral',  dot: '#eab308' },
  Red:    { label: 'At Risk',  dot: '#ef4444' },
}
const OUTREACH_DISPLAY = [
  { test: /^meeting\s*0$/i, label: 'M0 - Internal', bg: '#86efac', fg: '#0b0d12' },
  { test: /\bhold\b/i,        label: 'On Hold',      bg: '#a855f7', fg: '#fff' },
  { test: /^meeting\s*1$/i, label: 'M1 - Initial', bg: '#15803d', fg: '#fff' },
  { test: /recurring/i,       label: 'Recurring',    bg: '#3b82f6', fg: '#0b0d12' },
  { test: /^meeting\s*2$/i, label: 'M2 - Confirm', bg: '#fb7185', fg: '#0b0d12' },
  { test: /^meeting\s*3$/i, label: 'M3 - Extract', bg: '#dc2626', fg: '#fff' },
]
function outreachChip(raw) {
  if (!raw) return null
  for (const o of OUTREACH_DISPLAY) if (o.test.test(raw)) return o
  return null
}
function formatRequestDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
function daysActiveColor(n) {
  if (n == null) return '#9ca3af'
  if (n < 14) return '#22c55e'   // under 2 weeks — on track
  if (n <= 30) return '#eab308'  // 2 weeks to a month — watch
  return '#ef4444'               // over a month — at risk
}

// Filename-safe local timestamp: YYYY-MM-DD_HHMMSS. Uses local time so the
// stamp matches the clock the user is looking at, not UTC.
function fileStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function downloadCustomersPdf(rows) {
  const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const stamp = fileStamp()

  // Title block
  pdf.setFillColor(15, 17, 21)
  pdf.rect(0, 0, pageW, 60, 'F')
  pdf.setTextColor(248, 250, 252)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text('Detailed customer view', 28, 28)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(148, 163, 184)
  pdf.text(`${rows.length} customers · Generated ${new Date().toLocaleString()}`, 28, 46)

  const body = rows.map(r => [
    `${r.customer}\nPriority - ${r.priorityOrder ?? '?'}`,
    formatRequestDate(r.requestDate),
    r.daysActive != null ? `${r.daysActive} days` : '—',
    SENTIMENT_DISPLAY[r.sentiment]?.label ?? '—',
    r.currentStep != null ? `Step ${r.currentStep} · ${STEP_SHORT[r.currentStep] ?? ''}` : '—',
    [
      r.siftFiles != null ? `${r.siftFiles.toLocaleString()} sift` : '— sift',
      r.copiedFiles != null ? `${r.copiedFiles.toLocaleString()} copied` : '— copied',
      r.attributedFiles != null ? `${r.attributedFiles.toLocaleString()} attr` : '— attr',
      r.releFiles != null ? `${r.releFiles.toLocaleString()} RELE` : '— RELE',
      r.extractedFiles != null ? `${r.extractedFiles.toLocaleString()} extracted` : '— extracted',
    ].join('\n'),
    r.extractionPct || '—',
    outreachChip(r.outreachStatus)?.label ?? '—',
    r.crmLiaison || '—',
  ])

  autoTable(pdf, {
    startY: 72,
    head: [['Customer', 'Initial PwC Interaction Date', 'Days Active', 'Sentiment', 'Analytics Step', 'Files', '% Extraction Complete', 'Meeting', 'CRM Liaison']],
    body,
    theme: 'grid',
    margin: { left: 24, right: 24 },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [241, 245, 249],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 100, fontStyle: 'bold' },
      1: { cellWidth: 62 },
      2: { cellWidth: 54 },
      3: { cellWidth: 54 },
      4: { cellWidth: 74 },
      5: { cellWidth: 100 },
      6: { cellWidth: 56 },
      7: { cellWidth: 62 },
      8: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const r = rows[data.row.index]
      if (!r) return
      // Sentiment tint
      if (data.column.index === 3) {
        const s = SENTIMENT_DISPLAY[r.sentiment]
        if (s?.dot === '#22c55e') data.cell.styles.textColor = [22, 163, 74]
        else if (s?.dot === '#eab308') data.cell.styles.textColor = [161, 98, 7]
        else if (s?.dot === '#ef4444') data.cell.styles.textColor = [185, 28, 28]
      }
      // Days active tint
      if (data.column.index === 2 && r.daysActive != null) {
        if (r.daysActive < 14) data.cell.styles.textColor = [22, 163, 74]
        else if (r.daysActive <= 30) data.cell.styles.textColor = [161, 98, 7]
        else data.cell.styles.textColor = [185, 28, 28]
        data.cell.styles.fontStyle = 'bold'
      }
      // Step tint — distinct color per step number from STEP_COLORS.
      if (data.column.index === 4 && r.currentStep != null) {
        const rgb = hexToRgb(STEP_COLORS[r.currentStep])
        if (rgb) data.cell.styles.textColor = rgb
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // Page footer
  const total = pdf.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(148, 163, 184)
    pdf.text(`Project Mosaic — Detailed customer view`, 24, pdf.internal.pageSize.getHeight() - 12)
    pdf.text(`Page ${i} of ${total}`, pageW - 24, pdf.internal.pageSize.getHeight() - 12, { align: 'right' })
  }

  pdf.save(`detailed-customer-view-${stamp}.pdf`)
}

function hexToRgb(hex) {
  if (!hex) return null
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Capture a DOM element as a PNG via html2canvas and drop it into a PDF with
// a title banner. Used by the Customer Sentiment and Customer Outreach tiles.
async function downloadElementAsPdf(el, title, subtitle, filenameBase) {
  if (!el) return
  const canvas = await html2canvas(el, {
    backgroundColor: '#07080c',
    scale: 2,
    useCORS: true,
    logging: false,
  })
  const imgData = canvas.toDataURL('image/png')
  // Letter-landscape so a single tile fills the page nicely.
  const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const stamp = fileStamp()

  // Title band
  pdf.setFillColor(15, 17, 21)
  pdf.rect(0, 0, pageW, 60, 'F')
  pdf.setTextColor(248, 250, 252)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text(title, 28, 28)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(148, 163, 184)
  pdf.text(`${subtitle} · Generated ${new Date().toLocaleString()}`, 28, 46)

  // Image area
  const marginX = 28
  const marginTop = 78
  const marginBottom = 32
  const maxW = pageW - marginX * 2
  const maxH = pageH - marginTop - marginBottom
  const ratio = canvas.width / canvas.height
  let drawW = maxW
  let drawH = drawW / ratio
  if (drawH > maxH) {
    drawH = maxH
    drawW = drawH * ratio
  }
  const drawX = (pageW - drawW) / 2
  pdf.addImage(imgData, 'PNG', drawX, marginTop, drawW, drawH, undefined, 'FAST')

  // Footer
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(148, 163, 184)
  pdf.text(`Project Mosaic — ${title}`, marginX, pageH - 12)
  pdf.text(`Page 1 of 1`, pageW - marginX, pageH - 12, { align: 'right' })

  pdf.save(`${filenameBase}-${stamp}.pdf`)
}

// Full triage report PDF: one section per step (0-5) listing every customer
// in that step, tinted by sentiment to match the dashboard tile.
function downloadTriagePdf(triageData) {
  const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const stamp = fileStamp()
  const steps = triageData?.steps ?? []
  const sentimentByCustomer = { ...(triageData?.sentiment?.byCustomer ?? {}) }
  for (const st of (triageData?.sentiment?.categories ?? [])) {
    for (const c of (st.customers ?? [])) {
      if (!sentimentByCustomer[c]) sentimentByCustomer[c] = st
    }
  }
  const total = triageData?.totals?.uniqueCustomers ?? 0

  // Cover header
  pdf.setFillColor(15, 17, 21)
  pdf.rect(0, 0, pageW, 70, 'F')
  pdf.setTextColor(248, 250, 252)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('Customer Triage Process', 28, 32)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(148, 163, 184)
  pdf.text(`${total} customers in pipeline · Generated ${new Date().toLocaleString()}`, 28, 52)

  let cursorY = 90
  steps.forEach((s, i) => {
    const count = s.uniqueCount ?? s.customers.length
    // Section header band
    if (cursorY > pageH - 120) { pdf.addPage(); cursorY = 40 }
    pdf.setFillColor(241, 245, 249)
    pdf.rect(24, cursorY, pageW - 48, 44, 'F')
    pdf.setFillColor(15, 23, 42)
    pdf.rect(24, cursorY, 4, 44, 'F')
    pdf.setTextColor(15, 23, 42)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text(`${s.name} — ${s.title}`, 36, cursorY + 18)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(71, 85, 105)
    pdf.text(s.description || '', 36, cursorY + 33)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(15, 23, 42)
    pdf.text(`${count}`, pageW - 36, cursorY + 22, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(100, 116, 139)
    pdf.text('customers', pageW - 36, cursorY + 35, { align: 'right' })
    cursorY += 52

    if (!s.customers.length) {
      pdf.setFont('helvetica', 'italic')
      pdf.setFontSize(9)
      pdf.setTextColor(148, 163, 184)
      pdf.text('No customers in this step.', 36, cursorY + 8)
      cursorY += 24
      return
    }

    const body = s.customers.map(c => {
      const sent = sentimentByCustomer[c]
      return [c, sent?.label ?? '—']
    })
    autoTable(pdf, {
      startY: cursorY,
      head: [['Customer', 'Sentiment']],
      body,
      theme: 'grid',
      margin: { left: 24, right: 24 },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.4,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [241, 245, 249],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { cellWidth: 110 },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return
        const c = s.customers[data.row.index]
        const sent = sentimentByCustomer[c]
        if (!sent) return
        // Tint both cells with the sentiment color.
        let rgb = null
        if (sent.color === '#22c55e') rgb = [22, 163, 74]
        else if (sent.color === '#eab308') rgb = [161, 98, 7]
        else if (sent.color === '#ef4444') rgb = [185, 28, 28]
        else rgb = hexToRgb(sent.color)
        if (rgb && data.column.index === 1) {
          data.cell.styles.textColor = rgb
          data.cell.styles.fontStyle = 'bold'
        }
        if (rgb && data.column.index === 0) {
          data.cell.styles.textColor = rgb
        }
      },
    })
    cursorY = pdf.lastAutoTable.finalY + 18
  })

  // Footer
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(148, 163, 184)
    pdf.text('Project Mosaic — Customer Triage Process', 24, pageH - 12)
    pdf.text(`Page ${i} of ${totalPages}`, pageW - 24, pageH - 12, { align: 'right' })
  }
  pdf.save(`customer-triage-${stamp}.pdf`)
}

function FilterDropdown({ value, options, onChange, allLabel, title, multi = false }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const normalizedOptions = options.map(o => ({
    value: o.value ?? o,
    label: o.label ?? o.value ?? o,
    color: o.color,
  }))
  const selectedValues = multi
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : [])
  const selectedOptions = normalizedOptions.filter(o => selectedValues.includes(o.value))
  const isSelected = (v) => selectedValues.includes(v)
  const handlePick = (v) => {
    if (multi) {
      if (v === '') { onChange([]); setOpen(false); return }
      const next = isSelected(v)
        ? selectedValues.filter(x => x !== v)
        : [...selectedValues, v]
      onChange(next)
      // Keep the menu open in multi-select mode so users can pick more.
    } else {
      onChange(v); setOpen(false)
    }
  }

  // Trigger label: pick first selection's label and append "+N" if more.
  let triggerLabel = allLabel
  let triggerDot = null
  if (selectedOptions.length === 1) {
    triggerLabel = selectedOptions[0].label
    triggerDot = selectedOptions[0].color
  } else if (selectedOptions.length > 1) {
    triggerLabel = `${selectedOptions[0].label} +${selectedOptions.length - 1}`
    triggerDot = selectedOptions[0].color
  }

  const allOption = { value: '', label: allLabel }
  const allActive = selectedValues.length === 0
  return (
    <div className={`dcv-filter-wrap ${open ? 'is-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="dcv-filter"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={title}
      >
        {triggerDot && <span className="dcv-filter-dot" style={{ background: triggerDot }} />}
        <span className="dcv-filter-label">{triggerLabel}</span>
        <svg className="dcv-filter-chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className="dcv-filter-menu" role="listbox" aria-multiselectable={multi} aria-hidden={!open}>
        <button
          key="__all"
          type="button"
          role="option"
          aria-selected={allActive}
          className={`dcv-filter-option ${allActive ? 'is-selected' : ''}`}
          onClick={() => handlePick('')}
        >
          <span className="dcv-filter-option-label">{allOption.label}</span>
          {allActive && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
        {normalizedOptions.map(it => {
          const on = isSelected(it.value)
          return (
            <button
              key={it.value || '__opt'}
              type="button"
              role="option"
              aria-selected={on}
              className={`dcv-filter-option ${on ? 'is-selected' : ''}`}
              onClick={() => handlePick(it.value)}
            >
              <span className="dcv-filter-option-label">
                {multi && (
                  <span className={`dcv-filter-check ${on ? 'on' : ''}`} aria-hidden="true">
                    {on && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                )}
                {it.color && <span className="dcv-filter-dot" style={{ background: it.color }} />}
                {it.label}
              </span>
              {!multi && on && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const SENTIMENT_FILTER_OPTIONS = [
  { value: 'Red',    label: 'At Risk',   color: '#ef4444' },
  { value: 'Yellow', label: 'Attention', color: '#eab308' },
  { value: 'Green',  label: 'On Track',  color: '#22c55e' },
]

function DetailedCustomerView() {
  const [refreshKey, setRefreshKey] = useState(0)
  const triage = useTriage(refreshKey)
  const allRows = triage.data?.details ?? []
  const [downloading, setDownloading] = useState(false)
  const [query, setQuery] = useState('')
  const [businessLine, setBusinessLine] = useState('')
  const [sentiments, setSentiments] = useState([])
  // Customer-name sort direction: null = default priority sort, 'asc' = A→Z,
  // 'desc' = Z→A. The Customer column header cycles through these.
  const [nameSort, setNameSort] = useState(null)
  const cycleNameSort = () => {
    setNameSort(d => (d === null ? 'asc' : d === 'asc' ? 'desc' : null))
  }
  // Sentiment sort: null = off, 'risk' = Red → Yellow → Green → unknown,
  // 'safe' = Green → Yellow → Red → unknown. The Sentiment header cycles.
  const [sentSort, setSentSort] = useState(null)
  const cycleSentSort = () => {
    setSentSort(d => (d === null ? 'risk' : d === 'risk' ? 'safe' : null))
  }
  const businessLineOptions = [...new Set(
    allRows.map(r => (r.businessLine || '').trim()).filter(Boolean)
  )].sort()
  // Only keep sentiment buckets that exist in the data, but preserve the
  // canonical Red → Yellow → Green order rather than alphabetical.
  const presentSentiments = new Set(allRows.map(r => (r.sentiment || '').trim()).filter(Boolean))
  const sentimentOptions = SENTIMENT_FILTER_OPTIONS.filter(o => presentSentiments.has(o.value))
  const q = query.trim().toLowerCase()
  const filtered = allRows.filter(r => {
    if (businessLine && (r.businessLine || '').trim() !== businessLine) return false
    if (sentiments.length && !sentiments.includes((r.sentiment || '').trim())) return false
    if (q) {
      const hit =
        (r.customer || '').toLowerCase().includes(q) ||
        (r.crmLiaison || '').toLowerCase().includes(q)
      if (!hit) return false
    }
    return true
  })
  const byName = (a, b) =>
    (a.customer || '').localeCompare(b.customer || '', undefined, { sensitivity: 'base' })
  const byPriority = (a, b) => {
    const pa = a.priorityOrder == null ? Infinity : a.priorityOrder
    const pb = b.priorityOrder == null ? Infinity : b.priorityOrder
    if (pa !== pb) return pa - pb
    return byName(a, b)
  }
  const baseCmp = nameSort === 'asc'
    ? byName
    : nameSort === 'desc'
      ? (a, b) => byName(b, a)
      : byPriority
  // Risk-first sentiment order: Red → Yellow → Green → unknown (4).
  const SENT_RISK_RANK = { Red: 0, Yellow: 1, Green: 2 }
  const sentRank = (s) => SENT_RISK_RANK[(s || '').trim()] ?? 3
  const cmp = sentSort
    ? (a, b) => {
        const ra = sentRank(a.sentiment)
        const rb = sentRank(b.sentiment)
        const delta = sentSort === 'risk' ? ra - rb : rb - ra
        return delta !== 0 ? delta : baseCmp(a, b)
      }
    : baseCmp
  const rows = [...filtered].sort(cmp)
  if (triage.loading && !triage.data) {
    return <div className="dcv-shell"><div className="dcv-muted" style={{ padding: 24 }}>Loading…</div></div>
  }
  if (triage.error && !triage.data) {
    return <div className="dcv-shell"><div style={{ padding: 24, color: '#ef4444' }}>Error: {triage.error}</div></div>
  }
  const headers = [
    'Customer', 'Initial PwC Interaction Date', 'Days Active', 'Sentiment',
    'Analytics Current step', 'Files', '% Extraction Complete', 'Meeting Status', 'CRM Liaison',
  ]
  const handlePdfDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      downloadCustomersPdf(rows)
    } catch (e) {
      console.error('pdf download failed', e)
    } finally {
      setDownloading(false)
    }
  }
  return (
    <div className="dcv-shell">
      <div className="dcv-enter">
        <div className="dcv-head">
          <div className="dcv-title-wrap">
            <Users size={18} color="#cbd5e1" />
            <span className="dcv-title">Detailed customer view</span>
            <span className="dcv-count">
              {(q || businessLine || sentiments.length)
                ? `Showing ${rows.length} of ${allRows.length} customers`
                : `${rows.length} customers`}
            </span>
            {triage.data?.totals?.meeting0Count != null && (
              <span className="dcv-meeting0-stat" title="Customers with a Date of Meeting 0 in the Priority Customer Tracker">
                <span className="dcv-meeting0-num">{triage.data.totals.meeting0Count}</span>
                <span className="dcv-meeting0-label"># of Meeting 0&apos;s</span>
              </span>
            )}
          </div>
          <div className="dcv-actions" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <div className="dcv-search-wrap">
              <svg className="dcv-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/>
                <path d="m20 20-3.5-3.5"/>
              </svg>
              <input
                className="dcv-search"
                type="text"
                placeholder="Search customer or CRM…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              {query && (
                <button
                  className="dcv-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  title="Clear"
                >✕</button>
              )}
            </div>
            <FilterDropdown
              value={businessLine}
              options={businessLineOptions}
              onChange={setBusinessLine}
              allLabel="All Business Lines"
              title="Filter by Business Line"
            />
            <FilterDropdown
              value={sentiments}
              options={sentimentOptions}
              onChange={setSentiments}
              allLabel="All Sentiments"
              title="Filter by Customer Sentiment (multi-select)"
              multi
            />
            <button
              className="dcv-download"
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={triage.loading}
              title="Refresh from the latest Mosaic Customer Tracker"
            >
              <RefreshCw size={13} className={triage.loading ? 'spinning' : ''} />
              <span>{triage.loading ? 'Refreshing…' : 'Refresh'}</span>
            </button>
            <button
              className="dcv-download dcv-download-pdf"
              onClick={handlePdfDownload}
              disabled={downloading}
              title="Download as PDF"
            >
              <FileText size={13} className={downloading ? 'spinning' : ''} />
              <span>{downloading ? 'Capturing…' : 'PDF'}</span>
            </button>
            <button className="dcv-close" onClick={() => window.close()}>Close ✕</button>
          </div>
        </div>
        <div className="dcv-card">
          <table className="dcv-table">
            <thead>
              <tr>{headers.map(h => {
                if (h === 'Customer') {
                  return (
                    <th key={h}>
                      <button
                        type="button"
                        className={`dcv-sort-head ${nameSort ? 'is-active' : ''}`}
                        onClick={cycleNameSort}
                        title={
                          nameSort === 'asc' ? 'Sorted A→Z. Click for Z→A.'
                          : nameSort === 'desc' ? 'Sorted Z→A. Click to clear (back to Priority).'
                          : 'Click to sort by Customer A→Z (default is Priority).'
                        }
                      >
                        <span>{h}</span>
                        <span className="dcv-sort-arrows" aria-hidden="true">
                          <span className={`dcv-arrow up ${nameSort === 'asc' ? 'on' : ''}`}>▲</span>
                          <span className={`dcv-arrow down ${nameSort === 'desc' ? 'on' : ''}`}>▼</span>
                        </span>
                      </button>
                    </th>
                  )
                }
                if (h === 'Sentiment') {
                  return (
                    <th key={h}>
                      <button
                        type="button"
                        className={`dcv-sort-head ${sentSort ? 'is-active' : ''}`}
                        onClick={cycleSentSort}
                        title={
                          sentSort === 'risk' ? 'Sorted Red → Yellow → Green. Click to reverse (Green → Yellow → Red).'
                          : sentSort === 'safe' ? 'Sorted Green → Yellow → Red. Click to clear.'
                          : 'Click to sort by Sentiment (Red → Yellow → Green).'
                        }
                      >
                        <span>{h}</span>
                        <span className="dcv-sort-arrows" aria-hidden="true">
                          <span className={`dcv-arrow up ${sentSort === 'risk' ? 'on' : ''}`}>▲</span>
                          <span className={`dcv-arrow down ${sentSort === 'safe' ? 'on' : ''}`}>▼</span>
                        </span>
                      </button>
                    </th>
                  )
                }
                return <th key={h}>{h}</th>
              })}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const sent = SENTIMENT_DISPLAY[r.sentiment] ?? null
                const step = r.currentStep
                const stepLabel = step != null ? `Step ${step} · ${STEP_SHORT[step]}` : '—'
                const stepColor = step != null ? STEP_COLORS[step] : '#475569'
                const meet = outreachChip(r.outreachStatus)
                const daysColor = daysActiveColor(r.daysActive)
                return (
                  <tr key={i} className="dcv-row-enter" style={{ animationDelay: `${Math.min(i, 14) * 28}ms` }}>
                    <td>
                      <div className="dcv-cust-name">{r.customer}</div>
                      <div className="dcv-cust-sub">Priority - {r.priorityOrder ?? '?'}</div>
                    </td>
                    <td className="dcv-muted" style={{ maxWidth: 180, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>
                      {formatRequestDate(r.requestDate)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.daysActive != null
                        ? <span style={{ color: daysColor, fontWeight: 600 }}>{r.daysActive} days</span>
                        : <span className="dcv-dash">—</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {sent ? (
                        <span className="dcv-pill" style={{ color: sent.dot, background: sent.dot + '20' }}>
                          <span className="dcv-pill-dot" />
                          <span style={{ color: '#e5e7eb' }}>{sent.label}</span>
                        </span>
                      ) : <span className="dcv-dash">—</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {step != null ? (
                        <span className="dcv-pill" style={{ color: stepColor, background: stepColor + '20' }}>
                          <span style={{ color: '#e5e7eb' }}>{stepLabel}</span>
                        </span>
                      ) : <span className="dcv-dash">—</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div className="dcv-files">
                        <span className="dcv-files-num">{r.siftFiles != null ? r.siftFiles.toLocaleString() : '—'}</span>
                        <span className="dcv-files-label">sift</span>
                        <span className="dcv-files-num muted">{r.copiedFiles != null ? r.copiedFiles.toLocaleString() : '—'}</span>
                        <span className="dcv-files-label">copied</span>
                        <span className="dcv-files-num dim">{r.attributedFiles != null ? r.attributedFiles.toLocaleString() : '—'}</span>
                        <span className="dcv-files-label">attr</span>
                        <span className="dcv-files-num dim">{r.releFiles != null ? r.releFiles.toLocaleString() : '—'}</span>
                        <span className="dcv-files-label">RELE</span>
                        <span className="dcv-files-num dim">{r.extractedFiles != null ? r.extractedFiles.toLocaleString() : '—'}</span>
                        <span className="dcv-files-label">extracted</span>
                      </div>
                    </td>
                    <td className="dcv-muted" style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {r.extractionPct || <span className="dcv-dash">—</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {meet ? (
                        <span className="dcv-chip" style={{ background: meet.bg, color: meet.fg, borderColor: 'transparent' }}>
                          {meet.label}
                        </span>
                      ) : <span className="dcv-dash">—</span>}
                    </td>
                    <td className="dcv-muted" style={{ whiteSpace: 'nowrap' }}>
                      {r.crmLiaison || <span className="dcv-dash">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function WaterfallPage() {
  const totalSift = useKpi('total-sift-objects')
  const siftBqGcs = useKpi('sift-objects-bq-gcs')
  const siftOther = useKpi('sift-other-objects')
  const filesForHarv = useKpi('files-for-harvesting')
  const duplicates = useKpi('duplicates')
  const exclusions = useKpi('exclusions-bq')
  const pending = {
    value: (filesForHarv.value != null && duplicates.value != null)
      ? filesForHarv.value - duplicates.value
      : null,
    error: filesForHarv.error || duplicates.error,
    loading: filesForHarv.loading || duplicates.loading,
  }
  const bqFiles = useKpi('bq-files')
  const gcsFiles = useKpi('gcs-files')
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      padding: 16, gap: 12, background: '#07080c',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#e5e7eb', fontSize: 14, fontWeight: 600 }}>
          <FileText size={16} /> File Profiling — Waterfall
        </div>
        <button
          className="icon-btn"
          onClick={() => window.close()}
          aria-label="Close tab"
          title="Close tab"
        >
          <X size={16} />
        </button>
      </div>
      <div style={{
        flex: 1, minHeight: 0,
        background: '#0f1115', border: '1px solid #1f2937', borderRadius: 10, padding: 16,
        display: 'flex', flexDirection: 'column',
      }}>
        <BurndownTree
          totalSift={totalSift}
          siftBqGcs={siftBqGcs}
          siftOther={siftOther}
          filesForHarv={filesForHarv}
          duplicates={duplicates}
          exclusions={exclusions}
          pending={pending}
          bqFiles={bqFiles}
          gcsFiles={gcsFiles}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exfiltrated-Files waterfall (opened in a new tab from the File Preservation
// tile's "Total Exfil Files" stat via ?view=exfil).
//
// Hierarchical breakdown of Total Exfiltrated Files. Colours follow the legend:
//   green = preservation complete, magenta = preservation pending,
//   purple = intermediate roll-up, gray = zero-byte files.
//
// Values live in the WF_DATA object below as display strings. Each is a
// placeholder from the source diagram; swap any entry for a useKpi(...) value
// once its query is provided — the layout does not change.
// ---------------------------------------------------------------------------
const WF_COLORS = {
  total:    { fill: '#3b1a63', text: '#ffffff' }, // purple roll-up
  source:   { fill: '#3b1a63', text: '#ffffff' },
  complete: { fill: '#16a34a', text: '#ffffff' }, // green
  pending:  { fill: '#d61f9c', text: '#ffffff' }, // magenta
  zero:     { fill: '#9aa3a9', text: '#ffffff' }, // gray
}

const WF_DATA = {
  total: '226.4M',
  sources: '26,138,365',
  gcsUncompressed: '11.4M',
  glean: '191.7M',
  bqGcsOther: '23,300,588',
  zeroByte: '2,837,777',
  bq: '33,452', gcs: '8,105,841', github: '15M', jira: '356k', others: 'TBD',
  bq_bq: '10,202', bq_tiDeleted: 'TBD', bq_toPreserve: null,
  gcs_gcs: '7,065,960', gcs_tiDeleted: '1,039,891',
  gh_gh: '1.98M', gh_tiDeleted: 'TBD', gh_toPreserve: '12M',
  jira_jira: 'TBD', jira_tiDeleted: 'TBD', jira_toPreserve: null,
  others_others: 'TBD',
}

function WfBox({ x, y, w, h, kind, value, label, vSize = 15, lSize = 8.5 }) {
  const c = WF_COLORS[kind] || WF_COLORS.source
  const cx = x + w / 2
  const lines = Array.isArray(label) ? label : (label ? [label] : [])
  const hasVal = value != null && value !== ''
  const contentH = (hasVal ? vSize : 0) + lines.length * (lSize + 2.5)
  let cur = y + (h - contentH) / 2
  const els = []
  if (hasVal) {
    cur += vSize
    els.push(<text key="v" x={cx} y={cur} fontSize={vSize} fontWeight={700} fill={c.text} textAnchor="middle">{value}</text>)
  }
  lines.forEach((ln, i) => {
    cur += (i === 0 && hasVal) ? lSize + 2 : lSize + 2.5
    els.push(<text key={'l' + i} x={cx} y={cur} fontSize={lSize} fill={c.text} textAnchor="middle" opacity={0.95}>{ln}</text>)
  })
  return <g><rect x={x} y={y} width={w} height={h} rx={3} fill={c.fill} />{els}</g>
}

function ExfilWaterfallTree({ d = WF_DATA }) {
  const LINE = { stroke: '#64748b', strokeWidth: 1.3, fill: 'none' }
  const ARROW = { ...LINE, markerEnd: 'url(#wfArrow)' }
  const srcLabelLong = ['BQ + GCS + other sources', 'like GitHub, AWS, Azure,', 'JIRA etc.']
  return (
    <svg viewBox="0 0 1080 380" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <defs>
        <marker id="wfArrow" markerWidth="10" markerHeight="8" refX="5" refY="6" orient="0" markerUnits="userSpaceOnUse">
          <path d="M0,0 L10,0 L5,6 Z" fill="#64748b" />
        </marker>
      </defs>

      {/* connectors */}
      {/* L1 sources -> L2 */}
      <path d="M222,116 V123" {...LINE} />
      <path d="M143,123 H353" {...LINE} />
      <path d="M143,123 V140" {...ARROW} />
      <path d="M353,123 V140" {...ARROW} />
      {/* L2 bqGcsOther -> L3 bus */}
      <path d="M143,190 V228" {...LINE} />
      <path d="M134,228 H1020" {...LINE} />
      <path d="M134,228 V250" {...ARROW} />
      <path d="M392,228 V250" {...ARROW} />
      <path d="M668,228 V250" {...ARROW} />
      <path d="M890,228 V250" {...ARROW} />
      <path d="M1020,228 V250" {...ARROW} />
      {/* L3 -> L4 (per parent) */}
      <path d="M134,302 V310" {...LINE} /><path d="M52,310 H209" {...LINE} />
      <path d="M52,310 V320" {...ARROW} /><path d="M127,310 V320" {...ARROW} /><path d="M209,310 V320" {...ARROW} />
      <path d="M392,302 V310" {...LINE} /><path d="M338,310 H474" {...LINE} />
      <path d="M338,310 V320" {...ARROW} /><path d="M474,310 V320" {...ARROW} />
      <path d="M668,302 V310" {...LINE} /><path d="M571,310 H748" {...LINE} />
      <path d="M571,310 V320" {...ARROW} /><path d="M651,310 V320" {...ARROW} /><path d="M748,310 V320" {...ARROW} />
      <path d="M890,302 V310" {...LINE} /><path d="M835,310 H947" {...LINE} />
      <path d="M835,310 V320" {...ARROW} /><path d="M892,310 V320" {...ARROW} /><path d="M947,310 V320" {...ARROW} />
      <path d="M1020,302 V320" {...ARROW} />

      {/* L0 */}
      <WfBox x={18} y={8} w={1044} h={42} kind="total" value={d.total} label="Total Exfiltrated Files" vSize={17} lSize={10} />

      {/* L1 */}
      <WfBox x={18} y={70} w={408} h={46} kind="source" value={d.sources} label="BQ + GCS + other sources like GitHub, AWS, Azure, JIRA etc." vSize={15} lSize={8} />
      <WfBox x={438} y={70} w={152} h={46} kind="complete" value={d.gcsUncompressed} label="(GCS uncompressed)" />
      <WfBox x={602} y={70} w={460} h={46} kind="complete" value={d.glean} label="Glean" />

      {/* L2 */}
      <WfBox x={18} y={140} w={250} h={50} kind="source" value={d.bqGcsOther} label={srcLabelLong} vSize={14} lSize={8} />
      <WfBox x={280} y={140} w={146} h={50} kind="zero" value={d.zeroByte} label="(Zero Byte Files)" />

      {/* L3 */}
      <WfBox x={18} y={250} w={232} h={52} kind="complete" value={d.bq} label="BQ" />
      <WfBox x={258} y={250} w={268} h={52} kind="complete" value={d.gcs} label="GCS" />
      <WfBox x={534} y={250} w={268} h={52} kind="complete" value={d.github} label="GitHub" />
      <WfBox x={810} y={250} w={160} h={52} kind="pending" value={d.jira} label="Jira" />
      <WfBox x={978} y={250} w={84} h={52} kind="pending" value={d.others} label="Others" />

      {/* L4 — under BQ */}
      <WfBox x={18} y={320} w={68} h={46} kind="complete" value={d.bq_bq} label="BQ" vSize={11} lSize={8} />
      <WfBox x={90} y={320} w={74} h={46} kind="complete" value={d.bq_tiDeleted} label="TI Deleted" vSize={11} lSize={8} />
      <WfBox x={168} y={320} w={82} h={46} kind="pending" value={d.bq_toPreserve} label="To Be Preserved" vSize={10} lSize={8} />
      {/* L4 — under GCS */}
      <WfBox x={258} y={320} w={160} h={46} kind="complete" value={d.gcs_gcs} label="GCS" vSize={12} lSize={8} />
      <WfBox x={422} y={320} w={104} h={46} kind="complete" value={d.gcs_tiDeleted} label="TI Deleted" vSize={11} lSize={8} />
      {/* L4 — under GitHub */}
      <WfBox x={534} y={320} w={74} h={46} kind="complete" value={d.gh_gh} label="GitHub" vSize={11} lSize={8} />
      <WfBox x={612} y={320} w={78} h={46} kind="complete" value={d.gh_tiDeleted} label="TI Deleted" vSize={11} lSize={8} />
      <WfBox x={694} y={320} w={108} h={46} kind="pending" value={d.gh_toPreserve} label="To Be Preserved" vSize={11} lSize={8} />
      {/* L4 — under Jira */}
      <WfBox x={810} y={320} w={50} h={46} kind="pending" value={d.jira_jira} label="Jira" vSize={10} lSize={7.5} />
      <WfBox x={864} y={320} w={56} h={46} kind="pending" value={d.jira_tiDeleted} label="TI Deleted" vSize={10} lSize={7.5} />
      <WfBox x={924} y={320} w={46} h={46} kind="pending" value={d.jira_toPreserve} label="To Be Preserved" vSize={9} lSize={6.5} />
      {/* L4 — under Others */}
      <WfBox x={978} y={320} w={84} h={46} kind="pending" value={d.others_others} label="Others" vSize={11} lSize={8} />
    </svg>
  )
}

function WfLegendSwatch({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
      <span style={{ width: 14, height: 14, borderRadius: 3, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

// Format a raw KPI cell for display: '…' while loading, 'err' on error, comma
// grouped for numbers, and pass-through strings ('tbd' -> 'TBD') otherwise.
function wfDisp(kpi, raw) {
  if (kpi.loading) return '…'
  if (kpi.error) return 'err'
  if (raw == null || raw === '') return '—'
  if (typeof raw === 'number') return Number.isFinite(raw) ? formatCompact(raw) : '—'
  const s = String(raw)
  return /^\d+$/.test(s) ? formatCompact(Number(s)) : s.toUpperCase()
}

function ExfilWaterfallPage() {
  const top = useKpi('wf-top')
  const zero = useKpi('wf-zero')
  const sources = useKpi('wf-sources')
  const t = top.value || {}
  const z = zero.value || {}
  const bySrc = Object.fromEntries((Array.isArray(sources.value) ? sources.value : []).map((r) => [r.source_type, r]))
  const s = (src, col) => wfDisp(sources, bySrc[src]?.[col])
  const d = {
    total: wfDisp(top, t.totalexfilFiles),
    sources: wfDisp(top, t.bg_gcs_other_sources),
    gcsUncompressed: wfDisp(top, t.gcs_compressed),
    glean: wfDisp(top, t.glen),
    bqGcsOther: wfDisp(zero, z.final_variance),
    zeroByte: wfDisp(zero, z.ZERO_BYTE_FILES),
    bq: s('bigquery', 'total_files'),
    gcs: s('gcp_buckets', 'total_files'),
    github: s('github', 'total_files'),
    jira: s('jira', 'total_files'),
    others: s('others', 'total_files'),
    bq_bq: s('bigquery', 'preserved_files'),
    bq_tiDeleted: s('bigquery', 'tideleted'),
    bq_toPreserve: s('bigquery', 'tobe_preserved'),
    gcs_gcs: s('gcp_buckets', 'preserved_files'),
    gcs_tiDeleted: s('gcp_buckets', 'tideleted'),
    gh_gh: s('github', 'preserved_files'),
    gh_tiDeleted: s('github', 'tideleted'),
    gh_toPreserve: s('github', 'tobe_preserved'),
    jira_jira: s('jira', 'preserved_files'),
    jira_tiDeleted: s('jira', 'tideleted'),
    jira_toPreserve: s('jira', 'tobe_preserved'),
    others_others: s('others', 'tobe_preserved'),
  }
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      padding: 16, gap: 12, background: '#07080c',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#e5e7eb', fontSize: 15, fontWeight: 700 }}>
          <FileText size={16} /> Mosaic Analytics Data Harvesting Status
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
          <WfLegendSwatch color={WF_COLORS.complete.fill} label="Preservation complete" />
          <WfLegendSwatch color={WF_COLORS.pending.fill} label="Preservation pending" />
          <button className="icon-btn" onClick={() => window.close()} aria-label="Close tab" title="Close tab"><X size={16} /></button>
        </div>
      </div>
      <div style={{
        flex: 1, minHeight: 0,
        background: '#0f1115', border: '1px solid #1f2937', borderRadius: 10, padding: 16,
        display: 'flex', flexDirection: 'column',
      }}>
        <ExfilWaterfallTree d={d} />
      </div>
    </div>
  )
}

function FileProfiling({ refreshKey }) {
  const profile = useKpi('file-profiling', refreshKey)
  const v = profile.value || {}
  const mk = (key) => ({
    value: v[key] != null && Number.isFinite(v[key]) ? v[key] : null,
    loading: profile.loading,
    error: profile.error,
  })
  const totalFiles = { value: 226400000, loading: false, error: null }
  const deletedInTiKpi = { value: 1100000, loading: false, error: null }
  const duplicatesKpi = mk('Duplicates')
  const exclusionsKpi = { value: 1280000, loading: false, error: null }
  const potentialExclusionsKpi = { value: 2400000, loading: false, error: null }
  const PRESERVATION_FILES = 209980000
  const filesForHarvestingKpi = {
    value: (duplicatesKpi.value != null && exclusionsKpi.value != null && potentialExclusionsKpi.value != null)
      ? PRESERVATION_FILES - duplicatesKpi.value - exclusionsKpi.value - potentialExclusionsKpi.value
      : null,
    loading: duplicatesKpi.loading || exclusionsKpi.loading || potentialExclusionsKpi.loading,
    error: duplicatesKpi.error || exclusionsKpi.error || potentialExclusionsKpi.error,
  }
  const pendingPreservationKpi = {
    value: deletedInTiKpi.value != null
      ? totalFiles.value - PRESERVATION_FILES - deletedInTiKpi.value
      : null,
    loading: deletedInTiKpi.loading,
    error: deletedInTiKpi.error,
  }
  const barRows = [
    { label: 'Total Exfil Files',    kpi: totalFiles,                 color: '#5b21b6' },
    { label: 'Files Deleted in TI (confirmed with TELUS team)', kpi: deletedInTiKpi,             color: '#6b7280' },
    { label: 'Duplicates',           kpi: duplicatesKpi,              color: '#f59e0b' },
    { label: 'Exclusions',           kpi: exclusionsKpi,              color: '#fb7185' },
    { label: 'Potential Exclusions (Pending Confirmation)', kpi: potentialExclusionsKpi, color: '#f97316' },
    { label: 'Files For Harvesting', kpi: filesForHarvestingKpi,      color: '#22c55e' },
    { label: 'Pending Preservation', kpi: pendingPreservationKpi,     color: '#d946ef' },
  ]

  return (
    <div className="card tile-files">
      <div className="card-head">
        <div className="card-title"><FileText size={14} /> File Profiling</div>
      </div>
      <BurndownBars rows={barRows} max={totalFiles.value} />
    </div>
  )
}

function FileHarvesting({ refreshKey }) {
  const processed = useKpi('bq-files', refreshKey)
  const total = useKpi('pending-extraction', refreshKey)
  const gcsFiles = useKpi('gcs-files', refreshKey)
  const rawRecords = useKpi('raw-records', refreshKey)
  const profiling = useKpi('file-profiling', refreshKey)
  const PRESERVATION_FILES = 209980000
  const dup = profiling.value?.['Duplicates']
  const exc = 1280000 // matches the fixed Exclusions on the File Profiling tile
  const potExc = 2400000
  const pendingHarvesting = {
    value: (dup != null && exc != null && potExc != null)
      ? PRESERVATION_FILES - dup - exc - potExc
      : null,
    loading: profiling.loading,
    error: profiling.error,
  }

  const processedVal = 3840000
  const pendingHarvVal = pendingHarvesting.value ?? 0
  const ready = !pendingHarvesting.loading && !pendingHarvesting.error
  const completePct = pendingHarvVal > 0 ? Math.min(100, (processedVal / pendingHarvVal) * 100) : 0
  const processedPct = pendingHarvVal > 0 ? Math.min(100, Math.max(0.5, (processedVal / pendingHarvVal) * 100)) : 0
  const remainingPct = Math.max(0, 100 - processedPct)
  const remainingVal = Math.max(0, pendingHarvVal - processedVal)

  return (
    <div className="card tile-files">
      <div className="card-head">
        <div className="card-title"><Database size={14} /> File Harvesting</div>
        <span className="badge">TBD</span>
      </div>
      <div className="harv-bar-wrap">
        <div className="harv-bar">
          <div
            className="harv-bar-green"
            style={{ width: `${processedPct}%` }}
            title={ready ? `Files Processed: ${processedVal.toLocaleString()} (${completePct.toFixed(2)}% of Pending for Harvesting)` : 'Loading…'}
          />
          <div
            className="harv-bar-orange"
            style={{ width: `${remainingPct}%` }}
            title={ready ? `Remaining: ${remainingVal.toLocaleString()} (${(100 - completePct).toFixed(2)}%)` : 'Loading…'}
          />
        </div>
        <div className="harv-bar-axis">
          <span>0</span>
          <span><KpiValue kpi={pendingHarvesting} /></span>
        </div>
      </div>
      <div className="harv-stats">
        <div className="harv-stat">
          <div className="harv-num green"><CountUp value={processedVal} /></div>
          <div className="muted-small">Files Processed</div>
        </div>
        <div className="harv-stat" style={{ textAlign: 'right' }}>
          <div className="harv-num orange">{ready ? <CountUp value={remainingVal} /> : '…'}</div>
          <div className="muted-small">Pending for Harvesting</div>
        </div>
      </div>
      <div className="harv-total">
        <div className="harv-num xl" style={{ color: '#0d9488' }}><KpiValue kpi={rawRecords} /></div>
        <div className="muted-small">Raw Records</div>
      </div>
    </div>
  )
}

function CustomerAttribution() {
  const singleAttributed = 0
  const notAttributed = 0
  const totalCustomers = 0
  const total = singleAttributed + notAttributed
  const data = total > 0
    ? [
        { name: 'Single Attributed', value: singleAttributed, color: C.green },
        { name: 'Not Attributed', value: notAttributed, color: C.gray },
      ]
    : [{ name: 'No data', value: 1, color: 'rgba(255,255,255,0.08)' }]
  const pct = (v) => total > 0 ? `${Math.round((v / total) * 100)}%` : '0%'
  return (
    <div className="card tile-customers">
      <div className="card-head">
        <div className="card-title"><Users size={14} /> Customer Attribution</div>
        <span className="badge">{total.toLocaleString()} Files</span>
      </div>
      <div className="donut-wrap" style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius="58%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', textAlign: 'center',
        }}>
          <div className="attr-num">{totalCustomers}</div>
          <div className="muted-small">Total Customers</div>
        </div>
      </div>
      <div className="attr-legend">
        <div className="dl-row">
          <span className="legend-dot" style={{ background: C.green }} />
          <span className="dl-label">Single Attributed</span>
          <span className="dl-val">{pct(singleAttributed)}</span>
        </div>
        <div className="dl-row">
          <span className="legend-dot" style={{ background: C.gray }} />
          <span className="dl-label">Not Attributed</span>
          <span className="dl-val">{pct(notAttributed)}</span>
        </div>
      </div>
    </div>
  )
}

function DcBarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="dc-tip">
      <div className="dc-tip-name">{d.fullName}</div>
      <div className="dc-tip-row"><span>Unique values</span><strong>{Number(d.unique).toLocaleString()}</strong></div>
      <div className="dc-tip-row"><span>Total records</span><strong>{Number(d.total).toLocaleString()}</strong></div>
      {d.pct != null && <div className="dc-tip-row"><span>Share</span><strong>{dcPct(d.pct)}</strong></div>}
    </div>
  )
}

const DC_TOP_N = 15
// Combination to emphasize (bold label + value) in the chart.
const DC_HIGHLIGHT = 'ID + Email'

// Teal/cyan gradient by magnitude (deep teal = largest).
const dcMix = (t) => {
  const lo = [165, 243, 252], hi = [13, 148, 136] // #a5f3fc → #0d9488
  const k = Math.sqrt(Math.max(0, Math.min(1, t)))
  const c = lo.map((l, i) => Math.round(l + (hi[i] - l) * k))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

function dcMapRows(rows) {
  return rows.map(r => ({
    fullName: r.UNIQUE_COMBINATION,
    unique: Number(r.UNIQUE_VALUE_COMBINATIONS_COUNT) || 0,
    total: Number(r.TOTAL_RECORD_COUNT) || 0,
  }))
}

// Build the sorted chart series. limit != null caps to the top N and rolls the
// rest into a grey "Other" bar (tile view); limit == null shows every combination.
function dcChartData(mapped, measure, limit) {
  const key = measure === 'unique' ? 'unique' : 'total'
  const sorted = [...mapped].sort((a, b) => b[key] - a[key])
  let items = sorted
  let rest = []
  if (limit != null && sorted.length > limit) {
    items = sorted.slice(0, limit)
    rest = sorted.slice(limit)
  }
  const out = items.map(d => ({ ...d }))
  if (rest.length) {
    out.push({
      fullName: `Other (${rest.length} combinations)`,
      unique: rest.reduce((s, d) => s + d.unique, 0),
      total: rest.reduce((s, d) => s + d.total, 0),
      isOther: true,
    })
  }
  const max = Math.max(1, ...out.map(d => d[key]))
  // Grand total of the charted measure across every combination (Other already
  // sums the tail), so the displayed shares add up to 100%.
  const grand = out.reduce((s, d) => s + d[key], 0) || 1
  return out.map(d => ({
    ...d,
    name: d.fullName,
    value: d[key],
    pct: (d[key] / grand) * 100,
    fill: d.isOther ? '#4b5563' : dcMix(d[key] / max),
  }))
}

// Compact share string: keeps small slivers legible without noisy decimals.
function dcPct(p) {
  if (p >= 10) return `${Math.round(p)}%`
  if (p >= 1) return `${p.toFixed(1)}%`
  if (p >= 0.1) return `${p.toFixed(1)}%`
  return '<0.1%'
}

// Reusable horizontal-bar renderer. labelChars sets where long y-axis labels
// truncate (wider in the modal); the full name is always in the tooltip.
// Wrap a combination label onto multiple lines at " + " boundaries so the full
// text stays visible instead of being truncated.
function dcWrapLabel(label, maxChars) {
  const tokens = label.split(' + ')
  const lines = []
  let cur = ''
  for (const t of tokens) {
    const piece = cur ? `${cur} + ${t}` : t
    if (piece.length > maxChars && cur) { lines.push(cur); cur = t }
    else cur = piece
  }
  if (cur) lines.push(cur)
  return lines
}

function DcBarChart({ data, labelChars = 26, yWidth = 180, fontSize = 10 }) {
  const tick = ({ x, y, payload }) => {
    const label = String(payload.value)
    const lines = dcWrapLabel(label, labelChars)
    const lh = fontSize + 3
    const startDy = -((lines.length - 1) * lh) / 2 + 4 // vertically center the block on the bar
    return (
      <text x={x} y={y} textAnchor="end" fill={C.text} fontSize={fontSize} fontWeight={700}>
        {lines.map((ln, i) => (
          <tspan key={i} x={x} dy={i === 0 ? startDy : lh}>{i < lines.length - 1 ? `${ln} +` : ln}</tspan>
        ))}
      </text>
    )
  }
  // Custom value labels: "<value> · <share>".
  const renderValueLabel = ({ x, y, width, height, value, index }) => {
    const d = data[index]
    return (
      <text x={x + width + 6} y={y + height / 2} dy={4} textAnchor="start"
        fill={C.text} fontSize={fontSize} fontWeight={400}>
        {formatCompact(value)} · {dcPct(d?.pct ?? 0)}
      </text>
    )
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 116, bottom: 4, left: 4 }} barCategoryGap={3}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={yWidth} tick={tick} tickLine={false} axisLine={false} interval={0} />
        <Tooltip content={<DcBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          <LabelList dataKey="value" content={renderValueLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DcToggle({ measure, setMeasure }) {
  return (
    <div className="dc-toggle">
      <button type="button" className={measure === 'unique' ? 'active' : ''} onClick={() => setMeasure('unique')}>Unique</button>
      <button type="button" className={measure === 'total' ? 'active' : ''} onClick={() => setMeasure('total')}>Total</button>
    </div>
  )
}

function DcModal({ mapped, measure, setMeasure, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const data = dcChartData(mapped, measure, null)
  // Give every bar room (incl. wrapped multi-line labels) so all combinations
  // are visible; the body scrolls.
  const chartHeight = Math.max(340, data.length * 34 + 16)
  return createPortal(
    <div className="dc-modal-backdrop" onClick={onClose}>
      <div className="dc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dc-modal-head">
          <div>
            <div className="dc-modal-title"><Database size={16} /> Data Complexion — all combinations</div>
            <span className="muted-small">{mapped.length} PII element combinations, sorted by {measure === 'unique' ? 'unique values' : 'total records'}</span>
          </div>
          <div className="dc-modal-actions">
            <DcToggle measure={measure} setMeasure={setMeasure} />
            <button type="button" className="dc-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
        </div>
        <div className="dc-modal-body">
          <div className="dc-modal-chart" style={{ minHeight: chartHeight }}>
            <DcBarChart data={data} labelChars={42} yWidth={320} fontSize={11} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Vibrant qualitative palette — one distinct hue per category, ordered so
// neighbouring pie slices always contrast.
const DC_PIE_COLORS = [
  '#3b82f6', '#f97316', '#22c55e', '#ec4899', '#06b6d4',
  '#eab308', '#8b5cf6', '#84cc16', '#ef4444', '#14b8a6',
  '#d946ef', '#f59e0b', '#6366f1', '#f43f5e', '#10b981', '#a855f7',
]

function DcPieTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const pct = total ? (d.value / total) * 100 : 0
  return (
    <div className="dc-tip">
      <div className="dc-tip-name">{d.name}</div>
      <div className="dc-tip-row"><span>Records</span><strong>{Number(d.value).toLocaleString()}</strong></div>
      <div className="dc-tip-row"><span>Share</span><strong>{dcPct(pct)}</strong></div>
    </div>
  )
}

// Pop-up pie chart for a simple category/count KPI (e.g. PERSON_ID_TYPE, RECORD_TYPE).
function DcPieModal({ kpiId, title, refreshKey, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const kpi = useKpi(kpiId, refreshKey)
  const rows = Array.isArray(kpi.value) ? kpi.value : []
  const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0)
  // Percentage label placed inside each slice (at the band centroid) so labels
  // sit in their own wedge and never overlap. Skipped for slices too thin to fit.
  const RAD = Math.PI / 180
  const renderInsideLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.05) return null
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * RAD)
    const y = cy + r * Math.sin(-midAngle * RAD)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central">
        <tspan x={x} dy="-0.35em" fontSize={11} fontWeight={700}>{name}</tspan>
        <tspan x={x} dy="1.25em" fontSize={11} fontWeight={600} opacity={0.92}>{`${(percent * 100).toFixed(0)}%`}</tspan>
      </text>
    )
  }
  return createPortal(
    <div className="dc-modal-backdrop" onClick={onClose}>
      <div className="dc-modal dc-modal-pie" onClick={(e) => e.stopPropagation()}>
        <div className="dc-modal-head">
          <div>
            <div className="dc-modal-title"><PieChartIcon size={16} /> {title}</div>
            <span className="muted-small">{rows.length} types · {total.toLocaleString()} records</span>
          </div>
          <button type="button" className="dc-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="dc-modal-body">
          {kpi.loading ? (
            <div className="dc-empty">Loading…</div>
          ) : kpi.error ? (
            <div className="dc-empty">err</div>
          ) : rows.length === 0 ? (
            <div className="dc-empty">No data</div>
          ) : (
            <>
              <div className="dc-pie-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius="46%" outerRadius="78%" paddingAngle={1}
                      label={renderInsideLabel} labelLine={false} isAnimationActive={false}>
                      {rows.map((r, i) => <Cell key={i} fill={DC_PIE_COLORS[i % DC_PIE_COLORS.length]} stroke="#0b0d12" strokeWidth={1} />)}
                    </Pie>
                    <Tooltip content={<DcPieTooltip total={total} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="dc-pie-legend">
                {rows.map((r, i) => (
                  <li key={i} className="dc-pie-legend-item">
                    <span className="dc-pie-dot" style={{ background: DC_PIE_COLORS[i % DC_PIE_COLORS.length] }} />
                    <span className="dc-pie-legend-name">{r.name}</span>
                    <span className="dc-pie-legend-pct">{dcPct(total ? (Number(r.value) / total) * 100 : 0)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function DataComplexion({ refreshKey }) {
  const kpi = useKpi('data-complexion', refreshKey)
  const [measure, setMeasure] = useState('total') // 'unique' | 'total'
  const [open, setOpen] = useState(false)
  const [pie, setPie] = useState(null) // null | { kpiId, title }
  const rows = Array.isArray(kpi.value) ? kpi.value : []
  const mapped = dcMapRows(rows)
  const data = dcChartData(mapped, measure, DC_TOP_N)

  return (
    <div className="card tile-files tile-complexion">
      <div className="card-head">
        <div>
          <div className="card-title"><Database size={14} /> Data Complexion</div>
          <span className="muted-small">PII element combinations in raw person records — top {DC_TOP_N} by {measure === 'unique' ? 'unique values' : 'total records'}</span>
          <div className="dc-links">
            <button type="button" className="dc-link" onClick={() => setPie({ kpiId: 'person-id-types', title: 'Person ID Type Analysis' })}>
              <PieChartIcon size={11} /> Person ID Types
            </button>
            <button type="button" className="dc-link" onClick={() => setPie({ kpiId: 'record-types', title: 'Record Type Analysis' })}>
              <PieChartIcon size={11} /> Record Types
            </button>
          </div>
        </div>
        <div className="dc-head-actions">
          <DcToggle measure={measure} setMeasure={setMeasure} />
          {mapped.length > 0 && (
            <button type="button" className="dc-viewall" onClick={() => setOpen(true)}>View all ({mapped.length})</button>
          )}
        </div>
      </div>
      {kpi.loading ? (
        <div className="dc-empty">Loading…</div>
      ) : kpi.error ? (
        <div className="dc-empty">err</div>
      ) : data.length === 0 ? (
        <div className="dc-empty">No data</div>
      ) : (
        <div className="dc-chart-wrap">
          <DcBarChart data={data} />
        </div>
      )}
      {open && <DcModal mapped={mapped} measure={measure} setMeasure={setMeasure} onClose={() => setOpen(false)} />}
      {pie && <DcPieModal kpiId={pie.kpiId} title={pie.title} refreshKey={refreshKey} onClose={() => setPie(null)} />}
    </div>
  )
}

function CustomerTriageProcess({ triage }) {
  const steps = triage.data?.steps ?? []
  const total = triage.data?.totals?.uniqueCustomers ?? 0
  const sentimentBuckets = triage.data?.sentiment?.categories ?? triage.data?.sentiment?.statuses ?? []
  const sentimentByCustomer = {}
  for (const [c, st] of Object.entries(triage.data?.sentiment?.byCustomer ?? {})) {
    sentimentByCustomer[c] = { color: st.color, label: st.label }
  }
  for (const st of sentimentBuckets) {
    for (const c of (st.customers ?? [])) {
      if (!sentimentByCustomer[c]) sentimentByCustomer[c] = { color: st.color, label: st.label }
    }
  }
  return (
    <div className="card triage-card tile-customers">
      <div className="triage-head">
        <div>
          <div className="card-title"><GitBranch size={14} /> Customer Triage Process</div>
          <div className="muted-small">End-to-end workflow from SIFT Search to Customer Interaction</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="dcv-download dcv-download-pdf"
            onClick={() => downloadTriagePdf(triage.data)}
            disabled={!triage.data || triage.loading}
            title="Download the full Customer Triage Process as a PDF"
          >
            <Download size={13} /> Download PDF
          </button>
          <button
            className="glass-tab"
            onClick={() => window.open('?view=customers', '_blank', 'noopener,noreferrer')}
            title="Open the detailed customer view in a new tab"
          >
            <span className="glass-tab-dot" />
            <span>Detailed customer view</span>
            <span className="glass-tab-arrow">↗</span>
          </button>
          <div className="triage-stat">
            <div className="triage-num">{triage.loading ? '…' : (triage.error ? 'err' : total)}</div>
            <div className="muted-small">Total Customers in Pipeline</div>
          </div>
        </div>
      </div>
      <div className="step-grid">
        {steps.map(s => {
          const uniqueCount = s.uniqueCount ?? s.customers.length
          return (
            <div className="step-pill" key={s.name + '-pill'}>
              <div className="step-num">{s.name}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.description}</div>
              <div className="step-customers-head">
                <span>Customers</span>
                <span className="step-count">{uniqueCount}</span>
              </div>
            </div>
          )
        })}
        {steps.map(s => (
          <div className="step-customer-list" key={s.name + '-list'}>
            {s.customers.map((c, j) => {
              const sent = sentimentByCustomer[c]
              const style = sent
                ? { background: sent.color, color: '#0b0d12', borderColor: sent.color }
                : undefined
              const tip = sent ? `${c} — ${sent.label}` : c
              return (
                <div className="step-customer" key={j} title={tip} style={style}>{c}</div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// Narrative copy for the Customer Interaction Workflow. Stage counts and the
// customer lists come from triage.data.outreach.statuses (keyed by bucket
// name); this only layers on the per-stage story and the transition labels
// between meetings.
const CIW_STAGES = {
  M0:    { badge: 'ideal',     title: 'Internal Touchpoint',        desc: 'PwC onboarding with the CLIENT account team to understand sentiment and triage need.' },
  M1:    { badge: 'ideal',     title: 'Initial Customer Call',      desc: 'Walk through the eDiscovery / Analytics approach, background, and next steps.' },
  M2:    { badge: 'escalated', title: 'Confirmation with Customer', desc: 'Confirm limitations and notification requirements. Customer acknowledges expedited process limitations.' },
  M3:    { badge: 'escalated', title: 'Limited Data Extraction',    desc: 'Explain the priority analytics process, share extraction results, and stand up the customer file-sharing platform.' },
  Hold:  { badge: 'ideal',     title: 'Hold for Full Analytics',    desc: 'Held for full analytics results — not escalated.' },
  Recur: { badge: 'ideal',     title: 'Recurring Outreach',         desc: 'Ongoing customer outreach and status updates.' },
}

const CIW_MAIN_ORDER = ['M0', 'M1', 'M2', 'M3']
const CIW_TRANSITIONS = {
  'M0-M1': 'Proceed based on sentiment analysis',
  'M1-M2': 'Customer requests data immediately',
  'M2-M3': 'Customer proceeds with review',
}

// color-mix() isn't supported by html2canvas (PNG export), so derive the
// glass-card accent shades here as plain rgb()/rgba() and pass them as CSS vars.
function ciwAccentVars(accent) {
  const [r, g, b] = hexToRgb(accent) ?? [107, 114, 128]
  const mixBlack = (p) => `rgb(${Math.round(r * p)}, ${Math.round(g * p)}, ${Math.round(b * p)})`
  const mixWhite = (p) => `rgb(${Math.round(r * p + 255 * (1 - p))}, ${Math.round(g * p + 255 * (1 - p))}, ${Math.round(b * p + 255 * (1 - p))})`
  return {
    '--ciw-accent': accent || '#6b7280',
    '--ciw-accent-dark': mixBlack(0.72),
    '--ciw-accent-border': mixWhite(0.75),
    '--ciw-accent-glow': `rgba(${r}, ${g}, ${b}, 0.32)`,
  }
}

function CiwStage({ meta, status, sentimentByCustomer, furthestByCustomer }) {
  const [expanded, setExpanded] = useState(false)
  const customers = status?.customers ?? []
  const visible = expanded ? customers : customers.slice(0, 3)
  const more = customers.length - 3
  const sentOf = (c) => sentimentByCustomer?.[c]
  // "Furthest Meeting Completed" tag (e.g. "M2") shown after the customer name.
  const tagOf = (c) => furthestByCustomer?.[c] ?? ''
  const custLabel = (c) => {
    const t = tagOf(c)
    return t ? `${c} (${t})` : c
  }
  const custStyle = (c) => {
    const s = sentOf(c)
    return s ? { background: s.color, color: '#0b0d12', borderColor: s.color } : undefined
  }
  const custTip = (c) => {
    const s = sentOf(c)
    return s ? `${custLabel(c)} — ${s.label}` : custLabel(c)
  }
  return (
    <div className="ciw-stage" style={ciwAccentVars(status?.color ?? '#6b7280')}>
      <div className="ciw-stage-card">
        <div className="ciw-stage-head">
          <span className="ciw-stage-name">{status?.label ?? meta.title}</span>
          <span className={`ciw-badge ciw-badge-${meta.badge}`}>{meta.badge}</span>
        </div>
        <div className="ciw-stage-title">{meta.title}</div>
        <div className="ciw-stage-desc">{meta.desc}</div>
        <div className="ciw-stage-foot">
          <span>Customers</span>
          <span className="ciw-count">{status?.count ?? 0}</span>
        </div>
      </div>
      <div className="ciw-cust-list">
        {visible.map((c, i) => (
          <span key={i} className="ciw-cust" style={custStyle(c)} title={custTip(c)}>{custLabel(c)}</span>
        ))}
        {!expanded && more > 0 && (
          <button type="button" className="ciw-cust-more" onClick={() => setExpanded(true)}>
            +{more} more
          </button>
        )}
        {expanded && customers.length > 3 && (
          <button type="button" className="ciw-cust-more" onClick={() => setExpanded(false)}>
            show less
          </button>
        )}
        {customers.length === 0 && <span className="ciw-cust-empty">No customers</span>}
      </div>
    </div>
  )
}

function CustomerInteractionWorkflow({ triage }) {
  const [fSentiment, setFSentiment] = useState('all')
  const [fLiaison, setFLiaison] = useState('all')

  const statuses = triage.data?.outreach?.statuses?.length
    ? triage.data.outreach.statuses
    : OUTREACH_FALLBACK

  // Map each customer to its sentiment color/label so the expanded customer
  // lists can be color-coded the same way the Customer Triage Process pills are.
  const sentimentBuckets = triage.data?.sentiment?.categories ?? triage.data?.sentiment?.statuses ?? []
  const sentimentByCustomer = {}
  for (const [c, st] of Object.entries(triage.data?.sentiment?.byCustomer ?? {})) {
    sentimentByCustomer[c] = { color: st.color, label: st.label }
  }
  for (const st of sentimentBuckets) {
    for (const c of (st.customers ?? [])) {
      if (!sentimentByCustomer[c]) sentimentByCustomer[c] = { color: st.color, label: st.label }
    }
  }

  // Per-customer "Furthest Meeting Completed" tag (e.g. "M2"), shown after each
  // customer name in the workflow stages.
  const furthestByCustomer = triage.data?.furthestByCustomer ?? {}

  // Per-customer liaison lookup for the filter, from the detail rows.
  const details = triage.data?.details ?? []
  const custToLiaison = {}
  for (const d of details) {
    if (d.crmLiaison) custToLiaison[d.customer] = d.crmLiaison
  }

  // Distinct option lists for the dropdowns.
  const uniqSorted = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))
  const sentimentOptions = sentimentBuckets.map(b => b.label)
  const liaisonOptions = uniqSorted(details.map(d => d.crmLiaison))

  const passes = (c) => {
    if (fSentiment !== 'all' && (sentimentByCustomer[c]?.label ?? '') !== fSentiment) return false
    if (fLiaison !== 'all' && (custToLiaison[c] ?? '') !== fLiaison) return false
    return true
  }

  // Recompute each meeting bucket's customer list and count against the filters.
  const filtered = statuses.map(s => {
    const custs = (s.customers ?? []).filter(passes)
    return { ...s, customers: custs, count: custs.length }
  })
  const byName = Object.fromEntries(filtered.map(s => [s.name, s]))
  const countOf = (n) => byName[n]?.count ?? 0
  const ideal = countOf('M0') + countOf('M1') + countOf('Hold') + countOf('Recur')
  const escalated = countOf('M2') + countOf('M3')
  const legend = ['M0', 'M1', 'Hold', 'Recur', 'M2', 'M3']

  const filtersActive = [fSentiment, fLiaison].some(v => v !== 'all')
  const resetFilters = () => {
    setFSentiment('all'); setFLiaison('all')
  }

  const cardRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    // html2canvas mishandles CSS `zoom`, so capture at 100% then restore.
    const el = cardRef.current
    const prevZoom = el ? el.style.zoom : ''
    if (el) el.style.zoom = '1'
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#07080c',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customer-interaction-workflow-${fileStamp()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('workflow download failed', e)
    } finally {
      if (el) el.style.zoom = prevZoom
      setDownloading(false)
    }
  }

  return (
    <div className="card ciw-card tile-customers" ref={cardRef}>
      <div className="triage-head">
        <div>
          <div className="card-title"><GitBranch size={14} /> Customer Interaction Workflow</div>
          <div className="muted-small">Progression and meeting status is indicated next to the customer name using the format: Customer Name (Furthest Meeting Completed)</div>
        </div>
        <div className="ciw-totals">
          <div className="ciw-total ciw-total-ideal"><span className="ciw-total-num">{ideal}</span> Ideal</div>
          <div className="ciw-total ciw-total-escalated"><span className="ciw-total-num">{escalated}</span> Escalated</div>
          <button
            className="dcv-download dcv-download-pdf"
            onClick={handleDownload}
            disabled={downloading}
            title="Download this slide as a PNG"
            data-html2canvas-ignore="true"
          >
            <Download size={13} /> {downloading ? 'Preparing…' : 'Download PNG'}
          </button>
        </div>
      </div>

      <div className="ciw-filters">
        <span className="ciw-filters-label"><Filter size={13} /> Filters</span>
        <select className="ciw-filter" value={fSentiment} onChange={e => setFSentiment(e.target.value)}>
          <option value="all">All Sentiments</option>
          {sentimentOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="ciw-filter" value={fLiaison} onChange={e => setFLiaison(e.target.value)}>
          <option value="all">All Liaisons</option>
          {liaisonOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {filtersActive && (
          <button type="button" className="ciw-filter-clear" onClick={resetFilters}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div className="ciw-main-row">
        {CIW_MAIN_ORDER.map((name, i) => (
          <Fragment key={name}>
            <CiwStage meta={CIW_STAGES[name]} status={byName[name]} sentimentByCustomer={sentimentByCustomer} furthestByCustomer={furthestByCustomer} />
            {i < CIW_MAIN_ORDER.length - 1 && (
              <div className="ciw-conn">
                <span className="ciw-conn-label">{CIW_TRANSITIONS[`${name}-${CIW_MAIN_ORDER[i + 1]}`]}</span>
                <span className="ciw-conn-arrow">→</span>
              </div>
            )}
          </Fragment>
        ))}
      </div>

      <div className="ciw-branches">
        <div className="ciw-branch">
          <div className="ciw-vconn">
            <span className="ciw-vconn-label">No-go decision after Meeting 0</span>
            <span className="ciw-vconn-arrow">↓</span>
          </div>
          <CiwStage meta={CIW_STAGES.Hold} status={byName.Hold} sentimentByCustomer={sentimentByCustomer} furthestByCustomer={furthestByCustomer} />
        </div>
        <div className="ciw-branch">
          <div className="ciw-vconn">
            <span className="ciw-vconn-label">Satisfied after Meeting 1 — no immediate review</span>
            <span className="ciw-vconn-arrow">↓</span>
          </div>
          <CiwStage meta={CIW_STAGES.Recur} status={byName.Recur} sentimentByCustomer={sentimentByCustomer} furthestByCustomer={furthestByCustomer} />
        </div>
      </div>

      <div className="ciw-legend">
        {legend.map(n => (
          <span key={n} className="ciw-legend-item">
            <span className="ciw-legend-dot" style={{ background: byName[n]?.color ?? '#6b7280' }} />
            {byName[n]?.label ?? n}
          </span>
        ))}
      </div>
    </div>
  )
}

const OUTREACH_FALLBACK = [
  { name: 'M0',    label: 'Meeting 0',         count: 0, color: '#86efac' },
  { name: 'Hold',  label: 'On Hold',           count: 0, color: '#a855f7' },
  { name: 'M1',    label: 'Meeting 1',         count: 0, color: '#15803d' },
  { name: 'Recur', label: 'Recurring Meeting', count: 0, color: '#3b82f6' },
  { name: 'M2',    label: 'Meeting 2',         count: 0, color: '#fb7185' },
  { name: 'M3',    label: 'Meeting 3',         count: 0, color: '#dc2626' },
]

const SENTIMENT_FALLBACK = [
  { name: 'Green',  label: 'On Track',  count: 0, color: '#22c55e', customers: [] },
  { name: 'Yellow', label: 'Attention', count: 0, color: '#eab308', customers: [] },
  { name: 'Red',    label: 'At Risk',   count: 0, color: '#ef4444', customers: [] },
]

const SENT_DOT_COLOR = { Green: '#22c55e', Yellow: '#eab308', Red: '#ef4444' }

// A single customer pill, tinted by their NEW sentiment, with a hover popover
// showing name, the old→new move, and the reason for the change.
function SentChangePill({ item }) {
  const kind = String(item.to || '').toLowerCase() // green | yellow | red
  return (
    <span className={`sent-pill sent-pill-${kind}`}>
      {item.customer}
      <span className="sent-pop">
        <div className="sent-pop-name">{item.customer}</div>
        <div className="sent-pop-move">
          <span className="sent-dot" style={{ background: SENT_DOT_COLOR[item.from] }} />{item.from}
          <span className="sent-pop-arrow">→</span>
          <span className="sent-dot" style={{ background: SENT_DOT_COLOR[item.to] }} />{item.to}
        </div>
        {item.reason && (
          <>
            <div className="sent-pop-reason-label">Reason for change</div>
            <div className="sent-pop-reason">{item.reason}</div>
          </>
        )}
      </span>
    </span>
  )
}

function SentChangeRow({ icon, iconClass, label, items }) {
  if (!items?.length) return null
  return (
    <div className="sent-change-row">
      <div className="sent-change-label">
        <span className={`sent-change-arrow ${iconClass}`}>{icon}</span>
        <span>{label}</span>
        <span className="sent-change-count">{items.length}</span>
      </div>
      <div className="sent-change-pills">
        {items.map((it, i) => <SentChangePill key={`${it.customer}-${i}`} item={it} />)}
      </div>
    </div>
  )
}

function CustomerSentiment({ triage }) {
  const categories = triage.data?.sentiment?.categories?.length
    ? triage.data.sentiment.categories
    : SENTIMENT_FALLBACK
  const get = (n) => categories.find(d => d.name === n) ?? { count: 0, label: n }
  const green = get('Green')
  const yellow = get('Yellow')
  const red = get('Red')
  const total = triage.data?.sentiment?.total ?? categories.reduce((s, d) => s + (d.count ?? 0), 0)
  const cardRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadElementAsPdf(
        cardRef.current,
        'Customer Sentiment',
        'Latest sentiment from the Priority Customer Tracker',
        'customer-sentiment',
      )
    } catch (e) {
      console.error('sentiment download failed', e)
    } finally {
      setDownloading(false)
    }
  }
  return (
    <div className="card tile-customers" ref={cardRef}>
      <div className="card-head">
        <div>
          <div className="card-title"><Users size={14} /> Customer Sentiment</div>
          <div className="muted-small">Latest sentiment from the Priority Customer Tracker</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="tile-download-btn"
            onClick={handleDownload}
            disabled={downloading}
            title="Download this tile as a PDF"
            data-html2canvas-ignore="true"
          >
            <Download size={12} />
          </button>
          <span className="badge">{total}</span>
        </div>
      </div>
      <div className="sentiment-grid" style={{ flex: 1 }}>
        <div className="sentiment-tile sentiment-green" title={(green.customers ?? []).join(', ')}>
          <div className="sentiment-num">{green.count}</div>
          <div className="sentiment-label">{green.label}</div>
        </div>
        <div className="sentiment-tile sentiment-yellow" title={(yellow.customers ?? []).join(', ')}>
          <div className="sentiment-num">{yellow.count}</div>
          <div className="sentiment-label">{yellow.label}</div>
        </div>
        <div className="sentiment-tile sentiment-red" title={(red.customers ?? []).join(', ')}>
          <div className="sentiment-num">{red.count}</div>
          <div className="sentiment-label">{red.label}</div>
        </div>
      </div>
      {(() => {
        const changes = triage.data?.sentiment?.changes
        const esc = changes?.escalated ?? []
        const de = changes?.deEscalated ?? []
        if (!esc.length && !de.length) return null
        return (
          <div className="sent-changes">
            <SentChangeRow icon="↗" iconClass="up" label="Escalated" items={esc} />
            <SentChangeRow icon="↘" iconClass="down" label="De-escalated" items={de} />
          </div>
        )
      })()}
    </div>
  )
}

function CustomerOutreach({ triage }) {
  const statuses = triage.data?.outreach?.statuses?.length
    ? triage.data.outreach.statuses
    : OUTREACH_FALLBACK
  const total = triage.data?.outreach?.total ?? statuses.reduce((s, d) => s + (d.count ?? 0), 0)
  const yMax = Math.max(1, ...statuses.map(d => d.count ?? 0))
  const cardRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadElementAsPdf(
        cardRef.current,
        'Customer Outreach',
        'Customers by meeting stage',
        'customer-outreach',
      )
    } catch (e) {
      console.error('outreach download failed', e)
    } finally {
      setDownloading(false)
    }
  }
  return (
    <div className="card tile-customers" ref={cardRef}>
      <div className="card-head">
        <div>
          <div className="card-title"><Users size={14} /> Customer Outreach</div>
          <div className="muted-small">Customers by meeting stage</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="tile-download-btn"
            onClick={handleDownload}
            disabled={downloading}
            title="Download this tile as a PDF"
            data-html2canvas-ignore="true"
          >
            <Download size={12} />
          </button>
          <span className="badge">{total}</span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={statuses} margin={{ top: 12, right: 8, bottom: 0, left: -22 }} barCategoryGap={14}>
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: C.muted, fontSize: 10 }}
              allowDecimals={false}
              domain={[0, yMax + 1]}
            />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 10 }} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload
                return (
                  <div style={{
                    background: '#1f2937', border: '1px solid #374151', borderRadius: 6,
                    padding: '6px 10px', color: '#e5e7eb', fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 600 }}>{row.label}</div>
                    <div style={{ color: '#9ca3af' }}>{row.count} customer{row.count === 1 ? '' : 's'}</div>
                  </div>
                )
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {statuses.map((d, i) => <Cell key={i} fill={d.color} />)}
              <LabelList dataKey="count" position="top" fill="#e5e7eb" fontSize={11} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function MainApp() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [theme, setTheme] = useState('dark')
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date())
  const appRef = useRef(null)
  const triage = useTriage(refreshKey)
  // Auto-fit the dashboard to the viewport so every machine sees the same
  // 4-column layout the design targets, regardless of monitor size or Windows
  // display scaling (125%/150%). Without this, smaller effective widths trip
  // the responsive breakpoints and reflow the tiles, and users have to manually
  // zoom to ~80% to "see it as is". DESIGN_WIDTH is the width at and above which
  // no scaling is applied (matches a comfortable full-size view).
  useEffect(() => {
    const DESIGN_WIDTH = 1366
    const fit = () => {
      const html = document.documentElement
      // Reset before measuring so the CSS zoom never feeds back into innerWidth.
      html.style.zoom = '1'
      const z = Math.min(1, window.innerWidth / DESIGN_WIDTH)
      html.style.zoom = String(z)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('resize', fit)
      document.documentElement.style.zoom = ''
    }
  }, [])
  const handleRefresh = () => {
    setRefreshing(true)
    const key = refreshKey + 1
    setRefreshKey(key)
    setLastRefreshed(new Date())
    // Keep the Refresh spinner running until the slow materialized rebuild
    // (data-complexion) actually finishes — bumping refreshKey already triggers
    // every tile to reload with ?refresh=1; the backend dedupes the rebuild, so
    // this awaits the same CREATE OR REPLACE the data-complexion tile kicked off.
    fetch(`/api/kpi/data-complexion?refresh=1&_=${key}`)
      .catch(() => {})
      .finally(() => setRefreshing(false))
  }
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  const handleDownload = async () => {
    if (!appRef.current || downloading) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(appRef.current, {
        backgroundColor: theme === 'light' ? '#f4f5f7' : '#07080c',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `project-mosaic-${fileStamp()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('download failed', e)
    } finally {
      setDownloading(false)
    }
  }
  return (
    <RefreshContext.Provider value={refreshKey}>
    <div className={`app ${theme}`} ref={appRef}>
      <Header
        onRefresh={handleRefresh} refreshing={refreshing}
        theme={theme} onToggleTheme={toggleTheme}
        onDownload={handleDownload} downloading={downloading}
        lastRefreshed={lastRefreshed}
      />
      <main className="main">
        <ExecSection />
      </main>
    </div>
    </RefreshContext.Provider>
  )
}

// Consolidated full page with every customer-related section, opened from the
// "All customer pages" tile.
function CustomerAllPage() {
  const triage = useTriage(0)
  return (
    <div className="app dark" style={{ minHeight: '100vh', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div className="card-title"><Users size={16} /> Customers — Full View</div>
        <button className="icon-btn" onClick={() => window.close()} aria-label="Close tab" title="Close tab"><X size={16} /></button>
      </div>
      <CustomerSentiment triage={triage} />
      <div className="grid-bottom">
        <CustomerTriageProcess triage={triage} />
        <CustomerOutreach triage={triage} />
      </div>
      <CustomerInteractionWorkflow triage={triage} />
    </div>
  )
}

export default function App() {
  const view = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('view')
    : null
  if (view === 'customers') {
    return (
      <RefreshContext.Provider value={0}>
        <div className="app dark"><DetailedCustomerView /></div>
      </RefreshContext.Provider>
    )
  }
  if (view === 'exfil') {
    return (
      <RefreshContext.Provider value={0}>
        <div className="app dark"><ExfilWaterfallPage /></div>
      </RefreshContext.Provider>
    )
  }
  if (view === 'complexion') {
    return (
      <RefreshContext.Provider value={0}>
        <div className="app dark dc-standalone">
          <DataComplexion refreshKey={0} />
        </div>
      </RefreshContext.Provider>
    )
  }
  if (view === 'customer-all') {
    return (
      <RefreshContext.Provider value={0}>
        <CustomerAllPage />
      </RefreshContext.Provider>
    )
  }
  // Waterfall view disabled — keep code below for future re-enable.
  // if (view === 'waterfall') {
  //   return (
  //     <RefreshContext.Provider value={0}>
  //       <div className="app dark"><WaterfallPage /></div>
  //     </RefreshContext.Provider>
  //   )
  // }
  return <MainApp />
}
