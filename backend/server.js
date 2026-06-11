import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BigQuery } from '@google-cloud/bigquery'
import { KPIS } from './kpis.js'
import { getTriageBuckets, ensureTrackerFromGcs } from './triage.js'
import { GcloudCliAuthClient } from './gcloud-auth.js'

const PORT = process.env.PORT || 4000
const PROJECT_ID = process.env.GCP_PROJECT || 'cio-mosaic-analytics-pr-853ae3'
const CACHE_TTL_MS = 60_000
// Default KPI cache lifetime. Long by design: KPI numbers change ~daily, and
// stale-while-revalidate means viewers never wait on BigQuery anyway — a stale
// hit is served instantly while a fresh value is fetched in the background.
// Override globally with KPI_TTL_MS, or per-KPI via "ttl" (seconds) in queries.json.
const KPI_TTL_MS = Number(process.env.KPI_TTL_MS) || 6 * 60 * 60_000 // 6 hours

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..', 'dashboard', 'dist')

const isCloudRun = !!process.env.K_SERVICE
const GCLOUD_AUTH_ACCOUNT = process.env.GCLOUD_AUTH_ACCOUNT
  || 'vdi-pr-ddunga-vkasireddy@cio-mosaic-analytics-pr-853ae3.iam.gserviceaccount.com'

// Decide how the BigQuery client authenticates:
// - Cloud Run / any GCE VM (including the TELUS VDI): use ADC, which pulls the
//   attached service-account token from the metadata server — instant, no gcloud,
//   no interactive reauth.
// - A plain dev laptop (no metadata server, no ADC file): fall back to shelling
//   out to `gcloud auth print-access-token`. NOTE: on the TELUS VDI that gcloud
//   call hangs for tens of minutes on corporate reauth, so we deliberately prefer
//   ADC whenever the metadata server answers.
async function metadataReachable() {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 1500)
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email',
      { headers: { 'Metadata-Flavor': 'Google' }, signal: ctrl.signal },
    )
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

const useAdc = isCloudRun || !!process.env.GOOGLE_APPLICATION_CREDENTIALS || (await metadataReachable())
const bq = new BigQuery({
  projectId: PROJECT_ID,
  ...(useAdc ? {} : { authClient: new GcloudCliAuthClient(GCLOUD_AUTH_ACCOUNT) }),
})
console.log(`BigQuery auth: ${useAdc ? 'ADC (metadata server / Cloud Run)' : `gcloud CLI (${GCLOUD_AUTH_ACCOUNT})`}`)
const cache = new Map()
// In-flight BigQuery runs, keyed by KPI id, so concurrent requests (and the
// startup pre-warm) for the same stale KPI share a single query instead of
// stampeding BigQuery.
const inflight = new Map()

const ttlFor = (kpi) => kpi.ttlMs ?? KPI_TTL_MS

// Run the KPI's SQL, store the result in the cache, and return the payload.
// Deduped via `inflight` so only one query per KPI runs at a time.
function refreshKpi(id, kpi) {
  if (inflight.has(id)) return inflight.get(id)
  const run = (async () => {
    const [rows] = await bq.query({ query: kpi.sql })
    const value = kpi.extractAll
      ? kpi.extractAll(rows)
      : (kpi.extract ? kpi.extract(rows[0]) : rows[0])
    const payload = { id, label: kpi.label, value, fetchedAt: new Date().toISOString() }
    cache.set(id, { at: Date.now(), payload })
    return payload
  })()
  inflight.set(id, run)
  return run.finally(() => inflight.delete(id))
}

// Background table-level stale-while-revalidate for materialized KPIs.
// When the destination summary table is older than its refresh window (or
// missing), rebuild it with CREATE OR REPLACE while the dashboard keeps serving
// the existing table. Deduped per dest, and metadata age-checks are throttled
// so this doesn't add a BigQuery call to every request.
const materializeInflight = new Map()
const materializeLastCheck = new Map()
const MATERIALIZE_CHECK_THROTTLE_MS = 10 * 60_000

// Force a rebuild of the summary table now, ignoring age/throttle. Deduped per
// dest so concurrent callers (e.g. the Refresh button hitting it twice) share
// one CREATE OR REPLACE. Returns the in-flight promise so callers can await it.
function rebuildMaterialized(m) {
  if (materializeInflight.has(m.dest)) return materializeInflight.get(m.dest)
  const run = (async () => {
    console.log(`[materialize] rebuilding ${m.dest}…`)
    const t0 = Date.now()
    const [job] = await bq.createQueryJob({
      query: `CREATE OR REPLACE TABLE \`${PROJECT_ID}.${m.dest}\` AS\n${m.sql}`,
    })
    await job.getQueryResults()
    materializeLastCheck.set(m.dest, Date.now()) // table is fresh; skip the next age check
    console.log(`[materialize] ${m.dest} refreshed in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  })()
  materializeInflight.set(m.dest, run)
  run.catch(() => {}).finally(() => materializeInflight.delete(m.dest))
  return run
}

// Background table-level SWR: if the table is older than its refresh window (or
// missing), rebuild it in the background. Age checks are throttled so this does
// not add a BigQuery metadata call to every request.
function ensureMaterialized(m) {
  if (!m || materializeInflight.has(m.dest)) return
  const now = Date.now()
  if (now - (materializeLastCheck.get(m.dest) || 0) < MATERIALIZE_CHECK_THROTTLE_MS) return
  materializeLastCheck.set(m.dest, now)
  ;(async () => {
    let stale = true
    try {
      const [ds, tbl] = m.dest.split('.')
      const [md] = await bq.dataset(ds).table(tbl).getMetadata()
      const lastMod = Number(md.lastModifiedTime)
      stale = !lastMod || now - lastMod > m.refreshMs
    } catch {
      stale = true // table missing/unreadable → (re)build it
    }
    if (stale) rebuildMaterialized(m).catch((err) => console.error(`[materialize] ${m.dest}`, err.message))
  })()
}

const app = express()
app.use(cors())

app.get('/api/kpi/:id', async (req, res) => {
  const { id } = req.params
  const kpi = KPIS[id]
  if (!kpi) return res.status(404).json({ error: `Unknown KPI: ${id}` })

  // For materialized KPIs, keep the underlying summary table fresh in the
  // background (non-blocking). The request still serves from cache/table below.
  ensureMaterialized(kpi.materialize)

  const forceRefresh = req.query.refresh === '1'
  const cached = cache.get(id)
  const fresh = cached && Date.now() - cached.at < ttlFor(kpi)

  // Force refresh (Refresh button): for a materialized KPI, rebuild the summary
  // table first (the slow part — the request intentionally stays open until it
  // finishes so the UI can show progress), then re-query and return the fresh
  // value. If BigQuery fails, fall back to the stale cache when we have one.
  if (forceRefresh) {
    try {
      if (kpi.materialize) await rebuildMaterialized(kpi.materialize)
      return res.json(await refreshKpi(id, kpi))
    } catch (err) {
      console.error(`[kpi:${id}]`, err.message)
      if (cached) return res.json({ ...cached.payload, stale: true })
      return res.status(500).json({ error: err.message })
    }
  }

  // Fresh cache hit.
  if (fresh) return res.json(cached.payload)

  // Stale-while-revalidate: serve the stale value immediately, then refresh in
  // the background so the next request gets the updated number.
  if (cached) {
    res.json({ ...cached.payload, stale: true })
    refreshKpi(id, kpi).catch((err) => console.error(`[kpi:${id}] bg refresh`, err.message))
    return
  }

  // Cold (nothing cached yet): must run synchronously.
  try {
    res.json(await refreshKpi(id, kpi))
  } catch (err) {
    console.error(`[kpi:${id}]`, err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/triage', async (req, res) => {
  const cacheKey = '__triage__'
  let bypassCache = req.query.refresh === '1'
  try {
    if (await ensureTrackerFromGcs()) bypassCache = true
  } catch (err) {
    console.error('[triage] gcs check failed', err.message)
  }
  const cached = cache.get(cacheKey)
  if (!bypassCache && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return res.json(cached.payload)
  }
  try {
    const data = await getTriageBuckets()
    const payload = { ...data, fetchedAt: new Date().toISOString() }
    cache.set(cacheKey, { at: Date.now(), payload })
    res.json(payload)
  } catch (err) {
    console.error('[triage]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

import fs from 'node:fs'
if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR))
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'))
  })
  console.log(`serving static from ${STATIC_DIR}`)
}

app.listen(PORT, () => {
  console.log(`backend listening on http://localhost:${PORT} (project=${PROJECT_ID})`)
  // Warm the cache in the background so the first viewer hits a populated cache
  // instead of paying full BigQuery latency on every tile.
  const ids = Object.keys(KPIS)
  // Rebuild any materialized summary tables that are missing or stale on boot.
  for (const id of ids) ensureMaterialized(KPIS[id].materialize)
  console.log(`prewarming ${ids.length} KPIs…`)
  Promise.allSettled(ids.map((id) => refreshKpi(id, KPIS[id])))
    .then((results) => {
      const failed = results.filter((r) => r.status === 'rejected').length
      console.log(`prewarm complete (${ids.length - failed}/${ids.length} cached)`)
    })
})
