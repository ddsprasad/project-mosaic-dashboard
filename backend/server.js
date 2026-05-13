import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BigQuery } from '@google-cloud/bigquery'
import { KPIS } from './kpis.js'
import { getTriageBuckets } from './triage.js'
import { GcloudCliAuthClient } from './gcloud-auth.js'

const PORT = process.env.PORT || 4000
const PROJECT_ID = process.env.GCP_PROJECT || 'cio-mosaic-analytics-pr-853ae3'
const CACHE_TTL_MS = 60_000

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..', 'dashboard', 'dist')

const bq = new BigQuery({ projectId: PROJECT_ID, authClient: new GcloudCliAuthClient() })
const cache = new Map()

const app = express()
app.use(cors())

app.get('/api/kpi/:id', async (req, res) => {
  const { id } = req.params
  const kpi = KPIS[id]
  if (!kpi) return res.status(404).json({ error: `Unknown KPI: ${id}` })

  const bypassCache = req.query.refresh === '1'
  const cached = cache.get(id)
  if (!bypassCache && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return res.json(cached.payload)
  }

  try {
    const [rows] = await bq.query({ query: kpi.sql })
    const value = kpi.extractAll
      ? kpi.extractAll(rows)
      : (kpi.extract ? kpi.extract(rows[0]) : rows[0])
    const payload = { id, label: kpi.label, value, fetchedAt: new Date().toISOString() }
    cache.set(id, { at: Date.now(), payload })
    res.json(payload)
  } catch (err) {
    console.error(`[kpi:${id}]`, err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/triage', async (req, res) => {
  const cacheKey = '__triage__'
  const bypassCache = req.query.refresh === '1'
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
})
