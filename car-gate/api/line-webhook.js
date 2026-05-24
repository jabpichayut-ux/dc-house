const crypto = require('crypto');

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const APP_URL = 'https://dc-house.vercel.app/index';
const TRIGGER = 'บ้านดำรงค์ชัย';

const MEMBERS = [
  { name: 'คุณดำรงค์',    code: 'DCH-DAM26' },
  { name: 'คุณกิตติ',     code: 'DCH-KIT26' },
  { name: 'คุณน้ำผึ้ง',   code: 'DCH-NAM26' },
  { name: 'คุณชรินทร์',   code: 'DCH-CHA26' },
  { name: 'คุณนิพนธ์',    code: 'DCH-NIP26' },
  { name: 'คุณเบญจมาศ',   code: 'DCH-BEN26' },
  { name: 'คุณนิทัศน์',   code: 'DCH-NIT26' },
  { name: 'คุณสุรีย์พร',  code: 'DCH-SUR26' },
  { name: 'คุณนิรันดร์',  code: 'DCH-NIR26' },
  { name: 'คุณศิริพร',    code: 'DCH-SIP26' },
  { name: 'คุณธีรพล',     code: 'DCH-THE26' },
  { name: 'คุณนิติพัทญ์', code: 'DCH-NTH26' },
  { name: 'คุณสญาค์มณท์', code: 'DCH-SAY26' },
  { name: 'คุณศิริเพ็ญ',  code: 'DCH-SPE26' },
  { name: 'คุณฟลุ๊ค',     code: 'DCH-FLK26' },
  { name: 'คุณเบล',       code: 'DCH-BEL26' },
  { name: 'คุณฝัน',       code: 'DCH-FUN26' },
  { name: 'คุณโบ๊ท',      code: 'DCH-BOT26' },
  { name: 'คุณแฟร์',      code: 'DCH-FAR26' },
  { name: 'คุณบีม',       code: 'DCH-BEM26' },
  { name: 'คุณจ๊อบ',      code: 'DCH-JOB26' },
  { name: 'คุณแบม',       code: 'DCH-BAM26' },
  { name: 'คุณแจ๊บ',      code: 'DCH-JAB26' },
  { name: 'คุณเจฟ',       code: 'DCH-JEF26' },
  { name: 'คุณเนย',       code: 'DCH-NEY26' },
  { name: 'คุณเจอาร์',    code: 'DCH-JR026' },
  { name: 'คุณมุก',       code: 'DCH-MUK26' },
  { name: 'คุณนอย',       code: 'DCH-NOY26' },
  { name: 'คุณเกรซ',      code: 'DCH-GRC26' },
  { name: 'คุณเจทู',      code: 'DCH-JT226' },
  { name: 'คุณลิสา',      code: 'DCH-LIS26' },
  { name: 'คุณแมกซ์',     code: 'DCH-MAX26' },
  { name: 'คุณทันญ่า',    code: 'DCH-TAN26' },
  { name: 'คุณมาร์ก',     code: 'DCH-MRK26' },
  { name: 'คุณแดนนี่',    code: 'DCH-DAN26' },
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
    if (event.type !== 'message' || event.message.type !== 'text') continue;
    const text = (event.message.text || '').trim();
    const replyToken = event.replyToken;

    // Trigger word → send numbered member list
    if (text === TRIGGER) {
      await replyMessage(replyToken, MEMBER_LIST);
      continue;
    }

    // Number 1–35 → send that member's code + deeplink (lid = LINE user ID)
    const lineUserId = event.source && event.source.userId ? event.source.userId : '';
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 1 && num <= MEMBERS.length && String(num) === text) {
      const m = MEMBERS[num - 1];
      const link = `${APP_URL}?code=${m.code}&lid=${encodeURIComponent(lineUserId)}`;
      await replyMessage(replyToken,
        `🏠 DC House\nรหัสเชิญของ${m.name}:\n📌 ${m.code}\n\nกดลิงก์เพื่อลงทะเบียน Face ID:\n${link}\n\n✨ ชื่อและรหัสจะถูกกรอกให้อัตโนมัติ\n🔔 ระบบแจ้งพัสดุจะถูกเปิดใช้งานอัตโนมัติ`
      );
      continue;
    }

    // Name match (partial) → send their code + deeplink
    const match = MEMBERS.find(m =>
      text.includes(m.name) || m.name.includes(text.replace(/^คุณ/, ''))
    );
    if (match) {
      const lineUserIdM = event.source && event.source.userId ? event.source.userId : '';
      const link = `${APP_URL}?code=${match.code}&lid=${encodeURIComponent(lineUserIdM)}`;
      await replyMessage(replyToken,
        `🏠 DC House\nรหัสเชิญของ${match.name}:\n📌 ${match.code}\n\nกดลิงก์เพื่อลงทะเบียน Face ID:\n${link}\n\n✨ ชื่อและรหัสจะถูกกรอกให้อัตโนมัติ\n🔔 ระบบแจ้งพัสดุจะถูกเปิดใช้งานอัตโนมัติ`
      );
    }
  }

  res.status(200).json({ ok: true });
};

handler.config = { api: { bodyParser: false } };
module.exports = handler;
