// Supabase PostgREST helper — no npm package, uses Node.js fetch
const BASE = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(extra = {}) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...extra };
}

async function req(method, table, qs, body, extra = {}) {
  const url = `${BASE}/rest/v1/${table}${qs ? '?' + qs : ''}`;
  const r = await fetch(url, {
    method,
    headers: headers(extra),
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${table}: ${r.status} — ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

module.exports = {
  isConfigured: () => !!(BASE && KEY),
  select: (table, qs = '')          => req('GET',   table, qs,     null),
  insert: (table, rows)             => req('POST',  table, '',     Array.isArray(rows) ? rows : [rows], { Prefer: 'return=minimal' }),
  update: (table, filter, data)     => req('PATCH', table, filter, data, { Prefer: 'return=minimal' }),
  upsert: (table, rows, onConflict) => req('POST',  table, onConflict ? `on_conflict=${onConflict}` : '', Array.isArray(rows) ? rows : [rows], { Prefer: 'return=minimal,resolution=merge-duplicates' }),
};
