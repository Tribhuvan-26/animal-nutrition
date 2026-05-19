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
          masterSheet.appendRow([p]);
          masterList.push(p);
          newItems.push(p);
          finalParts.push(p);
        }
      }
      const itemValue = finalParts.join(', ');

      const paidValue = findBestMatch(entry.paid_or_not || '', paidDropdown.values) || entry.paid_or_not || '';

      sheet.getRange(row, COL.SNO).setValue(maxSno);
      sheet.getRange(row, COL.NAME).setValue(entry.name || '');

      const itemCell = sheet.getRange(row, COL.ITEM);
      itemCell.clearDataValidations(); // Clear strict validation FIRST so setValue accepts comma-separated values
      itemCell.setValue(itemValue);
      if (chipValidationRule) {
        apiRequests.push(buildSetValidationRequest(sheet.getSheetId(), row, COL.ITEM, chipValidationRule));
      } else if (!String(itemValue).includes(',')) {
        applyRangeDropdown(itemCell, masterSheet);
      }

      sheet.getRange(row, COL.AMOUNT).setValue(toNumber(entry.amount));

      const paidCell = sheet.getRange(row, COL.PAID);
      paidCell.clearDataValidations();
      paidCell.setValue(paidValue);
      applyListDropdown(paidCell, paidDropdown.values);

      sheet.getRange(row, COL.MODE).setValue(entry.mode_of_payment || '');

      written.push({ row, sno: maxSno, name: entry.name, item_written: itemValue, paid_written: paidValue });
      nextWriteRow += 1;
    }

    // Flush batched Sheets API validation requests.
    let apiUsed = false;
    if (apiRequests.length > 0 && typeof Sheets !== 'undefined') {
      try {
        Sheets.Spreadsheets.batchUpdate({ requests: apiRequests }, ss.getId());
        apiUsed = true;
      } catch (err) {
        // Service not available or other issue - log but continue.
      }
    }

    return jsonOut({ success: true, dateLabel, rowsAdded: written.length, written, newItems, masterListSize: masterList.length, apiUsed, chipFound: !!chipValidationRule });
  } catch (err) {
    return jsonOut({ success: false, error: err.message, stack: err.stack });
  }
}

// ---- Sheets API: read raw validation rule from existing chip cell ----

function readChipValidationViaApi(ss, sheet) {
  if (typeof Sheets === 'undefined') return null;
  try {
    // Find a row in the item column whose value has a comma (multi-item).
    const lastRow = sheet.getLastRow();
    let sourceRow = -1;
    for (let r = 1; r <= Math.min(lastRow, 300); r++) {
      const v = String(sheet.getRange(r, COL.ITEM).getValue()).trim();
      if (v.includes(',')) { sourceRow = r; break; }
    }
    if (sourceRow === -1) return null;

    const a1 = sheet.getName() + '!' + columnToLetter(COL.ITEM) + sourceRow + ':' + columnToLetter(COL.ITEM) + sourceRow;
    const resp = Sheets.Spreadsheets.get(ss.getId(), {
      ranges: [a1],
      fields: 'sheets/data/rowData/values/dataValidation',
    });
    const dv = resp.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.dataValidation;
    return dv || null;
  } catch (err) {
    return null;
  }
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

// ---- Section management ----

function findExistingDateRowColor(sheet) {
  const lastRow = sheet.getLastRow();
  const colVals = sheet.getRange(1, COL.DATE_LABEL, Math.min(lastRow, 500), 1).getValues();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  for (let i = 0; i < colVals.length; i++) {
    const v = String(colVals[i][0]).trim();
    if (!v) continue;
    if (monthNames.some(m => v.startsWith(m))) {
      const bg = sheet.getRange(i + 1, COL.DATE_LABEL).getBackground();
      if (bg && bg !== '#ffffff' && bg !== '#000000') return bg;
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
  const colVals = sheet.getRange(1, COL.DATE_LABEL, lastRow, 1).getValues();

  let labelRow = -1;
  for (let i = 0; i < colVals.length; i++) {
    if (String(colVals[i][0]).trim() === dateLabel) {
      labelRow = i + 1;
      break;
    }
  }

  if (labelRow === -1) {
    const startAt = lastRow + 3;
    const greenColor = findExistingDateRowColor(sheet) || '#b6d7a8';
    sheet.getRange(startAt, 1, 1, 10).setBackground(greenColor);
    sheet.getRange(startAt, COL.DATE_LABEL).setValue(dateLabel).setFontWeight('bold');
    const headerRow = startAt + 1;
    sheet.getRange(headerRow, COL.SNO, 1, HEADERS.length).setValues([HEADERS]);
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
