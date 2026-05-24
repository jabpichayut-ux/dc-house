const { readRange } = require('./_auth');
const SECRET = 'dc-house-2026';

// Module-level data cache — reduces cold-hit latency on warm Lambda instances
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 30 * 1000; // 30 s

// Parse "DD/MM/YYYY" (Buddhist Era) + "HH:MM" → Unix ms for correct chronological sort
function parseThaiTs(date, time) {
  const dp = (date || '').split('/');
  if (dp.length < 3) return 0;
  const day  = parseInt(dp[0]);
  const mon  = parseInt(dp[1]) - 1;
  const year = parseInt(dp[2]) - 543; // Buddhist Era → CE
  const tp   = (time || '').match(/(\d{1,2})[:.ː](\d{2})/);
  const hr   = tp ? parseInt(tp[1]) : 0;
  const mn   = tp ? parseInt(tp[2]) : 0;
  return new Date(year, mon, day, hr, mn).getTime();
}

function thaiDateOffsetDays(offset) {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

async function buildPayload() {
  const [carPark, membersLog, guestLog, driverFreq] = await Promise.all([
    readRange('Car Park!A1:D34'),
    readRange('Members Log!A:F'),
    readRange('Guest Log!A:F'),
    readRange('Driver Freq!A:C'),
  ]);

  const cars = carPark
    .filter(r => r[0] && !/^(ชื่อ|name)/i.test(r[0]))
    .map((r, i) => ({
      index: i,
      name: r[0],
      plate: r[1] || '',
      status: String(r[2] || '').toLowerCase().trim(),
      photo: r[3] || '',
    }));

  const carsIn  = cars.filter(c => c.status === 'in').length;
  const carsOut = cars.length - carsIn;

  const today = thaiDateOffsetDays(0);

  const memberRows = membersLog.filter(r => r[0] && /\d/.test(r[0]) && r.length >= 5);
  const guestRows  = guestLog.filter(r => r[0] && /\d/.test(r[0]) && r.length >= 5);

  const todayEntries = memberRows.filter(r => r[0] === today && r[5] === 'เข้า').length;
  const todayGuests  = guestRows.filter(r => r[0] === today && r[5] === 'เข้า').length;

  const hoursIn  = Array(24).fill(0);
  const hoursOut = Array(24).fill(0);
  memberRows.forEach(r => {
    const m = (r[1] || '').match(/^(\d{1,2})/);
    if (m) {
      const h = parseInt(m[1]);
      if (h >= 0 && h < 24) {
        if (r[5] === 'เข้า') hoursIn[h]++;
        else if (r[5] === 'ออก') hoursOut[h]++;
      }
    }
  });
  const peakHours = Array.from({ length: 19 }, (_, i) => ({
    hour: i + 5,
    in: hoursIn[i + 5],
    out: hoursOut[i + 5],
  }));

  const driversByCar = {};
  driverFreq.forEach(r => {
    if (!r[0] || !r[1] || !/^\d+$/.test(String(r[0]).trim())) return;
    const k = String(r[0]).trim();
    if (!driversByCar[k]) driversByCar[k] = [];
    driversByCar[k].push({ driver: r[1], count: parseInt(r[2]) || 0 });
  });
  Object.keys(driversByCar).forEach(k => {
    driversByCar[k].sort((a, b) => b.count - a.count);
    driversByCar[k] = driversByCar[k].slice(0, 3);
  });

  const guestMap = {};
  guestRows.forEach(r => {
    if (r[5] !== 'เข้า') return;
    const plate   = (r[2] || '').trim();
    const name    = (r[3] || 'ไม่ระบุ').trim();
    const guestOf = (r[4] || '').trim();
    const k = plate || name;
    if (!guestMap[k]) guestMap[k] = { plate, name, guestOf, count: 0 };
    guestMap[k].count++;
  });
  const frequentGuests = Object.values(guestMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const recentM = memberRows.slice(-30).map(r => ({
    type: 'member', date: r[0], time: r[1] || '',
    name: r[4] || r[2], carName: r[2], plate: r[3], direction: r[5] || '',
  }));
  const recentG = guestRows.slice(-15).map(r => ({
    type: 'guest', date: r[0], time: r[1] || '',
    name: r[3] || 'แขก', plate: r[2], guestOf: r[4] || '', direction: r[5] || '',
  }));
  const recent = [...recentM, ...recentG]
    .sort((a, b) => parseThaiTs(b.date, b.time) - parseThaiTs(a.date, a.time))
    .slice(0, 15);

  const dailyTrend = Array.from({ length: 7 }, (_, i) => {
    const label = thaiDateOffsetDays(i - 6);
    return {
      label,
      members: memberRows.filter(r => r[0] === label && r[5] === 'เข้า').length,
      guests:  guestRows.filter(r => r[0] === label && r[5] === 'เข้า').length,
    };
  });

  return {
    cars, carsIn, carsOut,
    todayEntries, todayGuests,
    peakHours, driversByCar, frequentGuests,
    recent, dailyTrend,
    updated: new Date().toISOString(),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { key } = req.query;
  if (key !== SECRET) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (_cache && Date.now() - _cacheAt < CACHE_TTL) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
      return res.json(_cache);
    }

    const payload = await buildPayload();
    _cache   = payload;
    _cacheAt = Date.now();

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.json(payload);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
