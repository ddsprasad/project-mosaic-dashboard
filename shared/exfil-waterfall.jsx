// Detailed data-harvesting waterfall (the "detailed analysis" popup). Hierarchical
// breakdown of Total Exfiltrated Files, live from wf-top / wf-zero / wf-sources.
// Shared so both the dashboard and the executive report can render it.
import { FileText, X } from 'lucide-react'
import { useKpi } from './hooks.js'
import { formatCompact } from './format.js'

const WF_COLORS = {
  total:    { fill: '#3b1a63', text: '#ffffff' },
  source:   { fill: '#3b1a63', text: '#ffffff' },
  complete: { fill: '#16a34a', text: '#ffffff' }, // green
  pending:  { fill: '#d61f9c', text: '#ffffff' }, // magenta
  zero:     { fill: '#9aa3a9', text: '#ffffff' }, // gray
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

function ExfilWaterfallTree({ d }) {
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
      <path d="M222,116 V123" {...LINE} />
      <path d="M143,123 H353" {...LINE} />
      <path d="M143,123 V140" {...ARROW} />
      <path d="M353,123 V140" {...ARROW} />
      <path d="M143,190 V228" {...LINE} />
      <path d="M134,228 H1020" {...LINE} />
      <path d="M134,228 V250" {...ARROW} />
      <path d="M392,228 V250" {...ARROW} />
      <path d="M668,228 V250" {...ARROW} />
      <path d="M890,228 V250" {...ARROW} />
      <path d="M1020,228 V250" {...ARROW} />
      <path d="M134,302 V310" {...LINE} /><path d="M52,310 H209" {...LINE} />
      <path d="M52,310 V320" {...ARROW} /><path d="M127,310 V320" {...ARROW} /><path d="M209,310 V320" {...ARROW} />
      <path d="M392,302 V310" {...LINE} /><path d="M338,310 H474" {...LINE} />
      <path d="M338,310 V320" {...ARROW} /><path d="M474,310 V320" {...ARROW} />
      <path d="M668,302 V310" {...LINE} /><path d="M571,310 H748" {...LINE} />
      <path d="M571,310 V320" {...ARROW} /><path d="M651,310 V320" {...ARROW} /><path d="M748,310 V320" {...ARROW} />
      <path d="M890,302 V310" {...LINE} /><path d="M835,310 H947" {...LINE} />
      <path d="M835,310 V320" {...ARROW} /><path d="M892,310 V320" {...ARROW} /><path d="M947,310 V320" {...ARROW} />
      <path d="M1020,302 V320" {...ARROW} />
      <WfBox x={18} y={8} w={1044} h={42} kind="total" value={d.total} label="Total Exfiltrated Files" vSize={17} lSize={10} />
      <WfBox x={18} y={70} w={408} h={46} kind="source" value={d.sources} label="BQ + GCS + other sources like GitHub, AWS, Azure, JIRA etc." vSize={15} lSize={8} />
      <WfBox x={438} y={70} w={152} h={46} kind="complete" value={d.gcsUncompressed} label="(GCS uncompressed)" />
      <WfBox x={602} y={70} w={460} h={46} kind="complete" value={d.glean} label="Glean" />
      <WfBox x={18} y={140} w={250} h={50} kind="source" value={d.bqGcsOther} label={srcLabelLong} vSize={14} lSize={8} />
      <WfBox x={280} y={140} w={146} h={50} kind="zero" value={d.zeroByte} label="(Zero Byte Files)" />
      <WfBox x={18} y={250} w={232} h={52} kind="complete" value={d.bq} label="BQ" />
      <WfBox x={258} y={250} w={268} h={52} kind="complete" value={d.gcs} label="GCS" />
      <WfBox x={534} y={250} w={268} h={52} kind="complete" value={d.github} label="GitHub" />
      <WfBox x={810} y={250} w={160} h={52} kind="pending" value={d.jira} label="Jira" />
      <WfBox x={978} y={250} w={84} h={52} kind="pending" value={d.others} label="Others" />
      <WfBox x={18} y={320} w={68} h={46} kind="complete" value={d.bq_bq} label="BQ" vSize={11} lSize={8} />
      <WfBox x={90} y={320} w={74} h={46} kind="complete" value={d.bq_tiDeleted} label="TI Deleted" vSize={11} lSize={8} />
      <WfBox x={168} y={320} w={82} h={46} kind="pending" value={d.bq_toPreserve} label="To Be Preserved" vSize={10} lSize={8} />
      <WfBox x={258} y={320} w={160} h={46} kind="complete" value={d.gcs_gcs} label="GCS" vSize={12} lSize={8} />
      <WfBox x={422} y={320} w={104} h={46} kind="complete" value={d.gcs_tiDeleted} label="TI Deleted" vSize={11} lSize={8} />
      <WfBox x={534} y={320} w={74} h={46} kind="complete" value={d.gh_gh} label="GitHub" vSize={11} lSize={8} />
      <WfBox x={612} y={320} w={78} h={46} kind="complete" value={d.gh_tiDeleted} label="TI Deleted" vSize={11} lSize={8} />
      <WfBox x={694} y={320} w={108} h={46} kind="pending" value={d.gh_toPreserve} label="To Be Preserved" vSize={11} lSize={8} />
      <WfBox x={810} y={320} w={50} h={46} kind="pending" value={d.jira_jira} label="Jira" vSize={10} lSize={7.5} />
      <WfBox x={864} y={320} w={56} h={46} kind="pending" value={d.jira_tiDeleted} label="TI Deleted" vSize={10} lSize={7.5} />
      <WfBox x={924} y={320} w={46} h={46} kind="pending" value={d.jira_toPreserve} label="To Be Preserved" vSize={9} lSize={6.5} />
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

function wfDisp(kpi, raw) {
  if (kpi.loading) return '…'
  if (kpi.error) return 'err'
  if (raw == null || raw === '') return '—'
  if (typeof raw === 'number') return Number.isFinite(raw) ? formatCompact(raw) : '—'
  const s = String(raw)
  return /^\d+$/.test(s) ? formatCompact(Number(s)) : s.toUpperCase()
}

export function ExfilWaterfallPage() {
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
          <button onClick={() => window.close()} aria-label="Close" title="Close"
            style={{ background: 'transparent', border: '1px solid #374151', color: '#9ca3af', borderRadius: 6, padding: 4, cursor: 'pointer' }}>
            <X size={16} />
          </button>
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
