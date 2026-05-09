# Render Deploy Checklist (N Script)

## 0) Scope

This checklist is for deploying the current `server.js` based app to Render as a Web Service.

---

## 1) Pre-Deploy (Local)

- [ ] `node --check app.js`
- [ ] `node --check server.js`
- [ ] `npm install` succeeds without errors
- [ ] `.env` is present locally and app starts with `node server.js`
- [ ] `.env` is ignored by git (`.gitignore` check)

### Required code checks

- [ ] `server.js` uses Render port fallback:
  - [ ] `const PORT = Number(process.env.PORT) || 5173;`
  - [ ] `const HOST = "0.0.0.0";`
- [ ] Upload endpoint is enabled and tested locally:
  - [ ] `POST /api/analyze/upload`
  - [ ] Accepted formats: `.txt/.md/.fountain/.fdx/.rtf/.pdf/.docx/.pptx`
  - [ ] OCR path is not required for scan PDFs

---

## 2) GitHub Preparation

- [ ] Latest branch pushed to GitHub
- [ ] No secrets committed (`.env`, credentials, tokens)
- [ ] `package.json` and `package-lock.json` are committed

---

## 3) Render Service Setup

- [ ] Create `Web Service` (not static site)
- [ ] Connect GitHub repo
- [ ] Runtime: `Node`
- [ ] Build Command: `npm install`
- [ ] Start Command: `node server.js`
- [ ] Auto deploy on push: enabled

Optional but recommended:

- [ ] Set `NODE_VERSION=20`
- [ ] Set health check path (if later implemented)

---

## 4) Environment Variables (Render)

- [ ] `TMDB_API_KEY`
- [ ] `GEMINI_API_KEY`
- [ ] `GEMINI_MODEL` (optional override)
- [ ] `GEMINI_ANALYZE_MODEL` (optional override)
- [ ] `GEMINI_MENTOR_MODEL` (optional override)

Notes:

- Do not upload `.env` directly to repo.
- Configure all runtime secrets in Render dashboard.

---

## 5) First Deploy Validation

- [ ] Render build succeeds
- [ ] Service starts without crash loops
- [ ] App URL loads correctly
- [ ] Discover tab works (search/add/edit/delete)
- [ ] Analyze Manual save works
- [ ] Analyze Script (DB route) works
- [ ] Analyze Script (Upload route) works
- [ ] Upload parse works for at least:
  - [ ] `.txt`
  - [ ] `.pdf` (text PDF)
  - [ ] `.docx`
  - [ ] `.pptx`
- [ ] Mentor endpoint call does not fail with configuration errors

---

## 6) Post-Deploy Hardening (Before Public Beta)

- [ ] Add request rate limiting for chat/upload/analyze endpoints
- [ ] Add auth and user-scoped data ownership
- [ ] Move critical data from localStorage-only model to server persistence
- [ ] Add structured logging and alerting
- [ ] Add clear upload error handling and user-facing retry guidance
- [ ] Add usage/cost controls for Gemini calls

---

## 7) Release Gate (Public Web App)

- [ ] Terms/Privacy pages prepared
- [ ] Upload content handling policy shown in UI
- [ ] Domain connected and SSL active
- [ ] Basic monitoring dashboard checked
- [ ] Rollback plan documented

---

## 8) Quick Troubleshooting

### Service fails to boot

- Verify `process.env.PORT` fallback logic.
- Confirm `npm install` completed and lockfile is committed.

### 500 errors on AI endpoints

- Re-check Render environment variables (`GEMINI_API_KEY`, model vars).

### Upload fails on office files

- Confirm MIME/extension is supported.
- Re-test with non-scanned text PDF and standard DOCX/PPTX.

