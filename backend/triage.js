import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import xlsx from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_XLSX = path.resolve(__dirname, '..', 'Mosaic Customer Tracker.xlsx')
const TRACKER_PATH = process.env.TRACKER_XLSX || DEFAULT_XLSX
const TRACKER_TAB = process.env.TRACKER_TAB || 'Priority Customer Tracker'
const OPS_TAB = process.env.OPS_TAB || 'Internal Ops Team Tracker (Deta'

const STEP_META = [
  { name: 'Step 0', title: 'Analytics on Hold',    description: 'Customers on hold for analytics — not escalated' },
  { name: 'Step 1', title: 'SIFT Search',          description: 'Search for priority client names to identify target files' },
  { name: 'Step 2', title: 'File Retrieval',       description: 'Retrieval of target files from source systems' },
  { name: 'Step 3', title: 'In-scope Files',       description: 'Customer files confirmed in-scope after relevancy review' },
  { name: 'Step 4', title: 'Extraction / QC',      description: 'Data extraction and quality control review' },
  { name: 'Step 5', title: 'Customer Interaction', description: 'Customer liaison and file sharing' },
]

// Maps the raw "Comms Outreach Status" cell value to the short bucket name
// used by the Customer Outreach tile in the dashboard.
const OUTREACH_BUCKETS = [
  { name: 'M0',    label: 'Meeting 0',         match: /^meeting\s*0$/i,           color: '#9ca3af' },
  { name: 'Hold',  label: 'On Hold',           match: /\bhold\b/i,                 color: '#6b7280' },
  { name: 'M1',    label: 'Meeting 1',         match: /^meeting\s*1$/i,           color: '#8b5cf6' },
  { name: 'Recur', label: 'Recurring Meeting', match: /recurring/i,                color: '#3b82f6' },
  { name: 'M2',    label: 'Meeting 2',         match: /^meeting\s*2$/i,           color: '#f9a8d4' },
  { name: 'M3',    label: 'Meeting 3',         match: /^meeting\s*3$/i,           color: '#c026d3' },
]

const SENTIMENT_BUCKETS = [
  { name: 'Green',  label: 'On Track',  match: /^green$/i,  color: '#22c55e' },
  { name: 'Yellow', label: 'Attention', match: /^yellow$/i, color: '#eab308' },
  { name: 'Red',    label: 'At Risk',   match: /^red$/i,    color: '#ef4444' },
]

function loadWorkbook() {
  if (!fs.existsSync(TRACKER_PATH)) {
    throw new Error(`Tracker workbook not found at ${TRACKER_PATH}`)
  }
  return xlsx.readFile(TRACKER_PATH)
}

function loadSheetRows(wb) {
  const ws = wb.Sheets[TRACKER_TAB]
  if (!ws) {
    throw new Error(`Tab "${TRACKER_TAB}" not found. Tabs: ${wb.SheetNames.join(', ')}`)
  }
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
}

// Step 1 (SIFT Search) comes from the Internal Ops Team Tracker sheet:
// customers with "Has SIFT search been run? (Step 1 in Dashboard)" == "Yes".
function loadStep1FromOps(wb) {
  const sheetName = wb.SheetNames.find(n => n === OPS_TAB)
    || wb.SheetNames.find(n => /internal\s*ops\s*team\s*tracker/i.test(n))
  if (!sheetName) return null
  const ws = wb.Sheets[sheetName]
  if (!ws) return null
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  const headerIdx = rows.findIndex(r => (r || []).some(c => /^customer$/i.test(String(c ?? '').trim())))
  if (headerIdx === -1) return null
  const headers = (rows[headerIdx] || []).map(c => String(c ?? '').replace(/\s+/g, ' ').trim())
  const customerIdx = headers.findIndex(h => /^customer$/i.test(h))
  const uniqueIdx = headers.findIndex(h => /^unique\s*customer$/i.test(h))
  const siftRunIdx = headers.findIndex(h => /has\s*sift\s*search\s*been\s*run/i.test(h))
  if (customerIdx === -1 || siftRunIdx === -1) return null
  const customers = []
  const seenCust = new Set()
  const uniqueSet = new Set()
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const val = String(row[siftRunIdx] ?? '').trim().toLowerCase()
    if (val !== 'yes') continue
    const cust = String(row[customerIdx] ?? '').replace(/\s+/g, ' ').trim()
    if (!cust) continue
    if (!seenCust.has(cust)) {
      seenCust.add(cust)
      customers.push(cust)
    }
    if (uniqueIdx !== -1) {
      const u = String(row[uniqueIdx] ?? '').replace(/\s+/g, ' ').trim()
      uniqueSet.add(u || cust)
    } else {
      uniqueSet.add(cust)
    }
  }
  return { customers, uniqueCount: uniqueSet.size }
}

// The Priority Customer Tracker has a title/section banner above the real
// header row. The real header row is one that mentions any "Step N in
// Dashboard" tag; everything below it is data.
function findHeaderRow(rows) {
  return rows.findIndex(r => (r || []).some(c => /step\s*[0-5]\s*in\s*dashboard/i.test(String(c ?? ''))))
}

function normalize(value) {
  if (value == null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function locateColumns(headers) {
  const customerIdx = headers.findIndex(h => /^customer$/i.test(h))
  const stepCols = {}
  headers.forEach((h, i) => {
    const m = h.match(/step\s*([0-5])\s*in\s*dashboard/i)
    if (m) stepCols[parseInt(m[1], 10)] = i
  })
  if (stepCols[5] === undefined) {
    const idx = headers.findIndex(h => /comms\s*outreach\s*status/i.test(h))
    if (idx !== -1) stepCols[5] = idx
  }
  const sentimentIdx = headers.findIndex(h => /^customer sentiment$/i.test(h))
  const reattributedIdx = headers.findIndex(h => /reattributed\s*customer\s*files/i.test(h))
  const attributedIdx = headers.findIndex(h => /^#\s*of\s*attributed\s*customer\s*files/i.test(h))
  const uniqueCustomerIdx = headers.findIndex(h => /^unique\s*customer$/i.test(h))
  const priorityIdx = headers.findIndex(h => /^priority\s*order$/i.test(h))
  const requestDateIdx = headers.findIndex(h => /initial\s*customer\s*request\s*date/i.test(h))
  const daysActiveIdx = headers.findIndex(h => /^days\s*active$/i.test(h))
  const crmIdx = headers.findIndex(h => /^crm\s*liaison$/i.test(h))
  return {
    customerIdx, stepCols, sentimentIdx, reattributedIdx, attributedIdx,
    uniqueCustomerIdx, priorityIdx, requestDateIdx, daysActiveIdx, crmIdx,
  }
}

// Excel serial date → ISO yyyy-mm-dd (Excel's epoch is 1899-12-30; 1 == 1900-01-01)
function excelSerialToISO(n) {
  if (!Number.isFinite(n)) return null
  const ms = (n - 25569) * 86400 * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
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

function bucketForSentiment(raw) {
  const s = normalize(raw)
  if (!s) return null
  return SENTIMENT_BUCKETS.find(b => b.match.test(s)) ?? null
}

export async function getTriageBuckets() {
  const wb = loadWorkbook()
  const rows = loadSheetRows(wb)
  const step1Override = loadStep1FromOps(wb)
  if (rows.length === 0) {
    return {
      steps: STEP_META.map(m => ({ ...m, customers: [] })),
      outreach: { statuses: OUTREACH_BUCKETS.map(b => ({ ...b, count: 0, customers: [] })), total: 0 },
      sentiment: { categories: SENTIMENT_BUCKETS.map(b => ({ name: b.name, label: b.label, color: b.color, count: 0, customers: [] })), total: 0 },
      totals: { rows: 0 },
      source: TRACKER_PATH,
    }
  }

  const headerRowIdx = findHeaderRow(rows)
  if (headerRowIdx === -1) {
    throw new Error('Could not locate header row (no "Step 1 in Dashboard" cell found).')
  }
  const headers = (rows[headerRowIdx] || []).map(normalize)
  const {
    customerIdx, stepCols, sentimentIdx, reattributedIdx, attributedIdx,
    uniqueCustomerIdx, priorityIdx, requestDateIdx, daysActiveIdx, crmIdx,
  } = locateColumns(headers)
  if (customerIdx === -1) {
    throw new Error(`Could not find "Customer" column. Headers: ${headers.join(' || ')}`)
  }

  const dataStart = headerRowIdx + 1
  const allCustomers = new Set()
  const buckets = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] }
  const seen = { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set() }
  const uniqueGroups = { 0: new Set(), 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set() }
  const outreachByBucket = Object.fromEntries(OUTREACH_BUCKETS.map(b => [b.name, []]))
  let outreachTotal = 0
  const sentimentByBucket = Object.fromEntries(SENTIMENT_BUCKETS.map(b => [b.name, []]))
  let sentimentTotal = 0
  const attributionCustomers = []
  let attributedFiles = 0
  let reattributedFiles = 0
  const details = []

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const customer = normalize(row[customerIdx])
    if (!customer) continue
    const uniqueName = uniqueCustomerIdx !== -1 ? normalize(row[uniqueCustomerIdx]) : ''
    if (uniqueName) allCustomers.add(uniqueName)
    else allCustomers.add(customer)

    for (let s = 0; s <= 5; s++) {
      const idx = stepCols[s]
      if (idx == null) continue
      const cell = row[idx]
      const include = s === 0
        ? /analytics\s*on\s*hold/i.test(normalize(cell))
        : hasValue(cell)
      if (include) {
        if (!seen[s].has(customer)) {
          seen[s].add(customer)
          buckets[s].push(customer)
        }
        uniqueGroups[s].add(uniqueName || customer)
      }
    }

    if (stepCols[5] != null) {
      const bucket = bucketForOutreach(row[stepCols[5]])
      if (bucket) {
        outreachByBucket[bucket.name].push(customer)
        outreachTotal += 1
      }
    }

    if (sentimentIdx != null && sentimentIdx !== -1) {
      const sBucket = bucketForSentiment(row[sentimentIdx])
      if (sBucket) {
        sentimentByBucket[sBucket.name].push(customer)
        sentimentTotal += 1
      }
    }

    const attrVal = attributedIdx !== -1 ? Number(row[attributedIdx]) : 0
    const reattrVal = reattributedIdx !== -1 ? Number(row[reattributedIdx]) : 0
    const attrOk = Number.isFinite(attrVal) && attrVal > 0
    const reattrOk = Number.isFinite(reattrVal) && reattrVal > 0
    if (attrOk || reattrOk) {
      attributionCustomers.push({
        customer,
        attributed: attrOk ? attrVal : 0,
        reattributed: reattrOk ? reattrVal : 0,
      })
      if (attrOk) attributedFiles += attrVal
      if (reattrOk) reattributedFiles += reattrVal
    }

    // Per-customer detail row for the Detailed Customer View page.
    // Analytics current step = furthest reached among steps 0-4.
    // Customers with later progression beat Step 0 (on hold); Step 0 only
    // wins when no other step has data.
    let currentStep = null
    for (let s = 4; s >= 0; s--) {
      const idx = stepCols[s]
      if (idx == null) continue
      const cell = row[idx]
      const include = s === 0
        ? /analytics\s*on\s*hold/i.test(normalize(cell))
        : hasValue(cell)
      if (include) { currentStep = s; break }
    }
    // SIFT files column lost its "Step 1 in Dashboard" tag; fall back to a name match.
    const siftFilesCol = stepCols[1] ?? headers.findIndex(h => /initial\s*sift\s*files/i.test(h))
    const copiedFilesCol = stepCols[2]
    const num = (v) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    const rawReq = requestDateIdx !== -1 ? row[requestDateIdx] : null
    let requestDate = null
    if (rawReq instanceof Date) requestDate = rawReq.toISOString().slice(0, 10)
    else if (typeof rawReq === 'number') requestDate = excelSerialToISO(rawReq)
    else if (typeof rawReq === 'string' && rawReq.trim()) requestDate = rawReq.trim()
    details.push({
      customer,
      priorityOrder: priorityIdx !== -1 ? num(row[priorityIdx]) : null,
      requestDate,
      daysActive: daysActiveIdx !== -1 ? num(row[daysActiveIdx]) : null,
      sentiment: sentimentIdx !== -1 ? normalize(row[sentimentIdx]) : '',
      currentStep,
      siftFiles: siftFilesCol != null ? num(row[siftFilesCol]) : null,
      copiedFiles: copiedFilesCol != null ? num(row[copiedFilesCol]) : null,
      reattributedFiles: reattributedIdx !== -1 ? num(row[reattributedIdx]) : null,
      outreachStatus: stepCols[5] != null ? normalize(row[stepCols[5]]) : '',
      crmLiaison: crmIdx !== -1 ? normalize(row[crmIdx]) : '',
    })
  }

  if (step1Override) {
    buckets[1] = step1Override.customers
    uniqueGroups[1] = new Set()
    // Synthesize a unique-count-sized Set so we can report it consistently.
    for (let i = 0; i < step1Override.uniqueCount; i++) uniqueGroups[1].add('__u' + i)
  }
  const alpha = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  const steps = STEP_META.map((m, i) => ({
    ...m,
    customers: [...buckets[i]].sort(alpha),
    uniqueCount: uniqueGroups[i].size,
  }))
  const outreach = {
    statuses: OUTREACH_BUCKETS.map(b => ({
      name: b.name,
      label: b.label,
      color: b.color,
      count: outreachByBucket[b.name].length,
      customers: [...outreachByBucket[b.name]].sort(alpha),
    })),
    total: outreachTotal,
  }
  const sentiment = {
    categories: SENTIMENT_BUCKETS.map(b => ({
      name: b.name,
      label: b.label,
      color: b.color,
      count: sentimentByBucket[b.name].length,
      customers: [...sentimentByBucket[b.name]].sort(alpha),
    })),
    total: sentimentTotal,
  }
  const attribution = {
    attributedFiles,
    reattributedFiles,
    totalFiles: attributedFiles + reattributedFiles,
    customers: attributionCustomers,
    totalCustomers: attributionCustomers.length,
  }
  return {
    steps,
    outreach,
    sentiment,
    attribution,
    details: [...details].sort((a, b) => alpha(a.customer, b.customer)),
    totals: { rows: rows.length - dataStart, uniqueCustomers: allCustomers.size },
    source: path.basename(TRACKER_PATH),
  }
}
