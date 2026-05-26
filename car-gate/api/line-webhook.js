const crypto = require('crypto');
const { readRange } = require('./_auth');

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const CHEF_GROUP_ID = process.env.CHEF_GROUP_ID || '';
const APP_URL = 'https://dc-house.vercel.app/index';
const TRIGGER = 'บ้านดำรงค์ชัย';

const SECRET = 'dc-house-2026';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtmuGIo4fC39uG4uslI26utMh0Fc0F_teaoJrwVY_hRnG2w8tCi0nMPhDGzk3bueyLyw/exec';

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

// In-memory order queue: ordererUserId → { orderText, step }
// Note: cleared on cold start (acceptable for family use)
const orderSessions = new Map();

const MEMBERS = [
  { name: 'คุณดำรงค์',              code: 'DCH-DAM26' },
  { name: 'คุณกิตติ',               code: 'DCH-KIT26' },
  { name: 'คุณน้ำผึ้ง',             code: 'DCH-NAM26' },
  { name: 'คุณชรินทร์',             code: 'DCH-CHA26' },
  { name: 'คุณนิพนธ์',              code: 'DCH-NIP26' },
  { name: 'คุณเบญจมาศ',             code: 'DCH-BEN26' },
  { name: 'คุณนิทัศน์',             code: 'DCH-NIT26' },
  { name: 'คุณสุรีย์พร',            code: 'DCH-SUR26' },
  { name: 'คุณนิรันดร์',            code: 'DCH-NIR26' },
  { name: 'คุณศิริพร',              code: 'DCH-SIP26' },
  { name: 'คุณธีรพล',               code: 'DCH-THE26' },
  { name: 'คุณนิติพัทญ์',           code: 'DCH-NTH26' },
  { name: 'คุณสญาค์มณท์',           code: 'DCH-SAY26' },
  { name: 'คุณศิริเพ็ญ',            code: 'DCH-SPE26' },
  { name: 'คุณณัชชา ฟลุ๊ค',        code: 'DCH-FLK26' },
  { name: 'คุณศรัณย์ญา เบล',       code: 'DCH-BEL26' },
  { name: 'คุณณัฐธิดา ฝัน',        code: 'DCH-FUN26' },
  { name: 'คุณญาณินท์ โบ๊ท',       code: 'DCH-BOT26' },
  { name: 'คุณณัฐฐินี เเฟร์',      code: 'DCH-FAR26' },
  { name: 'คุณติณณภพ บีม',         code: 'DCH-BEM26' },
  { name: 'คุณจิรายุ จ๊อบ',        code: 'DCH-JOB26' },
  { name: 'คุณนิชกานต์ เเบม',      code: 'DCH-BAM26' },
  { name: 'คุณพิชญุตม์ เเจ๊บบี้',   code: 'DCH-JAB26' },
  { name: 'คุณชานน เจฟ',           code: 'DCH-JEF26' },
  { name: 'คุณชาลิสา เนย',         code: 'DCH-NEY26' },
  { name: 'คุณศิววงศ์ เจอาร์',     code: 'DCH-JR026' },
  { name: 'คุณภูษณิศา มุก',        code: 'DCH-MUK26' },
  { name: 'คุณพัทธ์ธีญา เกรซ',     code: 'DCH-GRC26' },
  { name: 'คุณพริสา นอยนอย',       code: 'DCH-NOY26' },
  { name: 'คุณณภัทร์ เจทู',        code: 'DCH-JT226' },
  { name: 'คุณเมญ์ลิสษา ลิสา',     code: 'DCH-LIS26' },
  { name: 'คุณสุวพัฎช์ เเมกซ์',    code: 'DCH-MAX26' },
  { name: 'คุณธัญยธรณ์ ธัญญา',     code: 'DCH-TAN26' },
  { name: 'คุณชินพัฒศ์ มาร์ค',     code: 'DCH-MRK26' },
  { name: 'คุณแดนนธีรรุ์ แดนนี่',  code: 'DCH-DAN26' },
  { name: 'คุณกุณฑิกา วาวา',       code: 'DCH-WAW26' },
  { name: 'คุณพชร พีท',            code: 'DCH-PIT26' },
  { name: 'คุณณัฐพงศ์ ณัฐ',        code: 'DCH-NTP26' },
  { name: 'คุณแมธธิว แมธ',         code: 'DCH-MTW26' },
  { name: 'คุณบุณยวีร์ แอ๋ม',      code: 'DCH-AEM26' },
];

// Build lookup list text (sent when trigger word received)
const MEMBER_LIST = '🏠 บ้านดำรงค์ชัย — รหัสเชิญ\n\n'
  + 'พิมพ์หมายเลขของคุณ:\n'
  + MEMBERS.map((m, i) => `${i + 1}. ${m.name}`).join('\n')
  + '\n\n(ตอบกลับด้วยตัวเลข เช่น "3" สำหรับคุณน้ำผึ้ง)';

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, signature) {
  if (!CHANNEL_SECRET) return true; // skip verification if secret not configured
  const hash = crypto.createHmac('SHA256', CHANNEL_SECRET)
    .update(rawBody).digest('base64');
  return hash === signature;
}

async function replyMessage(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}

async function pushMessages(to, messages) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
}

async function downloadLineContent(messageId) {
  const r = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
  });
  const buf = await r.arrayBuffer();
  return Buffer.from(buf);
}

async function uploadToImgBB(buffer) {
  const IMGBB_KEY = process.env.IMGBB_API_KEY;
  if (!IMGBB_KEY) return null;
  const form = new URLSearchParams();
  form.append('key', IMGBB_KEY);
  form.append('image', buffer.toString('base64'));
  const r = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const d = await r.json();
  return d.success ? d.data.url : null;
}

const handler = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-line-signature'] || '';

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let body;
  try { body = JSON.parse(rawBody.toString()); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  for (const event of (body.events || [])) {
    const replyToken = event.replyToken;
    const src = event.source || {};
    const lineUserId = src.userId || '';
    const groupId    = src.groupId || '';

    // ── Bot added to group → reply with groupId for env var setup ──
    if (event.type === 'join' && src.type === 'group') {
      await replyMessage(replyToken,
        `✅ DC House bot เข้ากลุ่มแล้วค่ะ!\n\nGroup ID:\n${groupId}\n\nกรุณาตั้งค่า CHEF_GROUP_ID=${groupId} ใน Vercel แล้ว redeploy ด้วยนะคะ`);
      continue;
    }

    if (event.type !== 'message') continue;

    // ── Image from chef's group → push food-ready only to orderer(s) ──
    if (event.message.type === 'image' && CHEF_GROUP_ID && groupId === CHEF_GROUP_ID) {
      const pending = [...orderSessions.entries()].filter(([, s]) => s.step === 'pending_chef');
      if (pending.length > 0) {
        try {
          const buf = await downloadLineContent(event.message.id);
          const imageUrl = await uploadToImgBB(buf);
          for (const [ordererUserId, s] of pending) {
            const msgs = [{ type: 'text', text: `🍱 อาหารพร้อมแล้วค่ะ!\nเมนู: ${s.orderText}` }];
            if (imageUrl) msgs.push({ type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl });
            await pushMessages(ordererUserId, msgs);
            orderSessions.delete(ordererUserId);
          }
          await replyMessage(replyToken, `✅ ส่งรูปอาหารถึงผู้สั่งแล้วค่ะ (${pending.length} คน) 🍱`);
        } catch { /* fail silently */ }
      }
      continue;
    }

    // Ignore all other group messages (don't respond in group to avoid noise)
    if (src.type === 'group' || src.type === 'room') continue;

    if (event.message.type !== 'text') continue;
    const text = (event.message.text || '').trim();

    // ── Food ordering: "สั่งอาหาร" trigger ──
    if (text === 'สั่งอาหาร') {
      orderSessions.set(lineUserId, { step: 'awaiting_order' });
      await replyMessage(replyToken, 'กรุณาพิมพ์รายการอาหารที่ต้องการค่ะ 🍱');
      continue;
    }

    const orderSession = orderSessions.get(lineUserId);

    // ── 5-minute edit window: cancel or add note ──
    if (orderSession && orderSession.step === 'editable') {
      const isExpired = Date.now() > orderSession.expiresAt;

      if (isExpired) {
        // Window closed — treat as a new message, fall through
        orderSessions.delete(lineUserId);
      } else if (text === 'ยกเลิก') {
        // Cancel the order
        try {
          await appendToSheet('Food Orders Done', [new Date().toISOString(), orderSession.orderId, 'cancelled']);
        } catch { /* fail silently */ }
        orderSessions.delete(lineUserId);
        await replyMessage(replyToken, `❌ ยกเลิกออเดอร์แล้วค่ะ\nเมนู: ${orderSession.orderText}`);
        continue;
      } else {
        // Append note
        try {
          await appendToSheet('Food Order Notes', [orderSession.orderId, text, thaiTime()]);
        } catch { /* fail silently */ }
        await replyMessage(replyToken, `📝 รับโน้ตแล้วค่ะ: ${text}\n\n(พิมพ์ "ยกเลิก" เพื่อยกเลิกออเดอร์)`);
        continue;
      }
    }

    // ── Food ordering: user sends order text ──
    if (orderSession && orderSession.step === 'awaiting_order') {
      // Look up member name from Members sheet
      let memberName = '';
      try {
        const members = await readRange('Members!A:B');
        const row = members.find(r => r[1] === lineUserId);
        if (row) memberName = row[0];
      } catch { /* fall back to empty name */ }

      // Write order to Food Orders sheet
      const orderId = String(Date.now());
      const time    = thaiTime();
      const expiresAt = Date.now() + 5 * 60 * 1000;
      try {
        await appendToSheet('Food Orders', [orderId, memberName, lineUserId, text, time]);
      } catch { /* fail silently */ }

      orderSessions.set(lineUserId, { step: 'editable', orderId, orderText: text, expiresAt });

      await replyMessage(replyToken, `✅ รับออเดอร์แล้วค่ะ!\nเมนู: ${text}\n\nรอสักครู่นะคะ 🍳\n\n📝 มี 5 นาที ถ้าต้องการเพิ่มโน้ต หรือพิมพ์ "ยกเลิก" เพื่อยกเลิกออเดอร์ค่ะ`);
      continue;
    }

    // Trigger word → send numbered member list
    if (text === TRIGGER) {
      await replyMessage(replyToken, MEMBER_LIST);
      continue;
    }

    // Number 1–40 → send that member's code + deeplink (lid = LINE user ID)
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1 && num <= MEMBERS.length && String(num) === text) {
      const m = MEMBERS[num - 1];
      const link = `${APP_URL}?code=${m.code}&lid=${encodeURIComponent(lineUserId)}`;
      await replyMessage(replyToken,
        `🏠 DC House\nรหัสเชิญของ${m.name}:\n📌 ${m.code}\n\nกดลิงก์เพื่อลงทะเบียน:\n${link}\n\n✨ ชื่อและรหัสจะถูกกรอกให้อัตโนมัติ\n🔔 ระบบแจ้งพัสดุจะถูกเปิดใช้งานอัตโนมัติ`
      );
      continue;
    }

    // Name match (partial) → send their code + deeplink
    const match = MEMBERS.find(m =>
      text.includes(m.name) || m.name.includes(text.replace(/^คุณ/, ''))
    );
    if (match) {
      const link = `${APP_URL}?code=${match.code}&lid=${encodeURIComponent(lineUserId)}`;
      await replyMessage(replyToken,
        `🏠 DC House\nรหัสเชิญของ${match.name}:\n📌 ${match.code}\n\nกดลิงก์เพื่อลงทะเบียน:\n${link}\n\n✨ ชื่อและรหัสจะถูกกรอกให้อัตโนมัติ\n🔔 ระบบแจ้งพัสดุจะถูกเปิดใช้งานอัตโนมัติ`
      );
    }
  }

  res.status(200).json({ ok: true });
};

handler.config = { api: { bodyParser: false } };
module.exports = handler;
