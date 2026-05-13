import { useEffect, useRef, useState, createContext, useContext } from 'react'
import { Sun, Moon, RefreshCw, Download, FileText, Database, Users, GitBranch, X } from 'lucide-react'
import html2canvas from 'html2canvas'
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
    value: profiling.value?.['Total Files'] ?? null,
    loading: profiling.loading,
    error: profiling.error,
  }
  const preservationFiles = useKpi('preservation-files', refreshKey)
  const preservationPct = (totalExfil.value && preservationFiles.value != null)
    ? Math.min(100, (preservationFiles.value / totalExfil.value) * 100)
    : null
  const pctDisplay = totalExfil.loading || preservationFiles.loading
    ? '…'
    : (totalExfil.error || preservationFiles.error || preservationPct == null)
      ? 'err'
      : `${preservationPct.toFixed(0)}%`
  return (
    <div className="card preservation">
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, justifyContent: 'center' }}>
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
          </div>
        )
      })}
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
  const totalFiles = mk('Total Files')
  const barRows = [
    { label: 'Total Files',          kpi: totalFiles,                 color: '#5b21b6' },
    { label: 'Files Not Found in TI', kpi: mk('Deleted In TI'),        color: '#6b7280' },
    { label: 'Duplicates',           kpi: mk('Duplicates'),           color: '#f59e0b' },
    { label: 'Exclusions',           kpi: mk('Exclusions'),           color: '#fb7185' },
    { label: 'Files For Harvesting', kpi: mk('Files For Harvesting'), color: '#22c55e' },
    { label: 'Pending Preservation', kpi: mk('Pending Preservation'), color: '#d946ef' },
  ]

  const distKpi = useKpi('file-distribution', refreshKey)
  const distRows = Array.isArray(distKpi.value) ? distKpi.value : []
  const distMap = Object.fromEntries(distRows.map(r => [r.name, r.value]))
  const distTotal = distRows.reduce((s, r) => s + (Number(r.value) || 0), 0)
  const distPct = (n) => distTotal > 0 ? (n || 0) / distTotal * 100 : 0
  const dist = [
    { label: 'Structured',     pct: distPct(distMap['Structured']),     color: C.purple },
    { label: 'Semi-Structured', pct: distPct(distMap['Semi-Structured']), color: C.blue },
    { label: 'Unstructured',   pct: distPct(distMap['Unstructured']),   color: C.teal },
    { label: 'System / Other', pct: distPct(distMap['System / Other']), color: C.orange },
  ]

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><FileText size={14} /> File Profiling</div>
        <button
          onClick={() => window.open('?view=waterfall', '_blank', 'noopener,noreferrer')}
          style={{
            background: 'transparent', border: '1px solid #374151',
            color: '#fbbf24', borderRadius: 6, padding: '3px 10px',
            fontSize: 11, cursor: 'pointer',
          }}
          title="Open waterfall in a new tab"
        >
          Click here for waterfall ↗
        </button>
      </div>
      <BurndownBars rows={barRows} max={totalFiles.value} />
      <div className="dist-section">
        <div className="dist-head">
          <span className="dist-title">FILE DISTRIBUTION</span>
          <span className="muted-small">
            {distKpi.loading ? 'loading…' : distKpi.error ? 'error' : `of ${formatCompact(distTotal)} files`}
          </span>
        </div>
        <div className="dist-bar">
          {dist.map(d => (
            <div key={d.label} style={{ width: `${Math.max(1, d.pct)}%`, background: d.color }} />
          ))}
        </div>
        <div className="dist-legend">
          {dist.map(d => (
            <div key={d.label} className="dl-row">
              <span className="legend-dot" style={{ background: d.color }} />
              <span className="dl-label">{d.label}</span>
              <span className="dl-val">
                {distKpi.loading ? '…' : distKpi.error ? 'err' : `${d.pct.toFixed(0)}%`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FileHarvesting({ refreshKey }) {
  const processed = useKpi('bq-files', refreshKey)
  const total = useKpi('pending-extraction', refreshKey)
  const gcsFiles = useKpi('gcs-files', refreshKey)
  const rawRecords = useKpi('raw-records', refreshKey)
  const profiling = useKpi('file-profiling', refreshKey)
  const pendingPreservation = {
    value: profiling.value?.['Pending Preservation'] ?? null,
    loading: profiling.loading,
    error: profiling.error,
  }

  const processedVal = 530489
  const pendingPresVal = pendingPreservation.value ?? 0
  const ready = !pendingPreservation.loading && !pendingPreservation.error
  const completePct = pendingPresVal > 0 ? Math.min(100, (processedVal / pendingPresVal) * 100) : 0
  const processedPct = pendingPresVal > 0 ? Math.min(100, Math.max(0.5, (processedVal / pendingPresVal) * 100)) : 0
  const remainingPct = Math.max(0, 100 - processedPct)
  const remainingVal = Math.max(0, pendingPresVal - processedVal)

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><Database size={14} /> File Harvesting</div>
        <span className="badge">{ready ? `${completePct.toFixed(2)}% Complete` : '…'}</span>
      </div>
      <div className="harv-bar-wrap">
        <div className="harv-bar">
          <div
            className="harv-bar-green"
            style={{ width: `${processedPct}%` }}
            title={ready ? `Files Processed: ${processedVal.toLocaleString()} (${completePct.toFixed(2)}% of Pending Preservation)` : 'Loading…'}
          />
          <div
            className="harv-bar-orange"
            style={{ width: `${remainingPct}%` }}
            title={ready ? `Remaining: ${remainingVal.toLocaleString()} (${(100 - completePct).toFixed(2)}%)` : 'Loading…'}
          />
        </div>
        <div className="harv-bar-axis">
          <span>0</span>
          <span><KpiValue kpi={pendingPreservation} /></span>
        </div>
      </div>
      <div className="harv-stats">
        <div className="harv-stat">
          <div className="harv-num green"><CountUp value={530489} /></div>
          <div className="muted-small">Files Processed</div>
        </div>
        <div className="harv-stat" style={{ textAlign: 'right' }}>
          <div className="harv-num orange"><KpiValue kpi={pendingPreservation} /></div>
          <div className="muted-small">Pending Preservation</div>
        </div>
      </div>
      <div className="harv-total">
        <div className="harv-num xl"><CountUp value={24657166} /></div>
        <div className="muted-small">Raw Records</div>
      </div>
    </div>
  )
}

function CustomerAttribution() {
  const singleAttributed = 0
  const notAttributed = 0
  const total = singleAttributed + notAttributed
  const data = total > 0
    ? [
        { name: 'Single Attributed', value: singleAttributed, color: C.green },
        { name: 'Not Attributed', value: notAttributed, color: C.gray },
      ]
    : [{ name: 'No data', value: 1, color: 'rgba(255,255,255,0.08)' }]
  const pct = (v) => total > 0 ? `${Math.round((v / total) * 100)}%` : '0%'
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><Users size={14} /> Customer Attribution</div>
        <span className="badge">0 Files</span>
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
          <div className="attr-num">0</div>
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
    <div className="card">
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

function CustomerTriageProcess({ triage }) {
  const steps = triage.data?.steps ?? []
  const step1 = steps[0]?.customers ?? []
  const total = step1.length
  const outreachStatuses = triage.data?.outreach?.statuses ?? []
  const outreachByCustomer = {}
  for (const st of outreachStatuses) {
    for (const c of (st.customers ?? [])) {
      outreachByCustomer[c] = { color: st.color, label: st.label }
    }
  }
  return (
    <div className="card triage-card">
      <div className="triage-head">
        <div>
          <div className="card-title"><GitBranch size={14} /> Customer Triage Process</div>
          <div className="muted-small">End-to-end workflow from SIFT Search to Customer Interaction</div>
        </div>
        <div className="triage-stat">
          <div className="triage-num">{triage.loading ? '…' : (triage.error ? 'err' : total)}</div>
          <div className="muted-small">Total Customers in Pipeline</div>
        </div>
      </div>
      <div className="step-grid">
        {steps.map(s => (
          <div className="step-col" key={s.name}>
            <div className="step-pill">
              <div className="step-num">{s.name}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.description}</div>
              <div className="step-customers-head">
                <span>Customers</span>
                <span className="step-count">{s.customers.length}</span>
              </div>
            </div>
            <div className="step-customer-list">
              {s.customers.map((c, j) => {
                const status = s.name === 'Step 5' ? outreachByCustomer[c] : null
                const style = status
                  ? { background: status.color, color: '#0b0d12', borderColor: status.color }
                  : undefined
                const tip = status ? `${c} — ${status.label}` : c
                return (
                  <div className="step-customer" key={j} title={tip} style={style}>{c}</div>
                )
              })}
            </div>
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

function CustomerSentiment({ triage }) {
  const statuses = triage.data?.outreach?.statuses?.length
    ? triage.data.outreach.statuses
    : OUTREACH_FALLBACK
  const get = (n) => statuses.find(d => d.name === n)?.count ?? 0
  const unknown = get('M0') + get('Hold')
  const ideal = get('M1') + get('Recur')
  const escalated = get('M2') + get('M3')
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title"><Users size={14} /> Customer Sentiment</div>
          <div className="muted-small">Aggregated meeting outcomes</div>
        </div>
      </div>
      <div className="sentiment-grid" style={{ flex: 1 }}>
        <div className="sentiment-tile sentiment-unknown">
          <div className="sentiment-num">{unknown}</div>
          <div className="sentiment-label">Unknown</div>
        </div>
        <div className="sentiment-tile sentiment-ideal">
          <div className="sentiment-num">{ideal}</div>
          <div className="sentiment-label">Ideal</div>
        </div>
        <div className="sentiment-tile sentiment-escalated">
          <div className="sentiment-num">{escalated}</div>
          <div className="sentiment-label">Escalated</div>
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
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title"><Users size={14} /> Customer Outreach</div>
          <div className="muted-small">Customers by meeting stage</div>
        </div>
        <span className="badge">{total}</span>
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
      a.download = `project-mosaic-${new Date().toISOString().slice(0, 10)}.png`
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
  if (view === 'waterfall') {
    return (
      <RefreshContext.Provider value={0}>
        <div className="app dark"><WaterfallPage /></div>
      </RefreshContext.Provider>
    )
  }
  return <MainApp />
}
