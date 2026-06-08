// ═══════════════════════════════════════════════════════════════
//  WORLD CUP 2026 — DC House Team Picker
//  Google Apps Script backend
//
//  SETUP:
//  1. Go to script.google.com → New project
//  2. Paste this entire file into the editor
//  3. Replace SHEET_ID below with your Google Sheet ID
//     (it's the long string in your Sheet's URL)
//  4. Click Deploy → New deployment
//     - Type: Web app
//     - Execute as: Me
//     - Who has access: Anyone
//  5. Click Deploy → Copy the Web App URL
//  6. Paste that URL into index.html where it says SCRIPT_URL
// ═══════════════════════════════════════════════════════════════

const SHEET_ID   = 'YOUR_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'Participants';

// ── GET handler ──────────────────────────────────────────────
function doGet(e) {
  const action = e.parameter.action || 'get';

  if (action === 'get')  return getData();
  if (action === 'save') return handleSave(e.parameter);

  return respond({ ok: true, message: 'World Cup 2026 Team Picker API' });
}

// ── Save a new participant ───────────────────────────────────
function handleSave(p) {
  const lineId = (p.lineId || '').trim();
  const teamA  = (p.teamA  || '').trim();
  const teamB  = (p.teamB  || '').trim();
  const teamC  = (p.teamC  || '').trim();

  if (!lineId || !teamA || !teamB || !teamC) {
    return respond({ ok: false, error: 'Missing fields' });
  }

  const sheet = getSheet();

  // Guard: duplicate LINE ID
  const existing = sheet.getDataRange().getValues();
  for (let i = 1; i < existing.length; i++) {
    if (String(existing[i][0]).toLowerCase() === lineId.toLowerCase()) {
      return respond({ ok: false, error: 'LINE ID already registered' });
    }
  }

  // Guard: full (16 participants max)
  if (existing.length - 1 >= 16) {
    return respond({ ok: false, error: 'All 16 spots filled' });
  }

  sheet.appendRow([lineId, teamA, teamB, teamC, new Date().toISOString()]);
  return respond({ ok: true });
}

// ── Return all participants + taken teams ────────────────────
function getData() {
  const sheet  = getSheet();
  const rows   = sheet.getDataRange().getValues();
  const participants = [];
  const takenTeams   = { A: [], B: [], C: [] };

  for (let i = 1; i < rows.length; i++) {
    const [lineId, teamA, teamB, teamC] = rows[i];
    if (!lineId) continue;
    participants.push({ lineId, teamA, teamB, teamC });
    if (teamA) takenTeams.A.push(teamA);
    if (teamB) takenTeams.B.push(teamB);
    if (teamC) takenTeams.C.push(teamC);
  }

  return respond({ participants, takenTeams });
}

// ── Helpers ──────────────────────────────────────────────────
function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['LINE ID', 'Level A Team', 'Level B Team', 'Level C Team', 'Timestamp']);
    sheet.setFrozenRows(1);

    // Column widths
    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 160);
    sheet.setColumnWidth(3, 160);
    sheet.setColumnWidth(4, 160);
    sheet.setColumnWidth(5, 200);

    // Header style
    const header = sheet.getRange('A1:E1');
    header.setBackground('#0d3b1e');
    header.setFontColor('#FFD700');
    header.setFontWeight('bold');
  }

  return sheet;
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
