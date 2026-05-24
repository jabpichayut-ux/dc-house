const { readRange } = require('./_auth');

const SECRET     = 'dc-house-2026';
const LINE_TOKEN = '7TEnqDtU6W9k1N17pCgjAHX8uhSuR9IN9finzj4aa1LctoS3DBiVvr/S/yjwgwQ1wrfKIMfLcL0KtyujVVxaNbXkr0ZLcwtEr30Af4QJ1WTnrUyG4Pyo22Dn+CpLp4LjZ1rxcJIE0JciHa8J74iWngdB04t89/1O/w1cDnyilFU=';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtmuGIo4fC39uG4uslI26utMh0Fc0F_teaoJrwVY_hRnG2w8tCi0nMPhDGzk3bueyLyw/exec';

async function writeRange(range, values) {
  const row = range.split('!C')[1];
  const status = values[0][0];
  await fetch(`${APPS_SCRIPT_URL}?key=${SECRET}&action=update&row=${row}&status=${status}`);
}

async function appendRange(sheetName, values) {
  const params = new URLSearchParams({
    key: SECRET,
    action: 'appendRow',
    sheet: sheetName,
    values: JSON.stringify(values)
  });
  await fetch(`${APPS_SCRIPT_URL}?${params}`);
}

function thaiDate() {
  return new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });
}
function thaiTime() {
  return new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { key, action, row, status, driver, carName, plate, guestName, guestOf, carIndex } = req.query;
  if (key !== SECRET) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (action === 'update') {
      const result = await writeRange(`Car Park!C${row}`, [[status]]);
      if (result && result.error) throw new Error(result.error.message);
      return res.json({ success: true });
    }

    if (action === 'logMember') {
      const reason = req.query.reason || '';
      await appendRange('Members Log', [thaiDate(), thaiTime(), carName, plate, driver, status === 'in' ? 'เข้า' : 'ออก', reason]);
      try {
        const fd = await readRange('Driver Freq!A:C');
        const idx = fd.findIndex(r => r[0] === carIndex && r[1] === driver);
        if (idx >= 0) {
          await writeRange(`Driver Freq!C${idx+1}`, [[(parseInt(fd[idx][2])||0)+1]]);
        } else {
          await appendRange('Driver Freq', [carIndex, driver, 1]);
        }
      } catch(e) {}
      return res.json({ success: true });
    }

    if (action === 'logGuest') {
      const reason = req.query.reason || '';
      await appendRange('Guest Log', [thaiDate(), thaiTime(), plate, guestName, guestOf, status === 'in' ? 'เข้า' : 'ออก', reason]);
      return res.json({ success: true });
    }

    if (action === 'getFrequency') {
      const fd = await readRange('Driver Freq!A:C');
      return res.json({ frequencies: fd.filter(r => r[0] === carIndex).map(r => ({ name: r[1], count: parseInt(r[2])||0 })).sort((a,b) => b.count-a.count) });
    }

    if (action === 'getMembers') {
      const data = await readRange('Members!A1:B100');
      const rows = data.slice(1).filter(r => r[0]);
      // Deduplicate by name — prefer the row that has a LINE ID
      const map = new Map();
      for (const r of rows) {
        const name = r[0], uid = r[1] || '';
        if (!map.has(name) || uid) map.set(name, { name, userId: uid });
      }
      return res.json({ members: [...map.values()] });
    }

    if (action === 'registerMember') {
      const { memberName, lineUserId } = req.query;
      if (!memberName) return res.status(400).json({ error: 'Missing memberName' });
      const existing = await readRange('Members!A:B');
      if (lineUserId) {
        // Already stored with this exact LINE ID → skip
        if (existing.some(r => r[0] === memberName && r[1] === lineUserId)) {
          return res.json({ success: true, new: false });
        }
        // Append new row with LINE ID (deduplication on read handles any old nameless rows)
      } else {
        // No LINE ID — only skip if the name is already there at all
        if (existing.some(r => r[0] === memberName)) {
          return res.json({ success: true, new: false });
        }
      }
      await appendRange('Members', [memberName, lineUserId || '']);
      return res.json({ success: true, new: true });
    }

    if (action === 'notify') {
      const { userId, name, quantity } = req.query;
      const msg = `📦 DC House — พัสดุมาถึงแล้วค่ะ!\n\nเรียน คุณ${name}\nพัสดุของคุณมาถึงแล้ว จำนวน ${quantity} ชิ้น\n\nกรุณามารับที่ห้องยามได้เลยค่ะ 🏠`;
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LINE_TOKEN },
        body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: msg }] })
      });
      return res.json({ success: true });
    }

    const data = await readRange('Car Park!A1:D34');
    const cars = data
      .map((r, i) => (!r[0] || /^(ชื่อ|name)/i.test(r[0])) ? null : {
        name: r[0], plate: r[1]||'', status: String(r[2]||'').toLowerCase().trim(), photo: r[3]||'',
        row: i + 1  // actual 1-based sheet row — used by guard.html for status updates
      })
      .filter(Boolean);
    res.setHeader('Cache-Control', 's-maxage=8');
    return res.json({ cars, updated: new Date().toISOString() });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
