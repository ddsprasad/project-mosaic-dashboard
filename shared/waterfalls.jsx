// Reusable "decomposition" visuals for the executive report. Each takes a
// `floor` (the total) and a set of parts that sum back to it, rendered in the
// shape that best fits the data:
//   - HierarchyWaterfall : proportional segmented breakdown (+ optional sub-level)
//   - BridgeWaterfall    : classic waterfall/bridge (start total, subtract, end)
//   - Funnel             : narrowing stage funnel
//
// All are dark-themed and self-contained (inline styles) so they drop into any
// app without extra CSS. Values use compact magnitude with the exact count on hover.
import { useState, useRef } from 'react'
import { formatCompact, formatFull } from './format.js'

// Bright, colorful per-segment palette (Canva-style funnel).
const PALETTE = ['#14b8a6', '#7c3aed', '#ef4444', '#eab308', '#22c55e', '#a855f7', '#ec4899']
const BAR_TOTAL = '#3b1a63'   // total/floor bars (bridge start, hierarchy floor)
const BAR_DELTA = '#ef4444'   // subtracted steps in the bridge (red)
const BAR_RESULT = '#16a34a'  // bridge end result
const pct = (v, total) => (total > 0 ? Math.max(0, (v / total) * 100) : 0)
const Val = ({ v }) => <span title={formatFull(v)}>{formatCompact(v)}</span>

// Lighten (amt>0) / darken (amt<0) a #rrggbb hex by an absolute amount.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const clamp = (c) => Math.max(0, Math.min(255, Math.round(c + amt * 255)))
  const r = clamp((n >> 16) & 255), g = clamp((n >> 8) & 255), b = clamp(n & 255)
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

// ---- Hierarchy: floor bar -> proportional segments (-> optional sub-row) ----
export function HierarchyWaterfall({ floor, segments = [] }) {
  const total = floor?.value || segments.reduce((s, x) => s + (x.value || 0), 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        background: BAR_TOTAL, color: '#fff', borderRadius: 8, padding: '14px 16px',
        textAlign: 'center', fontWeight: 700,
      }}>
        <div style={{ fontSize: 22 }}><Val v={total} /></div>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>{floor?.label ?? 'Total'}</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${pct(s.value, total)}%`, minWidth: 70, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              background: s.color || PALETTE[i % PALETTE.length], color: '#fff',
              borderRadius: 8, padding: '12px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}><Val v={s.value} /></div>
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.92 }}>{s.label}</div>
            </div>
            {Array.isArray(s.sub) && s.sub.length > 0 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {s.sub.map((c, j) => (
                  <div key={j} title={`${c.label}: ${formatFull(c.value)}`} style={{
                    width: `${pct(c.value, s.value)}%`, minWidth: 32,
                    background: c.color || 'rgba(255,255,255,0.10)', color: '#e5e7eb',
                    borderRadius: 6, padding: '8px 4px', textAlign: 'center',
                    fontSize: 10, fontWeight: 600,
                  }}>
                    <div><Val v={c.value} /></div>
                    <div style={{ opacity: 0.85 }}>{c.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Bridge: start at floor, each step subtracts, ends at the remainder ----
export function BridgeWaterfall({ floor, steps = [], endLabel = 'Remaining', endFill = BAR_RESULT, tail = [] }) {
  const start = floor?.value || 0
  const H = 240
  let running = start
  const cols = [{ label: floor?.label ?? 'Total', base: 0, top: start, fill: BAR_TOTAL, value: start }]
  for (const st of steps) {
    const top = running
    running = Math.max(0, running - (st.value || 0))
    cols.push({ label: st.label, base: running, top, fill: BAR_DELTA, value: st.value, delta: true })
  }
  cols.push({ label: endLabel, base: 0, top: running, fill: endFill, value: running })
  // Extra standalone bars after the result (e.g. Files Processed).
  for (const tb of tail) {
    cols.push({ label: tb.label, base: 0, top: tb.value || 0, fill: tb.fill || '#0d9488', value: tb.value })
  }
  const max = start || 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: H + 44, paddingTop: 4 }}>
      {cols.map((c, i) => {
        const h = ((c.top - c.base) / max) * H
        const bottom = (c.base / max) * H
        return (
          <div key={i} style={{ flex: 1, height: '100%', position: 'relative', textAlign: 'center' }}>
            <div style={{
              position: 'absolute', bottom: bottom + h + 18, left: 0, right: 0,
              fontSize: 12, fontWeight: 700, color: '#e5e7eb',
            }}>{c.delta ? '(−' : ''}<Val v={c.value} />{c.delta ? ')' : ''}</div>
            <div title={`${c.label}: ${formatFull(c.value)}`} style={{
              position: 'absolute', bottom: bottom + 18, left: '14%', right: '14%',
              height: Math.max(2, h), background: c.fill, borderRadius: 4,
            }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 11, fontWeight: 700, color: '#cbd5e1' }}>{c.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ---- CenterFunnel: centered horizontal bars, width proportional to value,
// decreasing top→bottom (classic bar-funnel). Label on the left, value inside. ----
export function CenterFunnel({ floor, stages = [] }) {
  const items = floor ? [{ label: floor.label, value: floor.value }, ...stages] : stages
  const max = items.reduce((m, s) => Math.max(m, s.value || 0), 0) || 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      {items.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 160, textAlign: 'right', fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>{s.label}</div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div title={`${s.label}: ${formatFull(s.value)}`} style={{
              width: `${pct(s.value, max)}%`, minWidth: 64,
              background: PALETTE[i % PALETTE.length], color: '#fff',
              padding: '12px 8px', textAlign: 'center', fontSize: 15, fontWeight: 700,
              borderRadius: 3,
            }}>{formatCompact(s.value)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Funnel: 3D inverted cone, widest at top narrowing to a point. Each band
// is a trapezoid with its value centered; step labels sit on the left with
// leader lines. Floor is the top (widest) band. ----
export function Funnel({ floor, stages = [] }) {
  const [hover, setHover] = useState(null)
  const wrapRef = useRef(null)
  const items = floor ? [{ label: floor.label, value: floor.value }, ...stages] : stages
  const n = items.length || 1
  const VBW = 1000
  const cx = 720
  const hw0 = 250, hwEnd = 12
  const bandH = 74, gap = 9
  const y0 = 10
  const VBH = y0 + n * (bandH + gap) + 16
  const lerp = (a, b, t) => a + (b - a) * t
  const labelEndX = 430
  const showTip = (e, it) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    setHover({
      text: it.tip || `${it.label}: ${formatFull(it.value)}`,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }
  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', maxHeight: '42vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <defs>
          {items.map((_, i) => {
            const c = PALETTE[i % PALETTE.length]
            return (
              <linearGradient id={`fnl${i}`} key={i} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={shade(c, 0.12)} />
                <stop offset="100%" stopColor={shade(c, -0.06)} />
              </linearGradient>
            )
          })}
        </defs>
        {items.map((it, i) => {
          const yTop = y0 + i * (bandH + gap)
          const yBot = yTop + bandH
          const topHW = lerp(hw0, hwEnd, i / n)
          const botHW = i === n - 1 ? 6 : lerp(hw0, hwEnd, (i + 1) / n)
          const c = PALETTE[i % PALETTE.length]
          const midY = yTop + bandH / 2
          const leftEdge = cx - (topHW + botHW) / 2
          const label = formatCompact(it.value)
          const availW = (topHW + botHW) - 12
          const vSize = Math.max(9, Math.min(18, availW / (label.length * 0.62)))
          return (
            <g key={i} onMouseMove={(e) => showTip(e, it)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
              <polygon
                points={`${cx - topHW},${yTop} ${cx + topHW},${yTop} ${cx + botHW},${yBot} ${cx - botHW},${yBot}`}
                fill={`url(#fnl${i})`}
              />
              <text x={cx} y={midY} dy="0.35em" textAnchor="middle" fill="#fff" fontWeight="700" fontSize={vSize.toFixed(1)}>{label}</text>
              <line x1={labelEndX + 8} y1={midY} x2={leftEdge} y2={midY} stroke="#475569" strokeWidth="1" />
              <circle cx={leftEdge} cy={midY} r="2.5" fill={c} />
              <text x={labelEndX} y={midY - 7} textAnchor="end" fill={c} fontWeight="700" fontSize="13.5">{it.label}</text>
              <text x={labelEndX} y={midY + 9} textAnchor="end" fill="#9ca3af" fontSize="11">{formatCompact(it.value)}</text>
            </g>
          )
        })}
      </svg>
      {hover && (
        <div style={{
          position: 'absolute', left: hover.x + 14, top: hover.y + 14,
          background: 'rgba(0, 0, 0, 0.82)', color: '#fff', borderRadius: 10,
          padding: '9px 13px', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-line',
          pointerEvents: 'none', zIndex: 50, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          maxWidth: 280, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}>{hover.text}</div>
      )}
    </div>
  )
}
