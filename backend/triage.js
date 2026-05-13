import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import xlsx from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_XLSX = path.resolve(__dirname, '..', 'Mosaic Customer Tracker.xlsx')
const TRACKER_PATH = process.env.TRACKER_XLSX || DEFAULT_XLSX
const TRACKER_TAB = process.env.TRACKER_TAB || 'Priority Customer Tracker'

const STEP_META = [
  { name: 'Step 1', title: 'SIFT Search',          description: 'Search for priority client names to identify target files' },
  { name: 'Step 2', title: 'File Retrieval',       description: 'Retrieval of target files from source systems' },
  { name: 'Step 3', title: 'In-scope customers',   description: 'Customer files confirmed in-scope after relevancy review' },
  { name: 'Step 4', title: 'Extraction / QC',      description: 'Data extraction and quality control review' },
  { name: 'Step 5', title: 'Customer Interaction', description: 'Customer liaison and file sharing' },
]

// Maps the raw "Comms Outreach Status" cell value to the short bucket name
// used by the Customer Outreach tile in the dashboard.
const OUTREACH_BUCKETS = [
  { name: 'M0',    label: 'Meeting 0',         match: /^meeting\s*0$/i,           color: '#9ca3af' },
  { name: 'Hold',  label: 'On Hold',           match: /\bhold\b/i,                 color: '#6b7280' },
  { name: 'M1',    label: 'Meeting 1',         match: /^meeting\s*1$/i,           color: '#22c55e' },
  { name: 'Recur', label: 'Recurring Meeting', match: /recurring/i,                color: '#3b82f6' },
  { name: 'M2',    label: 'Meeting 2',         match: /^meeting\s*2$/i,           color: '#fb7185' },
  { name: 'M3',    label: 'Meeting 3',         match: /^meeting\s*3$/i,           color: '#dc2626' },
]

function loadSheetRows() {
  if (!fs.existsSync(TRACKER_PATH)) {
    throw new Error(`Tracker workbook not found at ${TRACKER_PATH}`)
  }
  const wb = xlsx.readFile(TRACKER_PATH)
  const ws = wb.Sheets[TRACKER_TAB]
  if (!ws) {
    throw new Error(`Tab "${TRACKER_TAB}" not found. Tabs: ${wb.SheetNames.join(', ')}`)
  }
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
}

// The Priority Customer Tracker has a title/section banner above the real
// header row. The real header row is the one that mentions "Step 1 in
// Dashboard"; everything below it is data.
function findHeaderRow(rows) {
  return rows.findIndex(r => (r || []).some(c => /step\s*1\s*in\s*dashboard/i.test(String(c ?? ''))))
}

function normalize(value) {
  if (value == null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function locateColumns(headers) {
  const customerIdx = headers.findIndex(h => /^customer$/i.test(h))
  const stepCols = {}
  headers.forEach((h, i) => {
    const m = h.match(/step\s*([1-5])\s*in\s*dashboard/i)
    if (m) stepCols[parseInt(m[1], 10)] = i
  })
  // Step 5's column is labelled "Comms Outreach Status Step 5 in Dashboard",
  // already captured above. Fall back to a loose match just in case.
  if (stepCols[5] === undefined) {
    const idx = headers.findIndex(h => /comms\s*outreach\s*status/i.test(h))
    if (idx !== -1) stepCols[5] = idx
  }
  return { customerIdx, stepCols }
}

function hasValue(cell) {
  if (cell == null) return false
  const s = String(cell).trim()
  return s !== '' && s !== '-' && s.toLowerCase() !== 'n/a'
}

function bucketForOutreach(raw) {
  const s = normalize(raw)
  if (!s) return null
  return OUTREACH_BUCKETS.find(b => b.match.test(s)) ?? null
}

export async function getTriageBuckets() {
  const rows = loadSheetRows()
  if (rows.length === 0) {
    return {
      steps: STEP_META.map(m => ({ ...m, customers: [] })),
      outreach: { statuses: OUTREACH_BUCKETS.map(b => ({ ...b, count: 0, customers: [] })), total: 0 },
      totals: { rows: 0 },
      source: TRACKER_PATH,
    }
  }

  const headerRowIdx = findHeaderRow(rows)
  if (headerRowIdx === -1) {
    throw new Error('Could not locate header row (no "Step 1 in Dashboard" cell found).')
  }
  const headers = (rows[headerRowIdx] || []).map(normalize)
  const { customerIdx, stepCols } = locateColumns(headers)
  if (customerIdx === -1) {
    throw new Error(`Could not find "Customer" column. Headers: ${headers.join(' || ')}`)
  }

  const dataStart = headerRowIdx + 1
  const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  const seen = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set() }
  const outreachByBucket = Object.fromEntries(OUTREACH_BUCKETS.map(b => [b.name, []]))
  let outreachTotal = 0

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const customer = normalize(row[customerIdx])
    if (!customer) continue

    for (let s = 1; s <= 5; s++) {
      const idx = stepCols[s]
      if (idx == null) continue
      if (hasValue(row[idx]) && !seen[s].has(customer)) {
        seen[s].add(customer)
        buckets[s].push(customer)
      }
    }

    if (stepCols[5] != null) {
      const bucket = bucketForOutreach(row[stepCols[5]])
      if (bucket) {
        outreachByBucket[bucket.name].push(customer)
        outreachTotal += 1
      }
    }
  }

  const steps = STEP_META.map((m, i) => ({
    ...m,
    customers: buckets[i + 1],
  }))
  const outreach = {
    statuses: OUTREACH_BUCKETS.map(b => ({
      name: b.name,
      label: b.label,
      color: b.color,
      count: outreachByBucket[b.name].length,
      customers: outreachByBucket[b.name],
    })),
    total: outreachTotal,
  }
  return {
    steps,
    outreach,
    totals: { rows: rows.length - dataStart },
    source: path.basename(TRACKER_PATH),
  }
}
