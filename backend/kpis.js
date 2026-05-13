// KPI registry. SQL and metadata live in queries.json.
// This file loads that JSON and turns each entry's `field` (single value)
// or `rows` (multi-row mapping) into the extract function the server expects.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const QUERIES_PATH = path.join(__dirname, 'queries.json')

const raw = JSON.parse(fs.readFileSync(QUERIES_PATH, 'utf8'))

export const KPIS = Object.fromEntries(
  Object.entries(raw).map(([id, q]) => {
    const entry = { label: q.label, sql: q.sql }
    if (q.field) {
      entry.extract = (row) => Number(row?.[q.field])
    } else if (q.fields) {
      entry.extract = (row) => {
        if (!row) return null
        const out = {}
        for (const f of q.fields) out[f] = row[f] == null ? null : Number(row[f])
        return out
      }
    } else if (q.rows) {
      const { name, value } = q.rows
      entry.extractAll = (rows) => rows.map((r) => ({
        name: r[name] ?? 'Unknown',
        value: Number(r[value]),
      }))
    }
    return [id, entry]
  })
)
