# DC House System Status Report
**Date:** 2026-06-01  
**Branch:** `claude/determined-cerf-8izni`  
**Compared against:** `main`

---

## Summary

The DC House residential management system is **active and operational**, with significant divergence detected between the session branch and `main`. The `main` branch has undergone a major architectural simplification while adding a new AI-powered license plate scanning feature.

---

## Changes Detected on `main` vs Session Branch

### New Feature
| File | Description |
|------|-------------|
| `car-gate/api/scan-plate.js` | **NEW** — AI license plate scanning via Google Cloud Vision API. Accepts a base64 image (POST), calls Vision API `TEXT_DETECTION`, returns cleaned plate text. |

### Files Removed on `main`
| File | Impact |
|------|--------|
| `car-gate/api/_auth.js` | Google Sheets JWT auth removed — Supabase backend dropped |
| `car-gate/api/_supabase.js` | Supabase PostgREST wrapper removed |
| `car-gate/api/dashboard.js` | Analytics endpoint removed |
| `car-gate/api/line-webhook.js` | LINE OA member registration flow removed |
| `car-gate/api/migrate.js` | DB migration endpoint removed |
| `car-gate/dashboard.html` | Analytics dashboard UI removed |
| `car-gate/chef.html` | Chef/food ordering portal removed |
| `car-gate/phone.html` | Phone interface removed |
| `car-gate/photos/car35.jpg` | Car 35 photo removed |
| `car-gate/vercel.json` | Vercel sub-config removed |
| `loadtest.js` | Load testing script removed |
| `.gitignore` | Removed |

### Files Modified on `main`
| File | Change |
|------|--------|
| `car-gate/api/cars.js` | Reverted to Google Sheets only (Supabase integration removed) |
| `car-gate/guard.html` | Updated UI; integrated with `scan-plate` endpoint |
| `car-gate/index.html` | Design updates |
| `vercel.json` | `/dashboard` route removed |

---

## Architecture Status

| Component | Session Branch | `main` |
|-----------|---------------|--------|
| Backend | Supabase (primary) + Google Sheets (fallback) | Google Sheets only |
| Analytics | Full dashboard (dashboard.js + dashboard.html) | Removed |
| LINE OA | Member registration webhook active | Removed |
| Plate Scanning | Not present | **NEW** (Google Vision API) |
| Migration Endpoint | Present (migrate.js) | Removed |
| Car Fleet | 35 cars | 34 cars (car35.jpg removed) |
| Routing | /guard, /index, /dashboard | /guard, /index only |

---

## Assessment

The `main` branch represents a significant simplification:
- Supabase backend has been **abandoned** in favour of Google Sheets only
- Complex features (analytics, LINE OA registration, food ordering) have been **stripped out**
- A practical new feature — **AI camera plate reading** — has been added

The session branch still carries the Supabase migration work from PR #8 and the associated infrastructure, which is now out of sync with `main`.

---

## Recommendations

1. **Reconcile branches** — Decide whether Supabase is the intended backend going forward or if the project is reverting to Sheets-only.
2. **Merge `scan-plate.js` forward** — This new feature on `main` should be incorporated into any active development branch.
3. **Archive removed features** — LINE webhook, analytics dashboard, and food ordering code should be tagged before permanent removal if there is any chance of reuse.
4. **Secrets hygiene** — `LINE_TOKEN` and `API_KEY` are hardcoded in source. These should be environment variables.
