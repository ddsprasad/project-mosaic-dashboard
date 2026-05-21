# Project Mosaic Dashboard — Local Deployment Runbook

Step-by-step guide for running the dashboard on a fresh local machine.

The app is two services running side-by-side:
- **Backend** — Express + BigQuery, port `4000` (`backend/`)
- **Dashboard** — Vite + React, port `3000` (`dashboard/`), proxies `/api/*` to the backend

---

## 1. Prerequisites

Install these once:

| Tool | Version | Check |
|---|---|---|
| Node.js | 18+ (20 LTS recommended) | `node -v` |
| npm | bundled with Node | `npm -v` |
| Git | any recent | `git --version` |
| Google Cloud SDK (`gcloud`) | latest | `gcloud --version` |

Install links:
- Node.js: https://nodejs.org/
- gcloud CLI: https://cloud.google.com/sdk/docs/install

You also need:
- **Google account with BigQuery access** to project `cio-mosaic-analytics-pr-853ae3` (or the project you plan to use).
- **`Mosaic Customer Tracker.xlsx`** — the customer-triage workbook. Get the latest copy from the Project Mosaic SharePoint / OneDrive (it is *not* in the repo).

---

## 2. Clone the repo

```bash
git clone https://github.com/ddunga002b/project-mosaic-dashboard.git
cd project-mosaic-dashboard
```

Repo layout:
```
project-mosaic-dashboard/
├── backend/                       # Express + BigQuery API
├── dashboard/                     # Vite + React UI
├── Mosaic Customer Tracker.xlsx   # YOU PLACE THIS — not checked in
└── run_book.md
```

---

## 3. Authenticate to Google Cloud

The backend reads BigQuery using a short-lived access token from your local `gcloud` CLI.

```bash
gcloud auth login
gcloud config set project cio-mosaic-analytics-pr-853ae3
gcloud auth application-default login
```

Verify:
```bash
gcloud auth print-access-token        # should print a long token, no errors
gcloud config get-value project       # should print the project ID
```

If you cannot run BigQuery queries, ask the project owner to grant your account `roles/bigquery.dataViewer` and `roles/bigquery.jobUser` on the project.

---

## 4. Drop the tracker workbook in place

Copy `Mosaic Customer Tracker.xlsx` into the **repo root** (same level as `backend/` and `dashboard/`). The exact filename matters.

The workbook must contain two tabs:
- `Priority Customer Tracker` — Steps 0/2/3/4/5 + sentiment + outreach
- `Internal Ops Team Tracker (Deta…)` — Step 1 (SIFT) data

If your filename or tab names differ, set them via env vars in step 5.

---

## 5. Install dependencies

Two `npm install`s — one per service:

```bash
npm install --prefix backend
npm install --prefix dashboard
```

This is a one-time step (re-run after pulling changes that touch `package.json`).

---

## 6. Start both services

Open **two terminals** (or use background tasks).

**Terminal 1 — backend:**
```bash
npm start --prefix backend
```
Expected output:
```
backend listening on http://localhost:4000 (project=cio-mosaic-analytics-pr-853ae3)
```

**Terminal 2 — dashboard:**
```bash
npm run dev --prefix dashboard
```
Expected output:
```
  VITE v8.x  ready in 750 ms
  ➜  Local:   http://localhost:3000/
```

---

## 7. Open the dashboard

Browse to **http://localhost:3000**

You should see KPI tiles populated with BigQuery data and a Customer Triage section populated from the XLSX. Click **Refresh** in the header to bypass the 60-second backend cache.

---

## 8. (Optional) Environment variables

All have sensible defaults; only set them if you need to override.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | Backend port |
| `GCP_PROJECT` | `cio-mosaic-analytics-pr-853ae3` | BigQuery project ID |
| `TRACKER_XLSX` | `./Mosaic Customer Tracker.xlsx` | Absolute path to the workbook |
| `TRACKER_TAB` | `Priority Customer Tracker` | Steps 0/2-5 tab name |
| `OPS_TAB` | `Internal Ops Team Tracker (Deta` | Step 1 tab name (prefix match) |
| `STATIC_DIR` | `../dashboard/dist` | Where to serve the built UI from |

Example (PowerShell):
```powershell
$env:TRACKER_XLSX = "C:\path\to\Mosaic Customer Tracker.xlsx"
npm start --prefix backend
```

Example (bash/zsh):
```bash
TRACKER_XLSX="/path/to/Mosaic Customer Tracker.xlsx" npm start --prefix backend
```

---

## 9. (Optional) Production-style single-server build

If you want to serve the UI from the backend (no Vite dev server):

```bash
npm run build --prefix dashboard      # produces dashboard/dist/
npm start --prefix backend            # auto-serves dashboard/dist at :4000
```

Open **http://localhost:4000**.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `gcloud: command not found` | Install Google Cloud SDK and reopen the terminal so PATH refreshes. |
| Backend logs `Tracker workbook not found` | The XLSX is missing or misnamed in the repo root. Verify with `ls "Mosaic Customer Tracker.xlsx"`. |
| Backend logs `Tab "Priority Customer Tracker" not found` | Tab was renamed. Set `TRACKER_TAB` env var to match. |
| BigQuery `403` / `permission denied` | Your gcloud account lacks BigQuery roles on the project. Re-run `gcloud auth login` with the right account or ask for access. |
| Port `3000` or `4000` already in use | Stop whatever is using it, or set `PORT=4001 npm start --prefix backend` and update `dashboard/vite.config.js` proxy target. |
| Dashboard shows `err` on KPI tiles | Backend isn't running, or the BigQuery query failed. Check the backend terminal for errors. |
| Token expires after ~1 hour | The backend auto-refreshes via `gcloud auth print-access-token`. If refresh fails, re-run `gcloud auth login`. |

---

## Stopping the app

`Ctrl+C` in each terminal. No background services to clean up.
