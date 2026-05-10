import { useEffect, useState } from 'react'
import { Sun, Moon, RefreshCw, Download, FileText, Database, Users, GitBranch } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import './App.css'

function formatCompact(n) {
  if (n == null) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
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

function Header({ onRefresh, refreshing, theme, onToggleTheme }) {
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
        <button className="icon-btn"><Download size={16} /></button>
      </div>
    </header>
  )
}

function FilePreservation() {
  return (
    <div className="card preservation">
      <div className="preservation-left">
        <div className="card-title"><FileText size={14} /> File Preservation</div>
        <div className="muted-small">Overall preservation status across all data sources</div>
      </div>
      <div className="preservation-stats">
        <div className="ps-stat">
          <div className="ps-num green">65%</div>
          <div className="ps-label">Preservation Complete</div>
        </div>
        <div className="ps-stat">
          <div className="ps-num">200M</div>
          <div className="ps-label">Total Exfil Files <span className="delta-up">+1.5M</span></div>
        </div>
        <div className="ps-stat">
          <div className="ps-num purple">304.0M</div>
          <div className="ps-label">Decompressed Files</div>
        </div>
      </div>
    </div>
  )
}

function FileProfiling({ refreshKey }) {
  const totalSift = useKpi('total-sift-objects', refreshKey)
  const bars = [
    { label: 'TOTAL SIFT OBJECTS', value: 100, display: totalSift.loading ? '…' : (totalSift.error ? 'err' : formatCompact(totalSift.value)), delta: '+1.5M', sub: 'Compressed: 20M', color: C.purple },
    { label: 'Duplicates', value: 32, display: '-58M', delta: '+245K', color: C.pink },
    { label: 'Exclusions', value: 18, display: '-25M', delta: '+20K', color: C.orange },
    { label: 'Files for Harv...', value: 55, display: '101M', delta: '+1.1M', color: C.green },
  ]
  const dist = [
    { label: 'Structured', pct: 27, color: C.purple },
    { label: 'Semi-Structured', pct: 24, color: C.blue },
    { label: 'Unstructured', pct: 36, color: C.teal },
    { label: 'For Further Analysis', pct: 13, color: C.orange },
  ]
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><FileText size={14} /> File Profiling</div>
      </div>
      <div className="profiling-bars">
        {bars.map(b => (
          <div key={b.label} className="pb-row">
            <div className="pb-top">
              <span className="pb-label">{b.label}</span>
              <span className="pb-val">{b.display}</span>
            </div>
            <div className="pb-track">
              <div className="pb-fill" style={{ width: `${b.value}%`, background: b.color }} />
            </div>
            <div className="pb-bot">
              {b.sub && <span className="muted-small">{b.sub}</span>}
              <span className="delta-up">{b.delta}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="dist-section">
        <div className="dist-head">
          <span className="dist-title">FILE DISTRIBUTION</span>
          <span className="muted-small">of 101M files for harvesting</span>
        </div>
        <div className="dist-bar">
          {dist.map(d => (
            <div key={d.label} style={{ width: `${d.pct}%`, background: d.color }} />
          ))}
        </div>
        <div className="dist-legend">
          {dist.map(d => (
            <div key={d.label} className="dl-row">
              <span className="legend-dot" style={{ background: d.color }} />
              <span className="dl-label">{d.label}</span>
              <span className="dl-val">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FileHarvesting() {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><Database size={14} /> File Harvesting</div>
        <span className="badge">1% Complete</span>
      </div>
      <div className="harv-bar-wrap">
        <div className="harv-bar">
          <div className="harv-bar-green" style={{ width: '30%' }} />
          <div className="harv-bar-orange" style={{ width: '48%' }} />
        </div>
        <div className="harv-bar-axis">
          <span>0</span>
          <span>101M files for harvesting</span>
        </div>
      </div>
      <div className="harv-stats">
        <div className="harv-stat">
          <div className="harv-num green">30.0M</div>
          <div className="muted-small">Files Processed <span className="delta-up">+375K</span></div>
        </div>
        <div className="harv-stat">
          <div className="harv-num orange">48.0M</div>
          <div className="muted-small">Pending Preservation <span className="delta-up">+312K</span></div>
        </div>
      </div>
      <div className="harv-total">
        <div className="harv-num xl">3.5B</div>
        <div className="muted-small">Raw Records</div>
      </div>
    </div>
  )
}

function DataComplexion() {
  const data = [
    { name: 'PHI', v: 1.28, color: C.purple },
    { name: 'PII', v: 0.96, color: C.purpleLight },
    { name: 'PCI', v: 0.60, color: C.green },
    { name: 'Secrets', v: 0.30, color: C.blue },
    { name: 'Internal Only', v: 0.20, color: C.orange },
    { name: 'Other', v: 0.10, color: C.gray },
  ]
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><Database size={14} /> Data Complexion</div>
        <span className="badge">3.5B Raw Records</span>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ top: 10, right: 0, bottom: 0, left: -20 }} barCategoryGap={10}>
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: C.muted, fontSize: 10 }}
            ticks={[0.06, 0.30, 0.60, 0.96, 1.28]}
            domain={[0, 1.4]}
          />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 10 }} />
          <Bar dataKey="v" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CustomerAttribution() {
  const data = [
    { name: 'Single Attributed', value: 70, color: C.green },
    { name: 'Not Attributed', value: 30, color: C.gray },
  ]
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><Users size={14} /> Customer Attribution</div>
        <span className="badge">30M Files</span>
      </div>
      <div className="attr-num-wrap">
        <div className="attr-num">45</div>
        <div className="muted-small">Total Customers</div>
      </div>
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={42} outerRadius={62} startAngle={90} endAngle={-270}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="attr-legend">
        <div className="dl-row">
          <span className="legend-dot" style={{ background: C.green }} />
          <span className="dl-label">Single Attributed</span>
          <span className="dl-val">70%</span>
        </div>
        <div className="dl-row">
          <span className="legend-dot" style={{ background: C.gray }} />
          <span className="dl-label">Not Attributed</span>
          <span className="dl-val">30%</span>
        </div>
      </div>
    </div>
  )
}

function CustomerTriageProcess() {
  const steps = [
    { name: 'Step 1' }, { name: 'Step 2' }, { name: 'Step 3' }, { name: 'Step 4' },
  ]
  return (
    <div className="card triage-card">
      <div className="triage-head">
        <div>
          <div className="card-title"><GitBranch size={14} /> Customer Triage Process</div>
          <div className="muted-small">End-to-end workflow from SIFT Search to Customer Interaction</div>
        </div>
        <div className="triage-stat">
          <div className="triage-num">45</div>
          <div className="muted-small">Total Customers in Pipeline</div>
        </div>
      </div>
      <div className="step-grid">
        {steps.map(s => (
          <div className="step-pill" key={s.name}>{s.name}</div>
        ))}
      </div>
    </div>
  )
}

function CustomerOutreach() {
  const data = [
    { name: '1', v: 8, color: C.coral },
    { name: '2', v: 12, color: '#dc2626' },
    { name: '3', v: 6, color: C.coral },
    { name: '4', v: 10, color: '#dc2626' },
    { name: '5', v: 7, color: C.coral },
  ]
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title"><Users size={14} /> Customer Outreach</div>
          <div className="muted-small">Customers by meeting stage</div>
        </div>
        <span className="badge">15</span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 10, right: 0, bottom: 0, left: -30 }}>
          <YAxis hide domain={[0, 14]} />
          <XAxis hide />
          <Bar dataKey="v" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [theme, setTheme] = useState('dark')
  const handleRefresh = () => {
    setRefreshing(true)
    setRefreshKey(k => k + 1)
    setTimeout(() => setRefreshing(false), 800)
  }
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  return (
    <div className={`app ${theme}`}>
      <Header onRefresh={handleRefresh} refreshing={refreshing} theme={theme} onToggleTheme={toggleTheme} />
      <main className="main">
        <FilePreservation />
        <div className="grid-4">
          <FileProfiling refreshKey={refreshKey} />
          <FileHarvesting />
          <DataComplexion />
          <CustomerAttribution />
        </div>
        <div className="grid-bottom">
          <CustomerTriageProcess />
          <CustomerOutreach />
        </div>
      </main>
    </div>
  )
}
