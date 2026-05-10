// Registry of KPI queries. Add new entries here as queries are provided.
// Each KPI has: id, label, sql, and an optional `extract` to pull the value
// out of the first row.
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
