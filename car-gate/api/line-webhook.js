const crypto = require('crypto');

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, signature) {
  if (!CHANNEL_SECRET) return true;
  const hash = crypto.createHmac('SHA256', CHANNEL_SECRET).update(rawBody).digest('base64');
  return hash === signature;
}

async function replyMessage(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
}

const handler = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-line-signature'] || '';

  if (!verifySignature(rawBody, signature)) return res.status(401).json({ error: 'Invalid signature' });

  let body;
  try { body = JSON.parse(rawBody.toString()); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  for (const event of (body.events || [])) {
    const replyToken = event.replyToken;
    const src        = event.source || {};
    const lineUserId = src.userId || '';
    const groupId    = src.groupId || '';

    if (event.type === 'join' && src.type === 'group') {
      await replyMessage(replyToken, `✅ DC House bot เข้ากลุ่มแล้วค่ะ!\n\nGroup ID:\n${groupId}`);
      continue;
    }

    if (event.type !== 'message') continue;
    if (src.type === 'group' || src.type === 'room') continue;
    if (event.message.type !== 'text') continue;

  }

  res.status(200).json({ ok: true });
};

handler.config = { api: { bodyParser: false } };
module.exports = handler;
