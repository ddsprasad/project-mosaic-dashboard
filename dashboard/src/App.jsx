import { useEffect, useRef, useState, createContext, useContext } from 'react'
import { Sun, Moon, RefreshCw, Download, FileText, Database, Users, GitBranch, X } from 'lucide-react'
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
  const totalExfil = {
    value: 226400000,
    loading: false,
    error: null,
  }
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
        <div className="ps-stat">
          <div className="ps-num"><KpiValue kpi={totalExfil} /></div>
          <div className="ps-label">Total Exfil Files</div>
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
  { test: /^meeting\s*0$/i, label: 'M0 - Internal', bg: '#374151', fg: '#e5e7eb' },
  { test: /\bhold\b/i,        label: 'On Hold',      bg: '#4b5563', fg: '#e5e7eb' },
  { test: /^meeting\s*1$/i, label: 'M1 - Initial', bg: '#8b5cf6', fg: '#fff' },
  { test: /recurring/i,       label: 'Recurring',    bg: '#3b82f6', fg: '#0b0d12' },
  { test: /^meeting\s*2$/i, label: 'M2 - Confirm', bg: '#f9a8d4', fg: '#0b0d12' },
  { test: /^meeting\s*3$/i, label: 'M3 - Extract', bg: '#c026d3', fg: '#fff' },
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
      r.reattributedFiles != null ? `${r.reattributedFiles.toLocaleString()} reattr` : '— reattr',
      r.extractedFiles != null ? `${r.extractedFiles.toLocaleString()} extracted` : '— extracted',
    ].join('\n'),
    outreachChip(r.outreachStatus)?.label ?? '—',
    r.crmLiaison || '—',
  ])

  autoTable(pdf, {
    startY: 72,
    head: [['Customer', 'Request Date', 'Days Active', 'Sentiment', 'Analytics Step', 'Files', 'Meeting', 'CRM Liaison']],
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
      0: { cellWidth: 110, fontStyle: 'bold' },
      1: { cellWidth: 70 },
      2: { cellWidth: 60 },
      3: { cellWidth: 60 },
      4: { cellWidth: 80 },
      5: { cellWidth: 110 },
      6: { cellWidth: 70 },
      7: { cellWidth: 'auto' },
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
  const sentimentByCustomer = {}
  for (const st of (triageData?.sentiment?.categories ?? [])) {
    for (const c of (st.customers ?? [])) sentimentByCustomer[c] = st
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

function DetailedCustomerView() {
  const triage = useTriage(0)
  const allRows = triage.data?.details ?? []
  const [downloading, setDownloading] = useState(false)
  const [query, setQuery] = useState('')
  // Customer-name sort direction: null = default priority sort, 'asc' = A→Z,
  // 'desc' = Z→A. The Customer column header cycles through these.
  const [nameSort, setNameSort] = useState(null)
  const cycleNameSort = () => {
    setNameSort(d => (d === null ? 'asc' : d === 'asc' ? 'desc' : null))
  }
  const q = query.trim().toLowerCase()
  const filtered = q
    ? allRows.filter(r =>
        (r.customer || '').toLowerCase().includes(q) ||
        (r.crmLiaison || '').toLowerCase().includes(q)
      )
    : allRows
  const byName = (a, b) =>
    (a.customer || '').localeCompare(b.customer || '', undefined, { sensitivity: 'base' })
  const byPriority = (a, b) => {
    const pa = a.priorityOrder == null ? Infinity : a.priorityOrder
    const pb = b.priorityOrder == null ? Infinity : b.priorityOrder
    if (pa !== pb) return pa - pb
    return byName(a, b)
  }
  const cmp = nameSort === 'asc'
    ? byName
    : nameSort === 'desc'
      ? (a, b) => byName(b, a)
      : byPriority
  const rows = [...filtered].sort(cmp)
  if (triage.loading) {
    return <div className="dcv-shell"><div className="dcv-muted" style={{ padding: 24 }}>Loading…</div></div>
  }
  if (triage.error) {
    return <div className="dcv-shell"><div style={{ padding: 24, color: '#ef4444' }}>Error: {triage.error}</div></div>
  }
  const headers = [
    'Customer', 'Request Date', 'Days Active', 'Sentiment',
    'Analytics Current step', 'Files', 'Meeting Status', 'CRM Liaison', '',
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
              {q ? `${rows.length} of ${allRows.length}` : `${rows.length} customers`}
            </span>
            {triage.data?.totals?.meeting0Count != null && (
              <span className="dcv-count" title="Customers with a Date of Meeting 0 in the Priority Customer Tracker">
                # of Meeting 0&apos;s: {triage.data.totals.meeting0Count}
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
              <tr>{headers.map(h => (
                h === 'Customer' ? (
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
                ) : (
                  <th key={h}>{h}</th>
                )
              ))}</tr>
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
                    <td className="dcv-muted" style={{ whiteSpace: 'nowrap' }}>
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
                        <span className="dcv-files-num dim">{r.reattributedFiles != null ? r.reattributedFiles.toLocaleString() : '—'}</span>
                        <span className="dcv-files-label">reattr</span>
                        <span className="dcv-files-num dim">{r.extractedFiles != null ? r.extractedFiles.toLocaleString() : '—'}</span>
                        <span className="dcv-files-label">extracted</span>
                      </div>
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
                    <td className="dcv-dash" style={{ textAlign: 'right' }}>⋯</td>
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
  const exclusionsKpi = mk('Exclusions')
  const potentialExclusionsKpi = mk('Potential Exclusions')
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
  const exc = profiling.value?.['Exclusions']
  const potExc = profiling.value?.['Potential Exclusions']
  const pendingHarvesting = {
    value: (dup != null && exc != null && potExc != null)
      ? PRESERVATION_FILES - dup - exc - potExc
      : null,
    loading: profiling.loading,
    error: profiling.error,
  }

  const processedVal = 1321462
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
        <div className="harv-num xl"><CountUp value={120975260} /></div>
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

function DataComplexion() {
  return (
    <div className="card tile-files">
      <div className="card-head">
        <div className="card-title"><Database size={14} /> Data Complexion</div>
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#6b7280', fontSize: 12,
      }}>
        No data
      </div>
    </div>
  )
}

const STEP_CUSTOMER_OVERRIDES = {
  'Step 1': ['Nvidia AI'],
}

function CustomerTriageProcess({ triage }) {
  const rawSteps = triage.data?.steps ?? []
  const steps = rawSteps.map(s => {
    const extras = (STEP_CUSTOMER_OVERRIDES[s.name] ?? []).filter(c => !s.customers.includes(c))
    return extras.length ? { ...s, customers: [...s.customers, ...extras] } : s
  })
  const total = triage.data?.totals?.uniqueCustomers ?? 0
  const sentimentBuckets = triage.data?.sentiment?.categories ?? triage.data?.sentiment?.statuses ?? []
  const sentimentByCustomer = {}
  for (const st of sentimentBuckets) {
    for (const c of (st.customers ?? [])) {
      sentimentByCustomer[c] = { color: st.color, label: st.label }
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

const OUTREACH_FALLBACK = [
  { name: 'M0',    label: 'Meeting 0',         count: 0, color: '#9ca3af' },
  { name: 'Hold',  label: 'On Hold',           count: 0, color: '#6b7280' },
  { name: 'M1',    label: 'Meeting 1',         count: 0, color: '#22c55e' },
  { name: 'Recur', label: 'Recurring Meeting', count: 0, color: '#3b82f6' },
  { name: 'M2',    label: 'Meeting 2',         count: 0, color: '#fb7185' },
  { name: 'M3',    label: 'Meeting 3',         count: 0, color: '#dc2626' },
]

const SENTIMENT_FALLBACK = [
  { name: 'Green',  label: 'On Track',  count: 0, color: '#22c55e', customers: [] },
  { name: 'Yellow', label: 'Attention', count: 0, color: '#eab308', customers: [] },
  { name: 'Red',    label: 'At Risk',   count: 0, color: '#ef4444', customers: [] },
]

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
  const handleRefresh = () => {
    setRefreshing(true)
    setRefreshKey(k => k + 1)
    setLastRefreshed(new Date())
    setTimeout(() => setRefreshing(false), 800)
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
        <FilePreservation refreshKey={refreshKey} />
        <div className="grid-4">
          <FileProfiling refreshKey={refreshKey} />
          <FileHarvesting refreshKey={refreshKey} />
          <CustomerAttribution />
          <DataComplexion />
        </div>
        <div className="grid-bottom">
          <CustomerTriageProcess triage={triage} />
          <div className="grid-bottom-right">
            <CustomerSentiment triage={triage} />
            <CustomerOutreach triage={triage} />
          </div>
        </div>
      </main>
    </div>
    </RefreshContext.Provider>
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
