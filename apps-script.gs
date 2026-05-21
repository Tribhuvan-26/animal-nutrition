// Paste into Google Sheet -> Extensions -> Apps Script.
// Requires the Google Sheets API service enabled:
//   Services (sidebar) -> + -> Google Sheets API -> Add.
// Save, then Deploy -> Manage deployments -> pencil -> Version: New version -> Deploy.

const COL = {
  SNO: 2, NAME: 3, ITEM: 4, AMOUNT: 5, PAID: 6, MODE: 7, PRICE: 8, P: 9,
  DATE_LABEL: 7,
};
const HEADERS = ['s.no', 'Name', 'item', 'amount', 'paid or not', 'mode of payment', 'price', 'p'];
const MASTER_SHEET_NAME = '_dropdown_items';

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;
  if (action === 'dropdowns') {
    return jsonOut({
      item: { values: getMasterList(getOrCreateMasterSheet()) },
      paid_or_not: inspectPaidDropdown(),
    });
  }
  if (action === 'resetMaster') {
    return jsonOut(resetMasterToCanonical());
  }
  if (action === 'inspectRow') {
    const r = Number(e.parameter.row);
    if (!r || r < 1) return jsonOut({ error: 'Invalid row' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets().filter(s => s.getName() !== MASTER_SHEET_NAME)[0];
    const cellValue = sheet.getRange(r, COL.ITEM).getValue();
    let dv = null;
    if (typeof Sheets !== 'undefined') {
      try { dv = readCellValidation(ss, sheet, r, COL.ITEM); } catch (err) { dv = { error: err.message }; }
    }
    return jsonOut({ row: r, col: 'D (item)', value: cellValue, dataValidation: dv });
  }
  if (action === 'diagnostics') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets().filter(s => s.getName() !== MASTER_SHEET_NAME)[0];
    const chipRule = readChipValidationViaApi(ss, sheet);
    const priceLookup = buildPriceLookup(sheet);
    return jsonOut({
      sheetsApiAvailable: typeof Sheets !== 'undefined',
      chipTemplate: chipRule ? 'found' : 'missing',
      chipRule: chipRule,
      masterListSize: getMasterList(getOrCreateMasterSheet()).length,
      priceLookupSize: Object.keys(priceLookup).length,
      sampleLookup: Object.entries(priceLookup).slice(0, 5).map(([k, v]) => `${k}: ${v}`),
    });
  }
  return ContentService.createTextOutput('Sales ledger logger alive.').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets().filter(s => s.getName() !== MASTER_SHEET_NAME)[0];
    const payload = JSON.parse(e.postData.contents);

    if (!payload.entries || !Array.isArray(payload.entries) || payload.entries.length === 0) {
      return jsonOut({ success: false, error: 'No entries provided.' });
    }
    const dateLabel = formatDateLabel(payload.date);
    if (!dateLabel) return jsonOut({ success: false, error: 'Invalid or missing date.' });

    const masterSheet = getOrCreateMasterSheet();
    let masterList = getMasterList(masterSheet);
    const paidDropdown = inspectPaidDropdown();
    const priceLookup = buildPriceLookup(sheet);

    let { headerRow, nextWriteRow, maxSno } = findOrCreateSection(sheet, dateLabel);

    // Read raw validation rules (with multi-select metadata) from existing chip cells.
    const chipValidationRule = readChipValidationViaApi(ss, sheet);

    const written = [];
    const newItems = [];
    const apiRequests = [];

    for (const entry of payload.entries) {
      maxSno += 1;
      const row = nextWriteRow;

      const parts = String(entry.items || '').split(',').map(s => s.trim()).filter(Boolean);
      const finalParts = [];
      for (const p of parts) {
        const matched = findBestMatch(p, masterList);
        if (matched) {
          finalParts.push(matched);
        } else {
          // Strict 80+ list: do NOT auto-add to master. Write as-is so it's visible,
          // but the cell will show an invalid warning so user can fix via dropdown.
          newItems.push(p);
          finalParts.push(p);
        }
      }
      const itemValue = finalParts.join(', ');

      const paidValue = findBestMatch(entry.paid_or_not || '', paidDropdown.values) || entry.paid_or_not || '';

      sheet.getRange(row, COL.SNO).setValue(maxSno);
      sheet.getRange(row, COL.NAME).setValue(entry.name || '');

      sheet.getRange(row, COL.SNO).setHorizontalAlignment('right');
      sheet.getRange(row, COL.NAME).setHorizontalAlignment('left');

      const itemCell = sheet.getRange(row, COL.ITEM);
      itemCell.clearDataValidations(); // Clear strict validation FIRST so setValue accepts comma-separated values
      itemCell.setValue(itemValue);
      itemCell.setHorizontalAlignment('left');
      // ALWAYS apply a range-based dropdown so the arrow shows up reliably
      // (even if the Sheets API chip request fails or is single-select strict).
      applyRangeDropdown(itemCell, masterSheet);
      // Best-effort: also queue the chip rule via Sheets API — overrides above if it succeeds
      // and is a real multi-select chip.
      if (chipValidationRule) {
        apiRequests.push(buildSetValidationRequest(sheet.getSheetId(), row, COL.ITEM, chipValidationRule));
      }

      const amount = toNumber(entry.amount);
      const amountCell = sheet.getRange(row, COL.AMOUNT);
      amountCell.setValue(amount);
      amountCell.setHorizontalAlignment('right');

      const paidCell = sheet.getRange(row, COL.PAID);
      paidCell.clearDataValidations();
      paidCell.setValue(paidValue);
      paidCell.setHorizontalAlignment('left');
      applyListDropdown(paidCell, paidDropdown.values);

      const modeCell = sheet.getRange(row, COL.MODE);
      modeCell.setValue(entry.mode_of_payment || '');
      modeCell.setHorizontalAlignment('left');

      // Price + profit lookup from historical single-item rows.
      const priceInfo = lookupTotalPrice(finalParts, priceLookup);
      if (priceInfo.total !== null) {
        const priceCell = sheet.getRange(row, COL.PRICE);
        priceCell.setValue(priceInfo.total);
        priceCell.setHorizontalAlignment('right');
        if (typeof amount === 'number') {
          const pCell = sheet.getRange(row, COL.P);
          pCell.setValue(amount - priceInfo.total);
          pCell.setHorizontalAlignment('right');
        }
      }

      written.push({
        row, sno: maxSno, name: entry.name,
        item_written: itemValue, paid_written: paidValue,
        price_written: priceInfo.total,
        price_missing: priceInfo.missing,
      });
      nextWriteRow += 1;
    }

    // Flush batched Sheets API validation requests.
    let apiUsed = false;
    let apiError = null;
    const sheetsAvailable = typeof Sheets !== 'undefined';
    if (apiRequests.length > 0 && sheetsAvailable) {
      try {
        Sheets.Spreadsheets.batchUpdate({ requests: apiRequests }, ss.getId());
        apiUsed = true;
      } catch (err) {
        apiError = err.message || String(err);
      }
    }

    return jsonOut({
      success: true,
      dateLabel,
      rowsAdded: written.length,
      written,
      newItems,
      masterListSize: masterList.length,
      apiUsed,
      apiError,
      sheetsAvailable,
      chipFound: !!chipValidationRule,
      apiRequestCount: apiRequests.length,
    });
  } catch (err) {
    return jsonOut({ success: false, error: err.message, stack: err.stack });
  }
}

// ---- Sheets API: read raw validation rule from existing chip cell ----

// Anchor rows the user has confirmed have a real multi-select chip dropdown.
// These are checked first because they're more likely to contain the actual
// multi-chip rule structure than rows auto-written by the script.
const CHIP_ANCHOR_ROWS = [457, 458, 467];

function readChipValidationViaApi(ss, sheet) {
  if (typeof Sheets === 'undefined') return null;
  try {
    const lastRow = sheet.getLastRow();
    // First try the user-designated anchor rows (manual multi-chip cells).
    for (const r of CHIP_ANCHOR_ROWS) {
      if (r > lastRow) continue;
      const dv = readCellValidation(ss, sheet, r, COL.ITEM);
      if (dv) return dv;
    }
    // Fallback: scan for any comma-containing cell.
    for (let r = 1; r <= Math.min(lastRow, 300); r++) {
      const v = String(sheet.getRange(r, COL.ITEM).getValue()).trim();
      if (v.includes(',')) {
        const dv = readCellValidation(ss, sheet, r, COL.ITEM);
        if (dv) return dv;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

function readCellValidation(ss, sheet, row, col) {
  const a1 = sheet.getName() + '!' + columnToLetter(col) + row + ':' + columnToLetter(col) + row;
  const resp = Sheets.Spreadsheets.get(ss.getId(), {
    ranges: [a1],
    fields: 'sheets/data/rowData/values/dataValidation',
  });
  return resp.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.dataValidation || null;
}

function buildSetValidationRequest(sheetId, row, col, rule) {
  return {
    setDataValidation: {
      range: {
        sheetId: sheetId,
        startRowIndex: row - 1,
        endRowIndex: row,
        startColumnIndex: col - 1,
        endColumnIndex: col,
      },
      rule: rule,
    },
  };
}

function columnToLetter(col) {
  let s = '';
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

// ---- Master list management ----

function getOrCreateMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(MASTER_SHEET_NAME);
  if (sheet) return sheet;

  sheet = ss.insertSheet(MASTER_SHEET_NAME);
  const mainSheet = ss.getSheets().filter(s => s.getName() !== MASTER_SHEET_NAME)[0];
  const existing = findExistingItemDropdownValues(mainSheet);
  if (existing.length > 0) {
    sheet.getRange(1, 1, existing.length, 1).setValues(existing.map(v => [v]));
  }
  sheet.hideSheet();
  return sheet;
}

// Resets the _dropdown_items sheet to the canonical 79 original items.
// Removes anything that was auto-added during earlier tests.
function resetMasterToCanonical() {
  const CANONICAL = [
    'whey 2kg','Isolate 2kg','whey 1kg','megamass 3kg','Liver x','megamass 5kg',
    'gainer 3kg','gainer 5kg','carbobooster 3kg','psycotic','peanut butter',
    'wellcore creatine','abn creatine','abn glutamine','abn BCAA','MT Creatine',
    'MT Fish oil','MT Glutamine','MT multivitamin','megamass 1kg','gainer 1kg',
    'c4 60','Iso 100','pro antium','isopure 1kg','lipo 6 hers','mt eaa',
    'l carnitine','nitrotech whey','abn testo','best bcaa','total war','curse pre',
    'nitrotech ripped','xtend bcaa','masstech','isopure 2kgs','xpel','lipo 6 black',
    'nitrawhey os','methyldrene','black spyder','nitraflex','cla + carnitine',
    'testrol fire','on creatine','shilajit gold','syntha6','hyde','bioquest fishoil',
    'nutrex cla','black viper','gnc eaa','abn multi vitamin','iso sensation',
    'shilajit gummies','kl anabolic mass','rule 1 isolate','on gold 5lb','on gold 1kg',
    'rule1 whey','qnt whey','dynamtize elite whey','xtend eaa','nitotech whey gold',
    'kl levro whey','kl shaboom pre','nitra whey','rule 1 mass gainer','c4 50',
    'rc king whey','isopure creatine','bioquest omega','tan cream','peanut butter 1 kg',
    'rice cake','peanut butter 500 gms','oats 1kg','xl purge pre',
  ];
  const masterSheet = getOrCreateMasterSheet();
  const beforeSize = getMasterList(masterSheet).length;
  // Clear all rows then write canonical list.
  if (masterSheet.getLastRow() > 0) {
    masterSheet.getRange(1, 1, masterSheet.getLastRow(), 1).clearContent();
  }
  masterSheet.getRange(1, 1, CANONICAL.length, 1).setValues(CANONICAL.map(v => [v]));
  return { success: true, before: beforeSize, after: CANONICAL.length };
}

function getMasterList(masterSheet) {
  const lastRow = masterSheet.getLastRow();
  if (lastRow === 0) return [];
  return masterSheet.getRange(1, 1, lastRow, 1).getValues()
    .map(r => r[0]).filter(v => v !== '' && v !== null).map(String);
}

function findExistingItemDropdownValues(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  for (let r = 1; r <= Math.min(lastRow, 200); r++) {
    const v = readDropdown(sheet.getRange(r, COL.ITEM));
    if (v && v.values && v.values.length > 0) return v.values;
  }
  return [];
}

function inspectPaidDropdown() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets().filter(s => s.getName() !== MASTER_SHEET_NAME)[0];
  const lastRow = Math.max(sheet.getLastRow(), 1);
  for (let r = 1; r <= Math.min(lastRow, 200); r++) {
    const v = readDropdown(sheet.getRange(r, COL.PAID));
    if (v && v.values && v.values.length > 0) return v;
  }
  return { values: ['paid ak', 'paid cn', 'balance', 'credits'] };
}

function readDropdown(cell) {
  const dv = cell.getDataValidation();
  if (!dv) return null;
  const type = dv.getCriteriaType().toString();
  const args = dv.getCriteriaValues();
  if (type === 'VALUE_IN_LIST' && Array.isArray(args[0])) {
    return { type, values: args[0].map(String) };
  }
  if (type === 'VALUE_IN_RANGE' && args[0] && args[0].getValues) {
    const vals = args[0].getValues().flat().map(String).filter(Boolean);
    return { type, values: vals };
  }
  return { type, values: [] };
}

// ---- Dropdown application (fallback path) ----

function applyRangeDropdown(cell, masterSheet) {
  const lastRow = masterSheet.getLastRow();
  if (lastRow === 0) return;
  const range = masterSheet.getRange(1, 1, lastRow, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(range, true)
    .setAllowInvalid(true)
    .build();
  cell.setDataValidation(rule);
}

function applyListDropdown(cell, values) {
  if (!values || values.length === 0) return;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(true)
    .build();
  cell.setDataValidation(rule);
}

// ---- Matching ----

function findBestMatch(value, allowed) {
  if (!value || !allowed || allowed.length === 0) return null;
  const v = String(value).toLowerCase().trim();
  for (const a of allowed) {
    if (String(a).toLowerCase().trim() === v) return a;
  }
  for (const a of allowed) {
    if (String(a).toLowerCase().includes(v)) return a;
  }
  for (const a of allowed) {
    if (v.includes(String(a).toLowerCase())) return a;
  }
  return null;
}

// ---- Cost-price lookup from historical single-item rows ----

function buildPriceLookup(sheet) {
  const lookup = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return lookup;

  const items = sheet.getRange(1, COL.ITEM, lastRow, 1).getValues();
  const prices = sheet.getRange(1, COL.PRICE, lastRow, 1).getValues();

  for (let i = 0; i < items.length; i++) {
    const itemStr = String(items[i][0] || '').trim();
    const price = Number(prices[i][0]);
    if (!itemStr || !price || isNaN(price)) continue;
    if (itemStr.includes(',')) continue; // only single-item rows give us a clean per-item price
    const key = itemStr.toLowerCase();
    lookup[key] = price; // overwrites with latest seen
  }
  return lookup;
}

function lookupTotalPrice(parts, priceLookup) {
  if (!parts || parts.length === 0) return { total: null, missing: [] };
  let total = 0;
  let matchedAny = false;
  const missing = [];
  for (const p of parts) {
    const price = priceLookup[String(p).toLowerCase()];
    if (price === undefined) {
      missing.push(p);
    } else {
      total += price;
      matchedAny = true;
    }
  }
  if (!matchedAny) return { total: null, missing };
  // If some items are missing prices, we still return the partial total but flag missing.
  // Caller can decide whether to use partial or leave blank.
  if (missing.length > 0) return { total: null, missing }; // strict: only fill when all items have a price
  return { total, missing };
}

// ---- Section management ----

function findExistingDateRowColor(sheet) {
  const lastRow = sheet.getLastRow();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const datePattern = new RegExp('^(' + monthNames.join('|') + ')\\s+\\d{1,2}$', 'i');

  const data = sheet.getRange(1, 1, Math.min(lastRow, 500), 10).getValues();
  // Scan from BOTTOM up so the most recently customized row wins (e.g. user's bright-green).
  for (let i = data.length - 1; i >= 0; i--) {
    for (const cellValue of data[i]) {
      if (datePattern.test(String(cellValue).trim())) {
        const bgs = sheet.getRange(i + 1, 1, 1, 10).getBackgrounds()[0];
        for (const bg of bgs) {
          const c = String(bg || '').toLowerCase();
          if (c && c !== '#ffffff' && c !== '#fff') return c;
        }
        break;
      }
    }
  }
  return null;
}

function formatDateLabel(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function findOrCreateSection(sheet, dateLabel) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const data = sheet.getRange(1, 1, lastRow, 10).getValues();

  // Find existing date row by scanning ALL columns (handles merged cells / non-G placement)
  let labelRow = -1;
  for (let i = 0; i < data.length; i++) {
    for (const cellValue of data[i]) {
      if (String(cellValue).trim().toLowerCase() === dateLabel.toLowerCase()) {
        labelRow = i + 1;
        break;
      }
    }
    if (labelRow !== -1) break;
  }

  if (labelRow === -1) {
    const startAt = lastRow + 3;
    const greenColor = findExistingDateRowColor(sheet) || '#00ff00';
    const dateRange = sheet.getRange(startAt, 1, 1, 10);
    dateRange.merge();
    dateRange.setValue(dateLabel)
      .setBackground(greenColor)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    const headerRow = startAt + 1;
    const headerRange = sheet.getRange(headerRow, COL.SNO, 1, HEADERS.length);
    headerRange.setValues([HEADERS]);
    headerRange.setFontWeight('bold');
    // Align each header to match its data column type.
    sheet.getRange(headerRow, COL.SNO).setHorizontalAlignment('right');
    sheet.getRange(headerRow, COL.NAME).setHorizontalAlignment('left');
    sheet.getRange(headerRow, COL.ITEM).setHorizontalAlignment('left');
    sheet.getRange(headerRow, COL.AMOUNT).setHorizontalAlignment('right');
    sheet.getRange(headerRow, COL.PAID).setHorizontalAlignment('left');
    sheet.getRange(headerRow, COL.MODE).setHorizontalAlignment('left');
    sheet.getRange(headerRow, COL.PRICE).setHorizontalAlignment('right');
    sheet.getRange(headerRow, COL.P).setHorizontalAlignment('right');
    return { headerRow, nextWriteRow: headerRow + 1, maxSno: 0 };
  }

  let headerRow = labelRow + 1;
  for (let probe = 0; probe < 5; probe++) {
    const val = String(sheet.getRange(headerRow, COL.SNO).getValue()).trim().toLowerCase();
    if (val === 's.no') break;
    headerRow += 1;
  }

  let row = headerRow + 1;
  let maxSno = 0;
  while (true) {
    const sno = sheet.getRange(row, COL.SNO).getValue();
    if (sno === '' || sno === null) break;
    const n = Number(sno);
    if (!isNaN(n) && n > maxSno) maxSno = n;
    row += 1;
  }

  return { headerRow, nextWriteRow: row, maxSno };
}

function toNumber(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return isNaN(n) ? v : n;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
