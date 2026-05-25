const crypto = require('crypto');

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

// Registration is closed — links must be shared directly by admin
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
  { name: 'คุณชานน เเจ๊บ',         code: 'DCH-JAB26' },
  { name: 'คุณพิชญุตม์ เจฟ',       code: 'DCH-JEF26' },
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

  // Registration closed — webhook accepts events for LINE platform health checks only

  res.status(200).json({ ok: true });
};

handler.config = { api: { bodyParser: false } };
module.exports = handler;
