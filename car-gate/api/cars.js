const SHEET_ID   = '1CMSqYFS352rIKXW0x0ZeEbtNjiBB1sOvMMI9linioLg';
const API_KEY    = 'AIzaSyD8AvaVO0uYS_pDNBmQx5DYLaB0j8dIZo0';
const SECRET     = 'dc-house-2026';
const LINE_TOKEN = '7TEnqDtU6W9k1N17pCgjAHX8uhSuR9IN9finzj4aa1LctoS3DBiVvr/S/yjwgwQ1wrfKIMfLcL0KtyujVVxaNbXkr0ZLcwtEr30Af4QJ1WTnrUyG4Pyo22Dn+CpLp4LjZ1rxcJIE0JciHa8J74iWngdB04t89/1O/w1cDnyilFU=';

/* ── Get Google OAuth token from Service Account ── */
async function getAccessToken(serviceAccount) {
  const now   = Math.floor(Date.now() / 1000);
  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const payload = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

  const signingInput = `${header}.${payload}`;

  // Import private key
  const pemKey = serviceAccount.private_key;
  const pemBody = pemKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const keyBuffer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBuffer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(signingInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

  const jwt = `${signingInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

/* ── Append a row to a sheet ── */
async function appendRow(token, sheetName, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] })
  });
}

/* ── Write single cell ── */
async function writeCell(token, range, value) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values: [[value]] })
  });
}

/* ── Read a sheet range ── */
async function readRange(range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  return d.values || [];
}

/* ── Thai date/time helpers ── */
function thaiDate() {
  return new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });
}
function thaiTime() {
  return new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { key, action, row, status, driver, carName, plate, guestName, guestOf, carIndex } = req.query;

  if (key !== SECRET) return res.status(401).json({ error: 'Unauthorized' });

  // ── Parse Service Account ──
  let serviceAccount = null;
  try {
    serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  } catch(e) {
    // write actions will fail gracefully
  }

  // ── Update car status ──
  if (action === 'update') {
    const token = await getAccessToken(serviceAccount);
    await writeCell(token, `Car Park!C${row}`, status);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true });
  }

  // ── Log member car in/out (with driver name) ──
  if (action === 'logMember') {
    const token = await getAccessToken(serviceAccount);
    await appendRow(token, 'Member Log', [
      thaiDate(), thaiTime(), carName, plate, driver, status === 'in' ? 'เข้า' : 'ออก'
    ]);
    // Update frequency: read Driver Freq sheet, increment count for this car+driver
    try {
      const freqData = await readRange('Driver Freq!A:D');
      const idx = freqData.findIndex(r => r[0] === carIndex && r[1] === driver);
      if (idx >= 0) {
        const newCount = (parseInt(freqData[idx][2]) || 0) + 1;
        await writeCell(token, `Driver Freq!C${idx + 1}`, newCount);
      } else {
        await appendRow(token, 'Driver Freq', [carIndex, driver, 1]);
      }
    } catch(e) { /* freq tracking non-critical */ }
    return res.json({ success: true });
  }

  // ── Log guest car in/out ──
  if (action === 'logGuest') {
    const token = await getAccessToken(serviceAccount);
    await appendRow(token, 'Guest Log', [
      thaiDate(), thaiTime(), plate, guestName, guestOf, status === 'in' ? 'เข้า' : 'ออก'
    ]);
    return res.json({ success: true });
  }

  // ── Get driver frequency for a car (for popup ordering) ──
  if (action === 'getFrequency') {
    try {
      const freqData = await readRange('Driver Freq!A:C');
      const carFreqs = freqData
        .filter(r => r[0] === carIndex)
        .map(r => ({ name: r[1], count: parseInt(r[2]) || 0 }))
        .sort((a, b) => b.count - a.count);
      return res.json({ frequencies: carFreqs });
    } catch(e) {
      return res.json({ frequencies: [] });
    }
  }

  // ── Get members list ──
  if (action === 'getMembers') {
    const data = await readRange('Members!A1:B100');
    const members = data.slice(1)
      .filter(r => r[0] && r[1])
      .map(r => ({ name: r[0], userId: r[1] }));
    return res.json({ members });
  }

  // ── Send notification ──
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

  // ── Default: return all cars ──
  const data = await readRange('Car Park!A1:D34');
  const cars = data
    .filter(r => r[0])
    .map(r => ({
      name:   r[0],
      plate:  r[1] || '',
      status: String(r[2] || '').toLowerCase().trim(),
      photo:  r[3] || ''
    }));

  res.setHeader('Cache-Control', 's-maxage=25, stale-while-revalidate');
  return res.json({ cars, updated: new Date().toISOString() });
}
