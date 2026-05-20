const SHEET_ID  = '1CMSqYFS352rIKXW0x0ZeEbtNjiBB1sOvMMI9linioLg';
const API_KEY   = 'AIzaSyD8AvaVO0uYS_pDNBmQx5DYLaB0j8dIZo0';
const SECRET    = 'dc-house-2026';
const LINE_TOKEN = '7TEnqDtU6W9k1N17pCgjAHX8uhSuR9IN9finzj4aa1LctoS3DBiVvr/S/yjwgwQ1wrfKIMfLcL0KtyujVVxaNbXkr0ZLcwtEr30Af4QJ1WTnrUyG4Pyo22Dn+CpLp4LjZ1rxcJIE0JciHa8J74iWngdB04t89/1O/w1cDnyilFU=';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { key, action, row, status, userId, name, quantity } = req.query;

  if (key !== SECRET) return res.status(401).json({ error: 'Unauthorized' });

  // ── Update car status ──
  if (action === 'update') {
    const sheets = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Car%20Park!C${row}?key=${API_KEY}`;
    await fetch(sheets, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ range: `Car Park!C${row}`, majorDimension: 'ROWS', values: [[status]] })
    });
    return res.json({ success: true });
  }

  // ── Get members ──
  if (action === 'getMembers') {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Members!A1:B100?key=${API_KEY}`;
    const r   = await fetch(url);
    const d   = await r.json();
    const members = (d.values || []).slice(1)
      .filter(r => r[0] && r[1])
      .map(r => ({ name: r[0], userId: r[1] }));
    return res.json({ members });
  }

  // ── Send notification ──
  if (action === 'notify') {
    const msg = `📦 DC House — พัสดุมาถึงแล้วค่ะ!\n\nเรียน คุณ${name}\nพัสดุของคุณมาถึงแล้ว จำนวน ${quantity} ชิ้น\n\nกรุณามารับที่ห้องยามได้เลยค่ะ 🏠`;
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LINE_TOKEN },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: msg }] })
    });
    return res.json({ success: true });
  }

  // ── Default: return all cars ──
  const url  = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Car%20Park!A1:D34?key=${API_KEY}`;
  const r    = await fetch(url);
  const d    = await r.json();
  const cars = (d.values || [])
    .filter(r => r[0])
    .map(r => ({
      name:   r[0],
      plate:  r[1] || '',
      status: String(r[2] || '').toLowerCase().trim(),
      photo:  r[3] || ''
    }));

  return res.json({ cars, updated: new Date().toISOString() });
}
