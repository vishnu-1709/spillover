/**
 * SPILLOVER site forms → Google Sheet.
 * Paste this into a Google Apps Script project attached to a Google Sheet,
 * then deploy it as a Web app (see README → "Connect the forms").
 *
 * Tester sign-ups go to a tab called "Testers", feedback to "Feedback".
 * Duplicate tester emails are not added twice.
 */
function doPost(e) {
  var p = (e && e.parameter) || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (p.form === "tester") {
      var t = sheet_(ss, "Testers", ["Time", "Name", "Email", "Phone", "Consent", "Page"]);
      var email = String(p.email || "").trim().toLowerCase();
      if (!email) return ok_();
      var last = t.getLastRow();
      if (last > 1) {
        var existing = t.getRange(2, 3, last - 1, 1).getValues().map(function (r) { return String(r[0]).toLowerCase(); });
        if (existing.indexOf(email) !== -1) return ok_();
      }
      t.appendRow([new Date(), clip_(p.name), email, clip_(p.phone), p.consent || "", clip_(p.page)]);
    } else if (p.form === "feedback") {
      var f = sheet_(ss, "Feedback", ["Time", "Modes", "Rating", "What was fun", "What to fix", "Phone / players", "Email", "Page"]);
      f.appendRow([new Date(), clip_(p.modes), clip_(p.rating), clip_(p.good), clip_(p.bad), clip_(p.phone), clip_(p.email), clip_(p.page)]);
    }
  } finally {
    lock.releaseLock();
  }
  return ok_();
}

function sheet_(ss, name, headers) {
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(headers);
    s.setFrozenRows(1);
  }
  return s;
}

// Keep cells short and stop spreadsheet formulas being injected.
function clip_(v) {
  var s = String(v == null ? "" : v).slice(0, 2000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function ok_() {
  return ContentService.createTextOutput("ok");
}
