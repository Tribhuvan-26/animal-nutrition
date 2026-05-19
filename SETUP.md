# Setup Guide

Follow these steps in order. The whole thing should take ~20 minutes.

---

## Step 1 — Deploy the Apps Script to your Google Sheet

This is what lets the website write rows into your sheet.

1. Open your sheet: https://docs.google.com/spreadsheets/d/1hnrfkJXN8Irf3YbTt6h14vTWz72BnEJgN48LM9OdNDc/edit
2. Click **Extensions → Apps Script** in the menu bar. A code editor opens in a new tab.
3. Delete the placeholder `function myFunction() { ... }` code.
4. Open `apps-script.gs` from this folder. Copy everything and paste into the Apps Script editor.
5. Click the floppy disk **Save** icon (or press Ctrl+S). Name the project anything you like.
6. Click the blue **Deploy** button (top right) → **New deployment**.
7. Click the gear ⚙ next to "Select type" → choose **Web app**.
8. Fill in:
   - **Description**: `Receipt logger`
   - **Execute as**: `Me (your email)`
   - **Who has access**: `Anyone`
9. Click **Deploy**.
10. Google will ask you to authorize — click **Authorize access**, pick your account, then click **Advanced → Go to {project name} (unsafe)** → **Allow**. (This warning shows because the script isn't from a verified publisher — it's just yours.)
11. **COPY THE WEB APP URL** it shows you. It looks like: `https://script.google.com/macros/s/AKfy.../exec`

Save this URL somewhere — you'll paste it into `.env.local` next.

> If you ever change the Apps Script code, you must redeploy: **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. Same URL stays.

---

## Step 2 — Get a free Gemini API key

1. Go to https://aistudio.google.com
2. Sign in with your Google account.
3. Click **Get API key** (top left).
4. Click **Create API key** → pick a project (or let it create one).
5. Copy the key. Looks like `AIzaSy...`.

Free tier is plenty for personal use.

---

## Step 3 — Configure local environment

1. In this folder, copy `.env.local.example` to `.env.local`:
   ```powershell
   Copy-Item .env.local.example .env.local
   ```
2. Open `.env.local` in any text editor and fill in both values:
   ```
   GEMINI_API_KEY=AIzaSy...your-actual-key...
   APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfy.../exec
   ```
3. Save the file. It's gitignored, so the secrets won't leak.

---

## Step 4 — Run it locally

```powershell
npm run dev
```

Open http://localhost:3000 in your browser. Upload a receipt photo. Click "Log to sheet." Within a few seconds the row should appear in your Google Sheet.

If something fails, check the terminal where `npm run dev` is running — the error usually shows up there.

---

## Step 5 — Deploy to Vercel (public URL)

1. Create a GitHub repo and push this folder to it. (If you've never done this, ask and I'll walk you through `git init` + `gh repo create`.)
2. Go to https://vercel.com and sign in with GitHub.
3. Click **Add New → Project** → import the repo.
4. Before clicking Deploy, expand **Environment Variables** and add:
   - `GEMINI_API_KEY` = your key
   - `APPS_SCRIPT_URL` = your Apps Script URL
5. Click **Deploy**. Wait ~1 minute.
6. You get a URL like `receipt-to-sheet.vercel.app`. Open it on your phone, upload a receipt — same flow as local.

---

## Troubleshooting

- **"GEMINI_API_KEY not configured"** — `.env.local` is missing or wrong. Restart `npm run dev` after editing it.
- **"Apps Script returned 401/403"** — Re-check Step 1, especially "Who has access: Anyone."
- **"Gemini returned non-JSON"** — The receipt was too blurry/dark for Gemini to read. Retake the photo.
- **Row appears with wrong values** — Gemini misread the receipt. You can edit the row directly in the sheet.

---

## File map (what each file does)

```
apps-script.gs        # Paste this into your Google Sheet's Apps Script editor (Step 1)
package.json          # Project metadata + dependencies
next.config.js        # Next.js settings
jsconfig.json         # Path aliasing for the editor
.env.local.example    # Template for secrets (copy to .env.local)
.gitignore            # Keeps .env.local and node_modules out of git
app/
  layout.js           # HTML shell
  page.js             # The upload page (UI)
  globals.css         # Styles
  api/upload/route.js # Backend: image -> Gemini -> Apps Script
```
