# Project Mosaic Dashboard

Executive Status Reporting dashboard for Project Mosaic, modeled on `image.png`.
The dashboard reads live KPIs from BigQuery (`cio-mosaic-analytics-pr-853ae3.sift_data.*`).

## Layout

```
ui_design/
├── image.png              ← reference screenshot
├── crops/                 ← per-section screenshot crops used while matching the design
├── dashboard/             ← Vite + React frontend  (port 3000)
│   ├── src/App.jsx        ← all dashboard panels (single-file component tree)
│   ├── src/App.css
│   └── vite.config.js     ← port 3000, proxies /api → http://localhost:4000
└── backend/               ← Express + @google-cloud/bigquery  (port 4000)
    ├── kpis.js            ← KPI query registry (one entry per KPI)
    └── server.js          ← GET /api/kpi/:id, GET /api/health
```

## Dashboard sections (exact labels from `image.png`)

| Card | KPIs / labels |
|---|---|
| **File Preservation** | Preservation Complete (65%), Total Exfil Files (200M), Decompressed Files (304.0M) |
| **File Profiling** | TOTAL SIFT OBJECTS (live), Duplicates, Exclusions, Files for Harv...; FILE DISTRIBUTION (Structured / Semi-Structured / Unstructured / For Further Analysis) |
| **File Harvesting** | Files Processed, Pending Preservation, Raw Records (3.5B) |
| **Data Complexion** | PHI / PII / PCI / Secrets / Internal Only / Other |
| **Customer Attribution** | Total Customers (45), Single Attributed (70%), Not Attributed (30%) |
| **Customer Triage Process** | Step 1..Step 4, Total Customers in Pipeline (45) |
| **Customer Outreach** | Customers by meeting stage, badge "15" |

## Backend KPI registry

Each KPI is a single entry in `backend/kpis.js`. Adding a new KPI = adding a new entry.

```js
// backend/kpis.js
export const KPIS = {
  'total-sift-objects': {
    label: 'TOTAL SIFT OBJECTS',
    sql: `
      SELECT COUNT(*) AS value
      FROM \`cio-mosaic-analytics-pr-853ae3.sift_data.files\`
      WHERE source != 'glean'
    `,
    extract: (row) => Number(row.value),
  },
}
```

The endpoint `GET /api/kpi/<id>` returns:

```json
{ "id": "total-sift-objects", "label": "TOTAL SIFT OBJECTS", "value": 26138365, "fetchedAt": "..." }
```

Results are cached in-memory for 60s.

### Frontend hook

```jsx
const { value, loading, error } = useKpi('total-sift-objects')
```

Compact-formatted via `formatCompact(n)` (e.g. `26138365 → "26.1M"`) so KPI tiles stay visually consistent with the design.

## Authentication

The backend uses the same pattern as the existing Python loader (`pr_bg_load_raw.py`):

```js
const bq = new BigQuery({ projectId: 'cio-mosaic-analytics-pr-853ae3' })
```

No credentials in code — the SDK picks up whatever auth the environment provides:

| Environment | How auth resolves |
|---|---|
| GCP Workbench / GCE / Cloud Run | Attached service account (automatic) |
| Local with `gcloud auth application-default login` | Application Default Credentials |
| Local with service-account key | `GOOGLE_APPLICATION_CREDENTIALS=<path>` |

The SA needs `roles/bigquery.dataViewer` + `roles/bigquery.jobUser` on the project. The Python loader's SA already has these.

## Running locally

```powershell
# backend
cd backend
npm install
npm start                 # listens on :4000

# frontend (separate terminal)
cd dashboard
npm install
npm run dev               # listens on :3000, proxies /api → :4000
```

Open http://localhost:3000.

## Running on GCP Workbench

Workbench instances come with a SA already attached, so BigQuery just works.

```bash
# install Node if missing
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# clone or upload this folder, then:
cd backend && npm install && npm start &
cd ../dashboard && npm install && npm run dev -- --host 0.0.0.0
```

Reach the dashboard via Workbench's port proxy:
`https://<instance>.notebooks.googleusercontent.com/proxy/3000/`

For a single-port deployment, build the frontend and serve it from Express
(`npm run build` in `dashboard/`, then add `app.use(express.static(...))` in
`backend/server.js`).

## Adding the next KPI (workflow)

1. User provides the SQL + display label.
2. Add an entry to `backend/kpis.js`.
3. In the relevant card in `dashboard/src/App.jsx`, swap the hard-coded value
   for `useKpi('<id>')` and use `formatCompact(value)` for display.
4. (Optional) restart backend to flush cache; the frontend hot-reloads.

## Status

- ✅ Layout, headers, KPI names, chart styles match `image.png`
- ✅ Backend scaffolded with `/api/kpi/:id` and 60s cache
- ✅ `total-sift-objects` query wired (label: **TOTAL SIFT OBJECTS**, source: `sift_data.files WHERE source != 'glean'`)
- ⏳ Remaining KPI queries — to be provided one at a time
- ⏳ Local BigQuery auth — works on Workbench / prod automatically; local dev needs ADC or a SA key
