import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT = `You are reading a handwritten daily sales ledger for a supplement / fitness store. The photo may show one or two pages side by side.

LEFT PAGE: that day's sales. Each numbered entry has:
- A serial number (often circled).
- One or more items written like "Abn Whey 2kg 1pc = 4750" (brand-prefix + product + size + qty + price).
- A customer name to the right of the items.
- The total amount for that customer (single item price, or sum when multiple items grouped with a brace).

RIGHT PAGE (if present): payment status for the same customers, matched by serial number or name.

==================================
STEP 1 — INTERNAL VERIFICATION (do this silently, do NOT output)
==================================
For EVERY entry, before producing JSON:
a. Read each item's per-piece price.
b. Read the quantity (1pc, 2pc, etc.).
c. Compute item subtotal = price × qty.
d. Sum all subtotals for this entry.
e. Read the customer-total number.
f. CHECK: sum from (d) must equal customer-total from (e).
g. If they don't match — RE-READ each digit. Handwritten digits commonly misread:
   - 3 vs 5  (3 has a sharper bottom curve; 5 has a flat top)
   - 3 vs 8  (8 is closed top; 3 is open)
   - 2 vs 3  (2 has a flat bottom; 3 has two curves)
   - 1 vs 7  (7 has a horizontal top stroke)
   - 0 vs 6  (6 has a small loop at the top)
   - 4 vs 9
   The CORRECT reading is the one where math works. If sum doesn't match the total, your digit-reading is wrong — try alternatives until it does.

==================================
STEP 2 — SIZES (3kg vs 5kg vs 2kg)
==================================
- Sizes look like "1kg", "2kg", "3kg", "5kg", "1pc".
- The kg digit is easily misread between 3 and 5 in cursive.
- Cross-check using PRICE: typical supplement prices roughly:
   - whey 2kg ≈ 4000-5000
   - whey 1kg ≈ 2000-2700
   - gainer 5kg ≈ 2500-3500
   - gainer 3kg ≈ 1500-2200
   - megamass 5kg ≈ 4000-5500
   - megamass 3kg ≈ 2400-3300
- If the price doesn't fit the size, your size reading is likely wrong — flip 3↔5 and check again.

==================================
STEP 3 — PAYMENT STATUS MAPPING
==================================
- "online to Ak" / "phonep to Ak" / "phonepe to Ak"  -> "paid ak"
- "online to Cn" / "phonep to Cn" / "phonepe to Cn"  -> "paid cn"
- "Bal." / "Bal" / "balance"                          -> "balance"
- "cr" / "credits"                                    -> "credits"
- "-" / blank / missing                               -> ""

==================================
STEP 4 — OUTPUT
==================================
Return ONLY a JSON object (no markdown fences, no commentary, no step-1/2 notes):

{
  "date": "YYYY-MM-DD",
  "entries": [
    {
      "s_no": 1,
      "name": "customer name",
      "items": "item1, item2",
      "amount": 2300,
      "paid_or_not": "paid ak" | "paid cn" | "balance" | "credits" | "",
      "mode_of_payment": "free text like 'online 18/05' or 'phonepe 18/05' or '02/01 gpay'"
    }
  ]
}

==================================
RULES
==================================
- Date: top of the LEFT page (e.g. "8/5/26 Monday" -> "2026-05-08"). 2-digit years are 2000+.
- "amount": number only, no symbols. MUST equal the sum of item subtotals (Step 1 verification).
- Items: read AS WRITTEN. Drop brand prefixes like "Abn"/"MT" only if the prefix isn't part of the product name (so "Abn Whey 2kg" -> "whey 2kg" but "Abn Creatine" -> "abn creatine" since "abn" is part of the product name). For unclear items, use what you see verbatim.
- Names: Indian names. Read carefully — "Vinay" not "Jinay", "Drfan" not "Irfan", "Shiva" not "Shira", "Yusuf" not "YUSUF" unless emphasized.
- If a right-page entry has special note like "1 Isolate Return (412) (Bal 900)", set paid_or_not based on word ("Bal" -> "balance") and put the FULL note in mode_of_payment.
- Order entries by serial number.

If the image is not a sales ledger at all, return: {"error": "not a sales ledger"}`;

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;

    if (!apiKey) return json({ success: false, error: 'GEMINI_API_KEY not configured.' }, 500);
    if (!appsScriptUrl) return json({ success: false, error: 'APPS_SCRIPT_URL not configured.' }, 500);

    const formData = await req.formData();
    const file = formData.get('image');
    if (!file || typeof file === 'string') {
      return json({ success: false, error: 'No image uploaded.' }, 400);
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const genAI = new GoogleGenerativeAI(apiKey);
    const config = { temperature: 0.1, responseMimeType: 'application/json' };
    const modelCandidates = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];

    let text = '';
    let lastErr = null;
    for (const modelName of modelCandidates) {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig: config });
      let success = false;
      // Retry each model up to 3 times with backoff on 503
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          const result = await model.generateContent([
            { inlineData: { data: base64, mimeType } },
            PROMPT,
          ]);
          text = result.response.text().trim();
          success = true;
        } catch (err) {
          lastErr = err;
          const msg = String(err.message || '');
          // Retry on 503/overload; break out for other errors to try next model
          if (msg.includes('503') || msg.includes('overload') || msg.includes('high demand')) {
            await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
            continue;
          }
          break;
        }
      }
      if (success) break;
    }

    if (!text) {
      return json({ success: false, error: `All Gemini models overloaded or failed. Last error: ${lastErr?.message || 'unknown'}` }, 503);
    }

    const cleaned = stripCodeFences(text);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return json({ success: false, error: `Gemini returned non-JSON: ${text.slice(0, 300)}` }, 502);
    }

    if (parsed.error) return json({ success: false, error: parsed.error }, 400);

    if (!parsed.date || !Array.isArray(parsed.entries) || parsed.entries.length === 0) {
      return json({ success: false, error: 'Gemini did not extract any entries.', raw: parsed }, 502);
    }

    const sheetRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
      redirect: 'follow',
    });

    const sheetText = await sheetRes.text();
    let sheetJson;
    try { sheetJson = JSON.parse(sheetText); } catch { sheetJson = { raw: sheetText }; }

    if (!sheetRes.ok || !sheetJson.success) {
      return json({
        success: false,
        error: sheetJson.error || `Apps Script returned ${sheetRes.status}`,
        rawAppsScriptResponse: sheetText.slice(0, 1000),
        appsScriptJson: sheetJson,
        extracted: parsed,
      }, 502);
    }

    return json({
      success: true,
      date: parsed.date,
      dateLabel: sheetJson.dateLabel,
      rowsAdded: sheetJson.rowsAdded,
      entries: parsed.entries,
      written: sheetJson.written,
      apiUsed: sheetJson.apiUsed,
      chipFound: sheetJson.chipFound,
    });
  } catch (err) {
    return json({ success: false, error: err.message || 'Unknown error' }, 500);
  }
}

function stripCodeFences(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
