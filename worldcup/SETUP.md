# World Cup 2026 — DC House Team Picker

**16 participants · 3 teams each · 48 teams total**

---

## One-time setup (5 minutes)

### 1. Google Sheet
1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet
2. Copy the Sheet ID from the URL:  
   `https://docs.google.com/spreadsheets/d/**THIS_IS_YOUR_ID**/edit`

### 2. Apps Script
1. Go to [script.google.com](https://script.google.com) → **New project**
2. Paste the contents of `apps-script.gs` into the editor
3. Replace `YOUR_GOOGLE_SHEET_ID_HERE` with your Sheet ID
4. Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy** → copy the Web App URL

### 3. Update index.html
Open `index.html` and replace:
```
const SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```
with your deployed Web App URL.

### 4. GitHub Pages
1. Push this repo to GitHub
2. Go to repo **Settings → Pages**
3. Source: **main branch** → `/` (root) or `/worldcup` folder
4. Your app is live at:  
   `https://jabpichayut-ux.github.io/dc-house/worldcup/`

---

## How it works
- Each teammate opens the URL and enters their LINE ID
- They spin **3 wheels** — one per level (A = Gold, B = Silver, C = Bronze)
- Each team can only be claimed once (locked after spin)
- All picks are saved to Google Sheets automatically
- **If any of your 3 teams wins the World Cup → you win the bet!**
