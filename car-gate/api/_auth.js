// Google Service Account JWT auth — no npm, uses Node.js built-in crypto
// Falls back to API_KEY when GOOGLE_CREDENTIALS env var is not set

const crypto = require('crypto');

const SHEET_ID = '1CMSqYFS352rIKXW0x0ZeEbtNjiBB1sOvMMI9linioLg';
const API_KEY  = 'AIzaSyD8AvaVO0uYS_pDNBmQx5DYLaB0j8dIZo0';
const SCOPE    = 'https://www.googleapis.com/auth/spreadsheets.readonly';

// Module-level token cache — survives across requests in the same Lambda warm instance
let _cachedToken    = null;
let _tokenExpiresAt = 0;

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fetchAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const sig = sign.sign(creds.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${unsigned}.${sig}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(d)}`);
  return d.access_token;
}

async function getToken() {
  if (_cachedToken && Date.now() < _tokenExpiresAt) return _cachedToken;

  const raw = process.env.GOOGLE_CREDENTIALS;
  if (!raw) return null; // fall back to API key

  const creds = JSON.parse(raw);
  _cachedToken    = await fetchAccessToken(creds);
  _tokenExpiresAt = Date.now() + 50 * 60 * 1000; // cache 50 min
  return _cachedToken;
}

async function readRange(range) {
  const token = await getToken();
  const base  = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;
  const url   = token ? base : `${base}?key=${API_KEY}`;
  const opts  = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  const r = await fetch(url, opts);
  const d = await r.json();
  if (d.error) throw new Error(`Sheets error: ${d.error.message}`);
  return d.values || [];
}

module.exports = { readRange, SHEET_ID };
