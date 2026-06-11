// One-shot / re-runnable materializer.
// Reads a KPI's SQL from queries.json and writes its result into
// dashboard_summary.<table> via CREATE OR REPLACE TABLE, so the dashboard can
// read a tiny pre-aggregated table instead of running the heavy query live.
//
// Usage: node scripts/materialize.mjs <kpi-id> [destTable]
//   node scripts/materialize.mjs data-complexion
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BigQuery } from '@google-cloud/bigquery'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = process.env.GCP_PROJECT || 'cio-mosaic-analytics-pr-853ae3'
const DATASET = process.env.SUMMARY_DATASET || 'dashboard_summary'

const kpiId = process.argv[2]
if (!kpiId) {
  console.error('usage: node scripts/materialize.mjs <kpi-id> [destTable]')
  process.exit(1)
}
const destTable = process.argv[3] || kpiId.replace(/-/g, '_')

const queries = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'queries.json'), 'utf8'))
const kpi = queries[kpiId]
if (!kpi?.sql) {
  console.error(`No SQL found for KPI "${kpiId}"`)
  process.exit(1)
}

const dest = `\`${PROJECT_ID}.${DATASET}.${destTable}\``
const ddl = `CREATE OR REPLACE TABLE ${dest} AS\n${kpi.sql}`

const bq = new BigQuery({ projectId: PROJECT_ID })
console.log(`Materializing "${kpiId}" -> ${PROJECT_ID}.${DATASET}.${destTable} …`)
const t0 = Date.now()
const [job] = await bq.createQueryJob({ query: ddl })
await job.getQueryResults()
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s (job ${job.id})`)
