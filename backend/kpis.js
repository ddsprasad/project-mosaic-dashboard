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
    // Optional per-KPI cache lifetime (seconds). Falls back to the server default.
    if (q.ttl != null) entry.ttlMs = Number(q.ttl) * 1000
    // Optional materialization: the KPI's `sql` reads a pre-aggregated table,
    // and the server keeps that table fresh by re-running `sqlFile` on a schedule.
    if (q.materialize) {
      entry.materialize = {
        dest: q.materialize.dest,
        refreshMs: Number(q.materialize.refreshSeconds ?? 86400) * 1000,
        sql: fs.readFileSync(path.join(__dirname, q.materialize.sqlFile), 'utf8'),
      }
    }
    if (q.field) {
      entry.extract = (row) => Number(row?.[q.field])
    } else if (q.table) {
      // Multi-column passthrough: keep only the named columns, coercing
      // numeric-looking cells (and BigQuery int wrappers) to Number, leaving
      // text labels as-is.
      const coerce = (v) => {
        if (v == null) return null
        if (typeof v === 'object' && 'value' in v) v = v.value
        const n = Number(v)
        return (typeof v !== 'boolean' && v !== '' && !Number.isNaN(n)) ? n : v
      }
      entry.extractAll = (rows) => rows.map((r) => {
        const out = {}
        for (const c of q.table) out[c] = coerce(r[c])
        return out
      })
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
