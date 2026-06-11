// Shared number formatting used across the dashboard and the executive report.

// Compact, two-decimal magnitude: 22.07M, 191.69M, 353.17K. Truncates (not
// rounds) so a value never reads higher than it is.
export function formatCompact(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  const trunc2 = (v) => (Math.floor(v * 100 + 1e-9) / 100).toFixed(2)
  if (n >= 1e9) return trunc2(n / 1e9) + 'B'
  if (n >= 1e6) return trunc2(n / 1e6) + 'M'
  if (n >= 1e3) return trunc2(n / 1e3) + 'K'
  return String(n)
}

// Full, comma-grouped value (exact). Hover/tooltip friendly.
export function formatFull(n) {
  return n == null || !Number.isFinite(n) ? '—' : n.toLocaleString()
}
