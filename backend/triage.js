import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import xlsx from 'xlsx'
import { Storage } from '@google-cloud/storage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_XLSX = path.resolve(__dirname, '..', 'Mosaic Customer Tracker.xlsx')
const TRACKER_GCS = process.env.TRACKER_GCS || ''
const LOCAL_CACHE_PATH = path.join(os.tmpdir(), 'mosaic-tracker.xlsx')
const TRACKER_PATH = process.env.TRACKER_XLSX
  || (TRACKER_GCS ? LOCAL_CACHE_PATH : DEFAULT_XLSX)
const TRACKER_TAB = process.env.TRACKER_TAB || 'Priority Customer Tracker'
const OPS_TAB = process.env.OPS_TAB || 'Internal Ops Team Tracker (Deta'

let lastGeneration = null
let gcsDownloadPromise = null
let storageClient = null

function getStorage() {
  if (!storageClient) storageClient = new Storage()
  return storageClient
}

// Returns true when a fresh xlsx was just pulled from GCS (caller should bust
// any downstream caches). Compares the GCS object's generation number against
// the last one we downloaded; only re-downloads when it changes.
export async function ensureTrackerFromGcs() {
  if (!TRACKER_GCS) return false
  const m = TRACKER_GCS.match(/^gs:\/\/([^/]+)\/(.+)$/)
  if (!m) throw new Error(`Invalid TRACKER_GCS, expected gs://bucket/path: ${TRACKER_GCS}`)
  const [, bucket, object] = m

  const [meta] = await getStorage().bucket(bucket).file(object).getMetadata()
  const currentGen = String(meta.generation)

  if (lastGeneration === currentGen && fs.existsSync(LOCAL_CACHE_PATH)) {
    return false
  }

  if (!gcsDownloadPromise) {
    gcsDownloadPromise = (async () => {
      await getStorage().bucket(bucket).file(object).download({ destination: LOCAL_CACHE_PATH })
      lastGeneration = currentGen
      console.log(`[triage] downloaded gs://${bucket}/${object}#${currentGen} -> ${LOCAL_CACHE_PATH}`)
    })().finally(() => {
      gcsDownloadPromise = null
    })
  }
  await gcsDownloadPromise
  return true
}

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
  { name: 'M0',    label: 'Meeting 0',         match: /^meeting\s*0$/i,           color: '#86efac' },
  { name: 'Hold',  label: 'On Hold',           match: /\bhold\b/i,                 color: '#a855f7' },
  { name: 'M1',    label: 'Meeting 1',         match: /^meeting\s*1$/i,           color: '#15803d' },
  { name: 'Recur', label: 'Recurring Meeting', match: /recurring/i,                color: '#3b82f6' },
  { name: 'M2',    label: 'Meeting 2',         match: /^meeting\s*2$/i,           color: '#fb7185' },
  { name: 'M3',    label: 'Meeting 3',         match: /^meeting\s*3$/i,           color: '#dc2626' },
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
  // cellDates: true returns true Date objects for date-typed cells, so the
  // Meeting 0 scan can tell real dates apart from text like "N/A".
  return xlsx.readFile(TRACKER_PATH, { cellDates: true })
}

function loadSheetRows(wb) {
  const ws = wb.Sheets[TRACKER_TAB]
  if (!ws) {
    throw new Error(`Tab "${TRACKER_TAB}" not found. Tabs: ${wb.SheetNames.join(', ')}`)
  }
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
}

// Scan every sheet for a "Date of Meeting 0" column and return the set of
// distinct customers whose row has a real date value in that column. Data
// can live in either the Priority Customer Tracker or the DNU Customer
// Outreach Tracker, so we union both.
function collectMeeting0Customers(wb) {
  const customers = new Set()
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
    if (!rows.length) continue
    let headerRow = -1
    let dateCol = -1
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const r = rows[i] || []
      for (let c = 0; c < r.length; c++) {
        const v = String(r[c] ?? '').replace(/\s+/g, ' ').trim()
        if (/^date\s*of\s*meeting\s*0$/i.test(v)) { headerRow = i; dateCol = c; break }
      }
      if (headerRow !== -1) break
    }
    if (headerRow === -1) continue
    const hdr = (rows[headerRow] || []).map(c => String(c ?? '').replace(/\s+/g, ' ').trim())
    const custCol = hdr.findIndex(h => /^customer$/i.test(h))
    for (let r = headerRow + 1; r < rows.length; r++) {
      const v = rows[r]?.[dateCol]
      if (!isDateValue(v)) continue
      const cust = custCol !== -1 ? String(rows[r]?.[custCol] ?? '').replace(/\s+/g, ' ').trim() : ''
      if (cust) customers.add(cust)
      else customers.add(`${sheetName}#${r}`)
    }
  }
  return customers
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
  const seenDisplay = new Set()
  const uniqueSet = new Set()
  // Membership set for step1Set.has(customer) — contains both the raw ops-sheet
  // Customer values AND their Unique Customer rollup, so the priority-tracker
  // lookup matches whichever form that sheet uses (e.g. "CIBC" rolls up CIBC
  // CX/TDO/TDS variants from the ops sheet).
  const membership = new Set()
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const val = String(row[siftRunIdx] ?? '').trim().toLowerCase()
    if (val !== 'yes') continue
    const cust = String(row[customerIdx] ?? '').replace(/\s+/g, ' ').trim()
    if (!cust) continue
    const uniq = uniqueIdx !== -1
      ? (String(row[uniqueIdx] ?? '').replace(/\s+/g, ' ').trim() || cust)
      : cust
    uniqueSet.add(uniq)
    membership.add(cust)
    membership.add(uniq)
    // Display name: use the unique-customer name so CIBC CX/TDO/TDS collapse to "CIBC".
    if (!seenDisplay.has(uniq)) {
      seenDisplay.add(uniq)
      customers.push(uniq)
    }
  }
  return { customers, uniqueCount: uniqueSet.size, membership }
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
  // Yesterday's snapshot of Customer Sentiment; compared against sentimentIdx to
  // derive escalated / de-escalated moves.
  const prevSentimentIdx = headers.findIndex(h => /previous\s*day\s*sentiment/i.test(h))
  const reattributedIdx = headers.findIndex(h => /reattributed\s*customer\s*files/i.test(h))
  const attributedIdx = headers.findIndex(h => /^#\s*of\s*attributed\s*customer\s*files/i.test(h))
  const uniqueCustomerIdx = headers.findIndex(h => /^unique\s*customer$/i.test(h))
  const priorityIdx = headers.findIndex(h => /^priority\s*order$/i.test(h))
  // "Initial PwC Interaction Date" on the dashboard maps to the spreadsheet's
  // "Initial Customer Interaction Pwc with CRMs" column — the column previously
  // labelled "Initial Customer Request Date" is empty in current trackers.
  const requestDateIdx = headers.findIndex(h => /initial\s*customer\s*interaction\s*pwc\s*with\s*crms/i.test(h))
  const daysActiveIdx = headers.findIndex(h => /^days\s*active$/i.test(h))
  const crmIdx = headers.findIndex(h => /^crm\s*liaison$/i.test(h))
  const meeting0DateIdx = headers.findIndex(h => /^date\s*of\s*meeting\s*0$/i.test(h))
  const businessLineIdx = headers.findIndex(h => /^business\s*line$/i.test(h))
  const escalationIdx = headers.findIndex(h => /^escalation\s*reasoning$/i.test(h))
  // "Furthest Meeting Completed" — located by header name (column position
  // varies between tracker versions), used to tag CIW customers like "Uber (M2)".
  const furthestMeetingIdx = headers.findIndex(h => /furthest\s*meeting/i.test(h))
  return {
    customerIdx, stepCols, sentimentIdx, prevSentimentIdx, reattributedIdx, attributedIdx,
    uniqueCustomerIdx, priorityIdx, requestDateIdx, daysActiveIdx, crmIdx,
    meeting0DateIdx, businessLineIdx, escalationIdx, furthestMeetingIdx,
  }
}

// "Meeting 2" / "M2" / "meeting2" → "M2". Returns '' for blanks or non-meeting
// values (e.g. "Hold", "Recurring Meeting") so no tag is shown for those.
function furthestMeetingTag(raw) {
  const s = normalize(raw)
  if (!s) return ''
  const m = s.match(/(?:meeting|^m)\s*(\d+)/i)
  return m ? `M${m[1]}` : ''
}

// True iff the cell holds a real date value (Date, Excel serial number, or a
// string that parses to a valid date). Rejects empty, "—", "TBD", etc.
function isDateValue(cell) {
  if (cell == null) return false
  if (cell instanceof Date) return !Number.isNaN(cell.getTime())
  if (typeof cell === 'number') {
    // Excel date serials are positive numbers; 1 == 1900-01-01.
    return Number.isFinite(cell) && cell > 0 && cell < 100000
  }
  if (typeof cell === 'string') {
    const s = cell.trim()
    if (!s) return false
    const d = new Date(s)
    return !Number.isNaN(d.getTime())
  }
  return false
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
  await ensureTrackerFromGcs()
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
    customerIdx, stepCols, sentimentIdx, prevSentimentIdx, reattributedIdx, attributedIdx,
    uniqueCustomerIdx, priorityIdx, requestDateIdx, daysActiveIdx, crmIdx,
    meeting0DateIdx, businessLineIdx, escalationIdx, furthestMeetingIdx,
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
  // Sentiment moves vs. yesterday's "Previous Day Sentiment" snapshot.
  // escalated = got worse (Green→Yellow, Yellow→Red, …); deEscalated = improved.
  const escalated = []
  const deEscalated = []
  const seenChange = new Set()
  const attributionCustomers = []
  let attributedFiles = 0
  let reattributedFiles = 0
  const details = []
  // Distinct customers that have a real Date of Meeting 0 cell anywhere in
  // the workbook (Priority Customer Tracker OR DNU Customer Outreach Tracker).
  // Used for the "# of Meeting 0's" stat on the Detailed Customer View.
  const meeting0Customers = collectMeeting0Customers(wb)
  // Customer → uniqueName, so we can recompute uniqueGroups after the
  // furthest-step dedup pass below.
  const custToUnique = new Map()
  // Customer → sentiment bucket name ('Red' | 'Yellow' | 'Green' | ''), used to
  // sort step buckets so risk reads top-down: Red, Yellow, Green, unknown.
  const custToSentiment = new Map()
  // Unique-customer rollup → worst sentiment among its variants. Step 1 uses
  // the rollup name (e.g. "Google" for Google CX + Google AI), so the per-row
  // sentiment under raw customer names won't match without this rollup.
  const uniqueWorstSentiment = new Map()
  const SENT_SEVERITY = { Red: 0, Yellow: 1, Green: 2 }
  // Customers with "Has SIFT search been run? (Step 1 in Dashboard) = Yes" on
  // the Internal Ops Team Tracker. Drives Step 1 for both the bucket override
  // above and the per-row currentStep below.
  const step1Set = step1Override?.membership ?? new Set(step1Override ? step1Override.customers : [])
  // Customer → furthest meeting tag ("M0".."M3") from the "Furthest Meeting
  // Completed" column, used to annotate names in the Customer Interaction Workflow.
  const furthestByCustomer = {}

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const customer = normalize(row[customerIdx])
    if (!customer) continue
    {
      // Prefer a dedicated "Furthest Meeting Completed" column; fall back to the
      // "Comms Outreach Status" column (Meeting 0/1/2/3), which is the only
      // meeting value present in current trackers. Hold/Recurring yield no tag.
      const meetingSrcIdx = furthestMeetingIdx !== -1 ? furthestMeetingIdx : stepCols[5]
      const tag = meetingSrcIdx != null ? furthestMeetingTag(row[meetingSrcIdx]) : ''
      if (tag && !furthestByCustomer[customer]) furthestByCustomer[customer] = tag
    }
    const uniqueName = uniqueCustomerIdx !== -1 ? normalize(row[uniqueCustomerIdx]) : ''
    if (uniqueName) allCustomers.add(uniqueName)
    else allCustomers.add(customer)
    if (!custToUnique.has(customer)) custToUnique.set(customer, uniqueName || customer)

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
        if (!custToSentiment.has(customer)) custToSentiment.set(customer, sBucket.name)
        if (uniqueName && uniqueName !== customer) {
          const prev = uniqueWorstSentiment.get(uniqueName)
          if (!prev || SENT_SEVERITY[sBucket.name] < SENT_SEVERITY[prev]) {
            uniqueWorstSentiment.set(uniqueName, sBucket.name)
          }
        }
        // Compare against yesterday's snapshot to classify the move.
        if (prevSentimentIdx !== -1 && !seenChange.has(customer)) {
          const prevBucket = bucketForSentiment(row[prevSentimentIdx])
          if (prevBucket && prevBucket.name !== sBucket.name) {
            seenChange.add(customer)
            const reason = escalationIdx !== -1 ? normalize(row[escalationIdx]) : ''
            const move = { customer, from: prevBucket.name, to: sBucket.name, reason }
            if (SENT_SEVERITY[sBucket.name] < SENT_SEVERITY[prevBucket.name]) escalated.push(move)
            else deEscalated.push(move)
          }
        }
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

    // SIFT files column lost its "Step 1 in Dashboard" tag; fall back to a name match.
    const siftFilesCol = stepCols[1] ?? headers.findIndex(h => /initial\s*sift\s*files/i.test(h))
    const copiedFilesCol = stepCols[2]
    const extractedFilesCol = stepCols[4]
    // Per-customer detail row for the Detailed Customer View page.
    // Analytics current step = furthest reached among steps 0-4.
    // Customers with later progression beat Step 0 (on hold); Step 0 only
    // wins when no other step has data. Step 1 keys off the Internal Ops Team
    // Tracker's "Has SIFT search been run? (Step 1 in Dashboard) = Yes" answer
    // — the same source the Step 1 triage bucket uses — so the per-row step
    // stays consistent with the bucket assignment.
    let currentStep = null
    for (let s = 4; s >= 0; s--) {
      let include
      if (s === 1) {
        include = step1Set.has(customer)
      } else {
        const idx = stepCols[s]
        if (idx == null || idx === -1) continue
        const cell = row[idx]
        include = s === 0
          ? /analytics\s*on\s*hold/i.test(normalize(cell))
          : hasValue(cell)
      }
      if (include) { currentStep = s; break }
    }
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
      attributedFiles: attributedIdx !== -1 ? num(row[attributedIdx]) : null,
      extractedFiles: extractedFilesCol != null ? num(row[extractedFilesCol]) : null,
      outreachStatus: stepCols[5] != null ? normalize(row[stepCols[5]]) : '',
      crmLiaison: crmIdx !== -1 ? normalize(row[crmIdx]) : '',
      businessLine: businessLineIdx !== -1 ? normalize(row[businessLineIdx]) : '',
      escalationReason: escalationIdx !== -1 ? normalize(row[escalationIdx]) : '',
    })
  }

  if (step1Override) {
    buckets[1] = step1Override.customers
    uniqueGroups[1] = new Set()
    // Synthesize a unique-count-sized Set so we can report it consistently.
    for (let i = 0; i < step1Override.uniqueCount; i++) uniqueGroups[1].add('__u' + i)
  }

  // Furthest-step dedup: within steps 0-4, a customer only appears in the
  // highest step they reached. e.g. if Amex shows in both Step 0 and Step 1,
  // keep only Step 1. Step 5 (Customer Interaction / outreach) is independent.
  {
    const claimed = new Set()
    for (let s = 4; s >= 0; s--) {
      const kept = buckets[s].filter(c => {
        if (claimed.has(c)) return false
        claimed.add(c)
        return true
      })
      if (kept.length !== buckets[s].length) {
        buckets[s] = kept
        uniqueGroups[s] = new Set(kept.map(c => custToUnique.get(c) || c))
      }
    }
  }

  // Fold unique-rollup sentiment into the per-customer map so Step 1 (which
  // carries the rollup name like "Google") sorts and colors correctly.
  for (const [u, name] of uniqueWorstSentiment) {
    if (!custToSentiment.has(u)) custToSentiment.set(u, name)
  }

  const alpha = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  // Risk-first sort for the triage step buckets: Red → Yellow → Green → unknown,
  // alphabetical within each tier.
  const SENT_RANK = { Red: 0, Yellow: 1, Green: 2 }
  const sentRank = (c) => SENT_RANK[custToSentiment.get(c)] ?? 3
  const bySentiment = (a, b) => {
    const r = sentRank(a) - sentRank(b)
    return r !== 0 ? r : alpha(a, b)
  }
  const steps = STEP_META.map((m, i) => ({
    ...m,
    customers: [...buckets[i]].sort(bySentiment),
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
  const bucketMetaByName = Object.fromEntries(
    SENTIMENT_BUCKETS.map(b => [b.name, { name: b.name, label: b.label, color: b.color }])
  )
  // Per-customer sentiment lookup the dashboard uses to tint step pills.
  // Includes both raw customer names (from the Priority Tracker) and unique
  // rollup names (used by Step 1) so e.g. "Google" resolves to Red.
  const byCustomer = {}
  for (const [c, name] of custToSentiment) {
    if (bucketMetaByName[name]) byCustomer[c] = bucketMetaByName[name]
  }
  // Escalated reads worst-new-sentiment first (Red before Yellow); de-escalated
  // reads best-new-sentiment first (Green before Yellow). Alphabetical within a tier.
  const byNewWorst = (a, b) => (SENT_SEVERITY[a.to] - SENT_SEVERITY[b.to]) || alpha(a.customer, b.customer)
  const byNewBest = (a, b) => (SENT_SEVERITY[b.to] - SENT_SEVERITY[a.to]) || alpha(a.customer, b.customer)
  const sentiment = {
    categories: SENTIMENT_BUCKETS.map(b => ({
      name: b.name,
      label: b.label,
      color: b.color,
      count: sentimentByBucket[b.name].length,
      customers: [...sentimentByBucket[b.name]].sort(alpha),
    })),
    byCustomer,
    changes: {
      escalated: escalated.sort(byNewWorst),
      deEscalated: deEscalated.sort(byNewBest),
    },
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
    furthestByCustomer,
    sentiment,
    attribution,
    details: [...details].sort((a, b) => alpha(a.customer, b.customer)),
    totals: {
      rows: rows.length - dataStart,
      uniqueCustomers: allCustomers.size,
      meeting0Count: meeting0Customers.size,
    },
    source: path.basename(TRACKER_PATH),
  }
}
