const { readRange } = require('./_auth');

const SECRET       = 'dc-house-2026';
const LINE_TOKEN   = '7TEnqDtU6W9k1N17pCgjAHX8uhSuR9IN9finzj4aa1LctoS3DBiVvr/S/yjwgwQ1wrfKIMfLcL0KtyujVVxaNbXkr0ZLcwtEr30Af4QJ1WTnrUyG4Pyo22Dn+CpLp4LjZ1rxcJIE0JciHa8J74iWngdB04t89/1o/w1cDnyilFU=';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtmuGIo4fC39uG4uslI26utMh0Fc0F_teaoJrwVY_hRnG2w8tCi0nMPhDGzk3bueyLyw/exec';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function appendToSheet(sheet, values) {
  const params = new URLSearchParams({
    key: SECRET,
    action: 'appendRow',
    sheet,
    values: JSON.stringify(values),
  });
  await fetch(`${APPS_SCRIPT_URL}?${params}`);
}

function thaiTime() {
  return new Date().toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isKitchenAutoOpen() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const day  = now.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const hour = now.getHours();
  const min  = now.getMinutes();
  const mins = hour * 60 + min;
  if (day === 0) return false; // Sunday closed
  // Mon–Sat (1–6)
  return (mins >= 11 * 60 && mins < 14 * 60) || (mins >= 17 * 60 && mins < 20 * 60);
}

async function uploadToImgBB(base64) {
  const IMGBB_KEY = process.env.IMGBB_API_KEY;
  if (!IMGBB_KEY) return null;
  try {
    const form = new URLSearchParams();
    form.append('key', IMGBB_KEY);
    form.append('image', base64);
    const r = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const d = await r.json();
    return d.success ? d.data.url : null;
  } catch {
    return null;
  }
}

async function pushLine(to, messages) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({ to, messages }),
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { key, action } = req.query;
  if (key !== SECRET) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // ── placeOrder (GET) ─────────────────────────────────────────────────────
    if (action === 'placeOrder' && req.method === 'GET') {
      const { name, userId, menu } = req.query;
      if (!name || !menu) return res.status(400).json({ error: 'Missing name or menu' });

      const orderId = String(Date.now());
      const time    = thaiTime();

      await appendToSheet('Food Orders', [orderId, name, userId || '', menu, time]);

      if (userId) {
        await pushLine(userId, [{
          type: 'text',
          text: `✅ รับออเดอร์แล้วค่ะ!\nเมนู: ${menu}\nเวลา: ${time}\n\nรอสักครู่นะคะ 🍳`,
        }]);
      }

      return res.json({ success: true, orderId });
    }

    // ── getQueue (GET) ───────────────────────────────────────────────────────
    if (action === 'getQueue') {
      const [orders, done] = await Promise.all([
        readRange('Food Orders!A:E'),
        readRange('Food Orders Done!A:B'),
      ]);

      // Collect orderIds in the Done sheet (column B = index 1)
      const doneIds = new Set(done.map(r => r[1]).filter(Boolean));

      const pending = orders
        .filter(r => r[0] && !doneIds.has(r[0])) // has orderId and not done
        .map(r => ({
          id:     r[0] || '',
          name:   r[1] || '',
          userId: r[2] || '',
          menu:   r[3] || '',
          time:   r[4] || '',
        }));

      return res.json({ success: true, orders: pending });
    }

    // ── getKitchenStatus (GET) ───────────────────────────────────────────────
    if (action === 'getKitchenStatus') {
      const autoOpen = isKitchenAutoOpen();
      let status = autoOpen ? 'open' : 'closed';
      let message = '';
      let overridden = false;

      try {
        const rows = await readRange('Kitchen Status!A:D');
        if (rows.length > 0) {
          const last = rows[rows.length - 1];
          const expiresAt = last[3] ? parseInt(last[3], 10) : 0;
          const isExpired = expiresAt && Date.now() > expiresAt;

          if (!isExpired && last[1]) {
            status     = last[1]; // 'open' or 'closed'
            message    = last[2] || '';
            overridden = true;
          }
        }
      } catch { /* no override row — use auto */ }

      return res.json({ success: true, status, message, autoOpen, overridden });
    }

    // ── setKitchenStatus (GET) ───────────────────────────────────────────────
    if (action === 'setKitchenStatus') {
      const { status, message, expiresHours } = req.query;
      if (!status) return res.status(400).json({ error: 'Missing status' });

      const expiresAt = expiresHours && parseFloat(expiresHours) > 0
        ? String(Date.now() + parseFloat(expiresHours) * 3600 * 1000)
        : '';

      await appendToSheet('Kitchen Status', [
        new Date().toISOString(),
        status,
        message || '',
        expiresAt,
      ]);

      return res.json({ success: true });
    }

    // ── notifyAbsence (GET) ──────────────────────────────────────────────────
    if (action === 'notifyAbsence') {
      const { date, message } = req.query;
      const members = await readRange('Members!A1:B100');
      const defaultMsg = date
        ? `ป้าลาวันที่ ${date} ขออภัยในความไม่สะดวกนะคะ`
        : 'ป้าลาวันนี้ ขออภัยในความไม่สะดวกนะคะ';
      const text = `🏠 DC House — แจ้งจากครัวค่ะ\n\n${message || defaultMsg}\n\nหากมีคำถามกรุณาติดต่อยามค่ะ`;

      let notified = 0;
      for (const r of members) {
        const userId = r[1];
        if (userId) {
          try {
            await pushLine(userId, [{ type: 'text', text }]);
            notified++;
          } catch { /* skip failed pushes */ }
        }
      }

      return res.json({ success: true, notified });
    }

    // ── completeOrder (POST) ─────────────────────────────────────────────────
    if (action === 'completeOrder' && req.method === 'POST') {
      let body;
      try {
        body = JSON.parse((await getRawBody(req)).toString());
      } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
      }

      const { orderId, userId, menu, imageData } = body;
      if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

      let imageUrl = null;
      if (imageData) {
        imageUrl = await uploadToImgBB(imageData);
      }

      if (userId) {
        const msgs = [{ type: 'text', text: `🍱 อาหารพร้อมแล้วค่ะ!\nเมนู: ${menu || ''}` }];
        if (imageUrl) {
          msgs.push({ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl });
        }
        await pushLine(userId, msgs);
      }

      await appendToSheet('Food Orders Done', [new Date().toISOString(), orderId]);

      return res.json({ success: true, imageUrl });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
