#!/usr/bin/env node
/**
 * DC House — Load Test
 * Usage: node loadtest.js
 *
 * Tests the two main API paths under 50 concurrent users:
 *   1. READ  — GET /api/cars (index.html polling)
 *   2. WRITE — GET /api/cars?action=update (guard.html toggle)
 */

const BASE = 'https://dc-house.vercel.app/api/cars';
const KEY  = 'dc-house-2026';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function timed(label, fn) {
  const t0 = performance.now();
  let ok = false;
  try { await fn(); ok = true; } catch {}
  return { label, ms: Math.round(performance.now() - t0), ok };
}

function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const p = pct => sorted[Math.floor(sorted.length * pct / 100)] ?? sorted[sorted.length - 1];
  return {
    min: sorted[0],
    p50: p(50),
    p95: p(95),
    p99: p(99),
    max: sorted[sorted.length - 1],
    avg: Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
  };
}

async function runBatch(label, count, buildUrl) {
  console.log(`\n▶ ${label} — ${count} concurrent requests`);
  const promises = Array.from({ length: count }, (_, i) =>
    timed(`${label}#${i}`, () => fetch(buildUrl(i)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }))
  );
  const results = await Promise.all(promises);
  const failed = results.filter(r => !r.ok).length;
  const times  = results.filter(r => r.ok).map(r => r.ms);
  const s = stats(times);
  console.log(`  Success: ${results.length - failed}/${count}  |  Failed: ${failed}`);
  console.log(`  min=${s.min}ms  p50=${s.p50}ms  p95=${s.p95}ms  p99=${s.p99}ms  max=${s.max}ms  avg=${s.avg}ms`);
  return s;
}

async function main() {
  console.log('DC House Load Test');
  console.log('==================');
  console.log(`Target: ${BASE}`);
  console.log('');

  // ── 1. Cold read (no Vercel cache) ───────────────────────
  // Bust cache with unique ?t= per request so every request hits the origin
  await runBatch(
    'READ (cache-busted, worst case)',
    50,
    i => `${BASE}?key=${KEY}&t=${Date.now() + i}`
  );

  await sleep(2000);

  // ── 2. Warm read (all share same cache window) ───────────
  // Same timestamp → Vercel edge cache serves all but the first
  const sharedT = Date.now();
  await runBatch(
    'READ (shared cache, best case)',
    50,
    () => `${BASE}?key=${KEY}&t=${sharedT}`
  );

  await sleep(2000);

  // ── 3. Concurrent writes (car status toggle) ─────────────
  // Row 2 = first car; flip to "in" then back — use a non-existent row to avoid data corruption
  await runBatch(
    'WRITE (action=update, simulated)',
    10,  // keep low — Apps Script serializes writes
    i => `${BASE}?key=${KEY}&action=update&row=999&status=test_${i}`
  );

  await sleep(2000);

  // ── 4. logMember (reads Driver Freq + writes Members Log) ─
  await runBatch(
    'WRITE (action=logMember)',
    10,
    i => `${BASE}?key=${KEY}&action=logMember&carName=test&plate=TST-${i}&driver=tester&status=in&carIndex=0`
  );

  console.log('\n==================');
  console.log('BOTTLENECK ANALYSIS');
  console.log('==================');
  console.log(`
Expected findings:
  READ  cache-busted : ~400–1500ms each (each request hits Google Sheets)
  READ  shared cache : ~15–80ms each (Vercel CDN, only first hits Sheets)
  WRITE update       : ~400–2000ms each (Apps Script serializes them → last one = N × latency)
  WRITE logMember    : ~800–3000ms each (2 sequential Sheets ops per request)

Root bottlenecks (in order of impact):
  1. Google Apps Script execution: single-threaded, ~300–600ms per op
     → Concurrent writes pile up: 10 simultaneous = 10× latency for the last one
  2. Vercel cold start on first deploy/30min idle: +500–1500ms for first request
  3. No write caching: every toggle/log goes all the way to Sheets

What protects index.html (50 viewers):
  → s-maxage=25 on the GET endpoint: all 50 simultaneous reads = 1 Sheets call + 49 cache hits
  → Expected: ~50ms for 49 users, ~600ms for the unlucky first

What still hurts guard.html (guards doing toggles):
  → Each toggle = 2–3 Apps Script calls in sequence
  → If 3 guards toggle at once: ~1–2s each (manageable)
  → If all 10 slots toggle simultaneously: up to 6s for the last one
`);
}

main().catch(console.error);
