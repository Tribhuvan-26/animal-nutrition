# Receipt-to-Sheet Website

A simple website where you upload a picture of a receipt, and the website automatically adds a new row to your Google Sheet with the **Date**, **Vendor**, and **Total** from the receipt.

---

## How it works (the big picture)

Here's the journey of a single receipt, from your phone to your spreadsheet:

1. **You open the website** (hosted on Vercel — a free URL like `your-app.vercel.app`).
2. **You upload a photo** of a receipt by clicking a button or dragging it in.
3. **The website sends the photo to Google Gemini's AI**, which "reads" the receipt and pulls out three things: the date, the store name, and the total.
4. **The website sends those three values to your Google Sheet** via a small Apps Script that lives inside the sheet itself.
5. **A new row appears** in your sheet. Done.

The whole round trip should take a few seconds.

---

## The pieces involved

To pull this off, four separate things need to exist and talk to each other:

### 1. The website (frontend + backend)
This is the thing you actually see and click. We'll build it as one project that has:
- A **frontend** — the page in the browser with the "Upload" button (HTML + a bit of JavaScript).
- A **backend** — a small server function that receives your upload, calls Gemini, and forwards the data to the sheet. (You can't call Gemini directly from the frontend because your API key would be visible to anyone — backends keep it secret.)

We'll build both in **Next.js**, a popular framework that bundles the frontend and backend together and deploys to Vercel with one click.

### 2. Gemini API (the AI brain)
Google's Gemini model can look at an image and answer questions about it. We'll send it the receipt photo with a prompt like:

> "Look at this receipt. Return a JSON object with three fields: date (YYYY-MM-DD), vendor (the store name), and total (just the number)."

Gemini sends back something like:
```json
{ "date": "2026-05-19", "vendor": "Starbucks", "total": 450 }
```

You'll need a **free Gemini API key** from `aistudio.google.com`. Takes about 60 seconds — just sign in with Google and click "Get API key." Free tier is generous (millions of tokens/month), so you won't pay anything.

### 3. Google Apps Script (the door into your sheet)
Apps Script is a little code editor that lives *inside* every Google Sheet. We'll paste in ~15 lines of code that say:

> "When someone sends a POST request to this URL with date/vendor/total, append it as a new row."

Google then gives us a special URL (looks like `https://script.google.com/macros/s/AKfy.../exec`). The website's backend calls that URL whenever it has new data. No API keys, no Google Cloud setup — just a URL.

### 4. Vercel (where the website lives)
Vercel is a free hosting service. We'll connect our project to a GitHub repo, and every time we push code, Vercel automatically deploys it and gives us a public URL.

---

## What you'll need to provide

Before we start coding, gather these:

- [x] **Google Sheet link** — https://docs.google.com/spreadsheets/d/1hnrfkJXN8Irf3YbTt6h14vTWz72BnEJgN48LM9OdNDc/edit
- [ ] **Gemini API key** — free from `aistudio.google.com`. I'll walk you through getting it when we're ready.
- [ ] **GitHub account** — free, so Vercel can deploy your code. (Likely already have one.)
- [ ] **Vercel account** — free, sign up with your GitHub.

---

## Build steps (the rough plan)

We'll work in this order. Each step is small and testable on its own — no big bang at the end.

### Step 1: Set up the sheet
- Open your Google Sheet.
- Add three column headers in row 1: `Date`, `Vendor`, `Total`.
- Go to **Extensions → Apps Script**, paste in the script (I'll provide it), and deploy it as a Web App. Copy the URL it gives us.

### Step 2: Get the Gemini key
- Visit `aistudio.google.com`, sign in, click **Get API key**, copy it.

### Step 3: Build the website locally
- Create a Next.js project on your laptop.
- Build the upload page (a button + a "Sent!" confirmation).
- Build the backend function that calls Gemini and the Apps Script URL.
- Test it locally — upload a receipt, watch the row appear in your sheet.

### Step 4: Deploy to Vercel
- Push the code to GitHub.
- Connect the repo to Vercel.
- Add the Gemini key and Apps Script URL as **environment variables** (secret settings) so they're not in the code.
- Vercel gives you a public URL. You're live.

### Step 5: Use it
- Open the URL on your phone, take a photo of a receipt, upload. Watch your sheet fill itself.

---

## Decisions already made

These are locked in so I don't have to ask again:

| Decision | Choice | Why |
|---|---|---|
| Image type | Receipts / invoices | Your use case |
| AI model | Gemini (free tier) | Free, generous limits, vision-capable |
| Hosting | Vercel | Free, one-click deploy, perfect for Next.js |
| Sheet writing | Google Apps Script (web app URL) | No Google Cloud setup, fastest to ship |
| Fields extracted | Date, Vendor, Total | Simple v1 — line items can come later |

---

## What's NOT in scope for v1

To keep this shippable, we're skipping (for now):

- User login / accounts — anyone with the URL can upload to your sheet.
- Editing/deleting rows from the website.
- Line items (every product on the receipt) — just the total.
- Handling non-receipt images gracefully — if you upload a cat photo, Gemini will say it can't find a receipt and the row won't be added.

Any of these can be added later as a "v2" if you want.

---

## Next steps

Waiting on:
1. ~~Your Google Sheet link.~~ ✅ Received.
2. Your go-ahead to start building.
