// Data Complexion tile (ported from the dashboard) — PII element-combination
// breakdown with a unique/total toggle, a "View all" modal, and Person ID Type
// / Record Type pie pop-ups. Shared so both apps can render it.
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList,
  PieChart, Pie,
} from 'recharts'
import { Database, PieChart as PieChartIcon, X } from 'lucide-react'
import { useKpi } from './hooks.js'
import { formatCompact } from './format.js'
import './data-complexion.css'

const C = { text: '#e5e7eb' }
const DC_TOP_N = 15

// Teal/cyan gradient by magnitude (deep teal = largest).
const dcMix = (t) => {
  const lo = [165, 243, 252], hi = [13, 148, 136]
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
  const grand = out.reduce((s, d) => s + d[key], 0) || 1
  return out.map(d => ({
    ...d,
    name: d.fullName,
    value: d[key],
    pct: (d[key] / grand) * 100,
    fill: d.isOther ? '#4b5563' : dcMix(d[key] / max),
  }))
}

function dcPct(p) {
  if (p >= 10) return `${Math.round(p)}%`
  if (p >= 1) return `${p.toFixed(1)}%`
  if (p >= 0.1) return `${p.toFixed(1)}%`
  return '<0.1%'
}

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

function DcBarChart({ data, labelChars = 26, yWidth = 180, fontSize = 10 }) {
  const tick = ({ x, y, payload }) => {
    const label = String(payload.value)
    const lines = dcWrapLabel(label, labelChars)
    const lh = fontSize + 3
    const startDy = -((lines.length - 1) * lh) / 2 + 4
    return (
      <text x={x} y={y} textAnchor="end" fill={C.text} fontSize={fontSize} fontWeight={700}>
        {lines.map((ln, i) => (
          <tspan key={i} x={x} dy={i === 0 ? startDy : lh}>{i < lines.length - 1 ? `${ln} +` : ln}</tspan>
        ))}
      </text>
    )
  }
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

function DcPieModal({ kpiId, title, refreshKey, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const kpi = useKpi(kpiId, refreshKey)
  const rows = Array.isArray(kpi.value) ? kpi.value : []
  const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0)
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

export function DataComplexion({ refreshKey = 0 }) {
  const kpi = useKpi('data-complexion', refreshKey)
  const [measure, setMeasure] = useState('total')
  const [open, setOpen] = useState(false)
  const [pie, setPie] = useState(null)
  const rows = Array.isArray(kpi.value) ? kpi.value : []
  const mapped = dcMapRows(rows)
  const data = dcChartData(mapped, measure, DC_TOP_N)
  return (
    <div className="card tile-files tile-complexion" style={{ flex: 1, minHeight: 0 }}>
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
