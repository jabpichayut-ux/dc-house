// One-time migration: Google Sheets → Supabase
// Call: GET /api/migrate?key=dc-house-2026
// Add ?force=1 to re-run and overwrite existing data
const { readRange } = require('./_auth');
const sb = require('./_supabase');

const SECRET = 'dc-house-2026';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { key, force } = req.query;
  if (key !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!sb.isConfigured()) return res.status(503).json({ error: 'Supabase env vars not set — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Vercel' });

  try {
    if (!force) {
      const existing = await sb.select('cars', 'select=id&limit=1');
      if (existing.length > 0) {
        return res.status(409).json({ error: 'cars table already has data — add ?force=1 to overwrite' });
      }
    }

    const [carParkData, membersData] = await Promise.all([
      readRange('Car Park!A1:D50'),
      readRange('Members!A:B'),
    ]);

    const cars = carParkData
      .map((r, i) => ({ r, rowNum: i + 1 }))
      .filter(({ r }) => r[0] && !/^(ชื่อ|name)/i.test(r[0]))
      .map(({ r, rowNum }) => ({
        row_num: rowNum,
        name:    r[0],
        plate:   r[1] || '',
        status:  String(r[2] || '').toLowerCase().trim() || 'out',
        photo:   r[3] || '',
      }));

    if (cars.length > 0) {
      force ? await sb.upsert('cars', cars, 'row_num') : await sb.insert('cars', cars);
    }

    const seen = new Set();
    const members = membersData
      .slice(1)
      .filter(r => r[0] && !seen.has(r[0]) && seen.add(r[0]))
      .map(r => ({ name: r[0], line_user_id: r[1] || '' }));

    if (members.length > 0) {
      force ? await sb.upsert('members', members, 'name') : await sb.insert('members', members);
    }

    return res.json({ success: true, cars: cars.length, members: members.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
