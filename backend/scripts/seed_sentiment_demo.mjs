// LOCAL PREVIEW ONLY: tweak a few "Previous Day Sentiment" cells in the local
// tracker so the Escalated / De-escalated block has data to render. Backs the
// file up first. Does not touch the GCS/prod tracker.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import xlsx from 'xlsx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.resolve(__dirname, '..', '..', 'Mosaic Customer Tracker.xlsx')
const BAK = FILE + '.bak'
if (!fs.existsSync(BAK)) { fs.copyFileSync(FILE, BAK); console.log('backup ->', BAK) }

const wb = xlsx.readFile(FILE, { cellDates: true })
const ws = wb.Sheets['Priority Customer Tracker']
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null })
const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()
const hi = rows.findIndex(r => (r || []).some(c => /step\s*[0-5]\s*in\s*dashboard/i.test(String(c || ''))))
const hdr = (rows[hi] || []).map(norm)
const ci = hdr.findIndex(h => /^customer$/i.test(h))
const si = hdr.findIndex(h => /^customer sentiment$/i.test(h))
const pi = hdr.findIndex(h => /previous\s*day\s*sentiment/i.test(h))
const ei = hdr.findIndex(h => /^escalation\s*reasoning$/i.test(h))
const sentOf = (v) => { const s = norm(v).toLowerCase(); return s === 'green' || s === 'yellow' || s === 'red' ? s[0].toUpperCase() + s.slice(1) : null }

const setCell = (r, c, val) => { ws[xlsx.utils.encode_cell({ r, c })] = { t: 's', v: val } }
const used = new Set()
// want: [currentSentiment, newPreviousValue, demoReason]
const plan = [
  ['Red',    'Yellow', 'Data access timeline slipped; primary stakeholder unresponsive since last review.'], // escalate
  ['Yellow', 'Green',  'New scope concerns raised by the customer; follow-up meeting pending.'],              // escalate
  ['Green',  'Yellow', 'Outstanding items resolved and customer confirmed satisfaction.'],                    // de-escalate
  ['Yellow', 'Red',    'Escalation addressed; data delivery back on track.'],                                 // de-escalate
]
const changed = []
for (const [curWant, newPrev, reason] of plan) {
  for (let r = hi + 1; r < rows.length; r++) {
    if (used.has(r)) continue
    const row = rows[r] || []
    if (!norm(row[ci])) continue
    if (sentOf(row[si]) !== curWant) continue
    if (sentOf(row[pi]) && sentOf(row[pi]) !== curWant) continue // only seed rows not already a move
    used.add(r)
    setCell(r, pi, newPrev)
    if (ei !== -1 && !norm(row[ei])) setCell(r, ei, reason)
    changed.push(`${norm(row[ci])}: ${newPrev} -> ${curWant}`)
    break
  }
}
xlsx.writeFile(wb, FILE)
console.log('seeded moves:\n  ' + changed.join('\n  '))
