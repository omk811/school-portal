/*
 * المحبرة — واجهة بيانات عامة ولوحة معلم محمية.
 * شغّل setupSecurity() من محرر Apps Script مرة واحدة قبل نشر هذا الإصدار.
 */
const REACTIONS = ['like', 'love', 'thanks', 'applause', 'star'];
const BANNER_MARKER = '[[MIHBARA_FEATURED_BANNER]]';
const TICKER_ONLY_MARKER = '[[MIHBARA_TICKER_ONLY]]';
const REACTION_PREFIX = '[[MIHBARA_REACTIONS:';

function doGet(e) { return handleRequest(e, false); }
function doPost(e) { return handleRequest(e, true); }

function handleRequest(e, isPost) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || '');
  try {
    if (!action) return json({ status: 'error', message: 'No action specified' });
    if (action === 'loadData' && !isPost) return json(loadPublicData());
    if (action === 'authLogin' && isPost) return json(authLogin(String(p.password || '')));
    if (action === 'addComment' && isPost) return json(addComment(p));
    if (action === 'reactNotice' && isPost) return json(reactNotice(p));

    const adminActions = ['teacherLoadData', 'saveNotices', 'saveQueries', 'updateQuery',
      'deleteNotice', 'deleteQuery', 'changePassword'];
    if (!isPost || adminActions.indexOf(action) < 0) {
      return json({ status: 'error', message: 'Invalid action' });
    }
    if (!verifyToken(String(p.token || ''))) {
      return json({ status: 'error', code: 'AUTH_REQUIRED', message: 'Authentication required' });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      switch (action) {
        case 'teacherLoadData': return json(loadTeacherData());
        case 'saveNotices': return json(saveNotices(p.data));
        case 'saveQueries': return json(saveQueries(p.data));
        case 'updateQuery': return json(updateQuery(p.id, p.status, p.reply));
        case 'deleteNotice': return json(deleteNotice(p.id));
        case 'deleteQuery': return json(deleteQuery(p.id));
        case 'changePassword': return json(changePassword(p.newPassword));
      }
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json({ status: 'error', message: String(error && error.message || error) });
  }
  return json({ status: 'error', message: 'Invalid action' });
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function loadPublicData() {
  const all = readSheets();
  const comments = all.queries.filter(function(q) {
    return /^@post:\d+$/.test(String(q.student || ''));
  });
  return { status: 'success', data: { notices: all.notices, queries: comments } };
}

function loadTeacherData() {
  const all = readSheets();
  return { status: 'success', data: {
    notices: all.notices, queries: all.queries, nId: all.nId, qId: all.qId
  }};
}

function readSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const noticesSheet = ss.getSheetByName('notices');
  const queriesSheet = ss.getSheetByName('queries');
  const settingsSheet = ss.getSheetByName('settings');
  if (!noticesSheet || !queriesSheet || !settingsSheet) throw new Error('Required sheet is missing');

  const nd = noticesSheet.getDataRange().getValues();
  const notices = [];
  for (let i = 1; i < nd.length; i++) {
    if (nd[i][0] !== '' && nd[i][0] != null) notices.push({
      id: nd[i][0], type: nd[i][1], cls: nd[i][2], title: nd[i][3],
      det: nd[i][4], date: nd[i][5], img: nd[i][6] || ''
    });
  }
  const qd = queriesSheet.getDataRange().getValues();
  const queries = [];
  for (let i = 1; i < qd.length; i++) {
    if (qd[i][0] !== '' && qd[i][0] != null) queries.push({
      id: qd[i][0], name: qd[i][1], student: qd[i][2], cls: qd[i][3],
      msg: qd[i][4], date: qd[i][5], status: qd[i][6], reply: qd[i][7]
    });
  }
  const sd = settingsSheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < sd.length; i++) if (sd[i][0]) settings[String(sd[i][0])] = sd[i][1];
  return { notices: notices, queries: queries,
    nId: parseInt(settings.nId, 10) || 100, qId: parseInt(settings.qId, 10) || 100 };
}

function authLogin(password) {
  const props = PropertiesService.getScriptProperties();
  const hash = props.getProperty('ADMIN_PASSWORD_HASH');
  const salt = props.getProperty('ADMIN_PASSWORD_SALT');
  if (!hash || !salt || !props.getProperty('TOKEN_SIGNING_SECRET')) {
    return { status: 'error', code: 'SETUP_REQUIRED', message: 'Run setupSecurity() in Apps Script first.' };
  }
  if (!constantTimeEqual(hashPassword(password, salt), hash)) {
    return { status: 'error', code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' };
  }
  const version = Number(props.getProperty('AUTH_VERSION') || '1');
  const payload = b64url(JSON.stringify({
    role: 'teacher', exp: Date.now() + 6 * 60 * 60 * 1000,
    ver: version, nonce: Utilities.getUuid()
  }));
  const signature = b64url(Utilities.computeHmacSha256Signature(
    payload, props.getProperty('TOKEN_SIGNING_SECRET')));
  return { status: 'success', token: payload + '.' + signature, expiresIn: 21600 };
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('TOKEN_SIGNING_SECRET');
    if (!secret) return false;
    const expected = b64url(Utilities.computeHmacSha256Signature(parts[0], secret));
    if (!constantTimeEqual(expected, parts[1])) return false;
    const payload = JSON.parse(Utilities.newBlob(
      Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    return payload.role === 'teacher' &&
      Number(payload.exp) > Date.now() &&
      Number(payload.ver) === Number(props.getProperty('AUTH_VERSION') || '1');
  } catch (error) { return false; }
}

function hashPassword(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER');
  return b64url(Utilities.computeHmacSha256Signature(salt + '|' + password, pepper));
}

function b64url(value) {
  const bytes = typeof value === 'string'
    ? Utilities.newBlob(value).getBytes()
    : value;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Run once from the Apps Script editor. The temporary password is written only
 * to the private execution log; copy it, then change it from the teacher panel. */
function setupSecurity() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ADMIN_PASSWORD_HASH')) {
    Logger.log('Security is already initialized.');
    return;
  }
  const temporaryPassword = Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  const salt = Utilities.getUuid() + Utilities.getUuid();
  const pepper = Utilities.getUuid() + Utilities.getUuid();
  props.setProperties({
    TOKEN_SIGNING_SECRET: Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid(),
    PASSWORD_PEPPER: pepper,
    ADMIN_PASSWORD_SALT: salt,
    AUTH_VERSION: '1'
  });
  props.setProperty('ADMIN_PASSWORD_HASH', hashPassword(temporaryPassword, salt));
  removeLegacyPassword_();
  Logger.log('Temporary teacher password (copy privately): ' + temporaryPassword);
}

function removeLegacyPassword_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('settings');
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]).toLowerCase() === 'password') sheet.deleteRow(i + 1);
  }
}

function changePassword(newPassword) {
  const password = String(newPassword || '');
  if (password.length < 12 || password.length > 200) {
    return { status: 'error', message: 'Use a password between 12 and 200 characters.' };
  }
  const props = PropertiesService.getScriptProperties();
  const salt = Utilities.getUuid() + Utilities.getUuid();
  props.setProperties({
    ADMIN_PASSWORD_SALT: salt,
    ADMIN_PASSWORD_HASH: hashPassword(password, salt),
    AUTH_VERSION: String(Number(props.getProperty('AUTH_VERSION') || '1') + 1)
  });
  return { status: 'success', message: 'Password changed. Sign in again.' };
}

function saveNotices(noticesJson) {
  const notices = JSON.parse(noticesJson || '[]');
  if (!Array.isArray(notices) || notices.length > 500) throw new Error('Invalid notices list');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('notices');
  if (!sheet) throw new Error('Notices sheet is missing');
  const last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);
  if (notices.length) {
    const rows = notices.map(function(n) {
      return [n.id, n.type, n.cls, n.title, n.det || '', n.date || '', n.img || ''];
    });
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }
  const maxId = notices.length ? Math.max.apply(null, notices.map(function(n) {
    return Number(n.id) || 0;
  })) : 100;
  updateSetting('nId', maxId + 1);
  return { status: 'success' };
}

function saveQueries(queriesJson) {
  const queries = JSON.parse(queriesJson || '[]');
  if (!Array.isArray(queries) || queries.length > 3000) throw new Error('Invalid queries list');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('queries');
  if (!sheet) throw new Error('Queries sheet is missing');
  const last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);
  if (queries.length) {
    const rows = queries.map(function(q) {
      return [q.id, q.name, q.student, q.cls, q.msg, q.date, q.status || 'new', q.reply || ''];
    });
    sheet.getRange(2, 1, rows.length, 8).setValues(rows);
  }
  const maxId = queries.length ? Math.max.apply(null, queries.map(function(q) {
    return Number(q.id) || 0;
  })) : 100;
  updateSetting('qId', maxId + 1);
  return { status: 'success' };
}

function addComment(p) {
  const name = String(p.name || '').trim();
  const cls = String(p.cls || '');
  const msg = String(p.msg || '').trim();
  const noticeId = String(p.noticeId || '');
  if (name.length < 2 || name.length > 80 || msg.length < 1 || msg.length > 500 ||
      ['5A', '5B', '5C'].indexOf(cls) < 0 || !/^\d+$/.test(noticeId)) {
    return { status: 'error', message: 'Invalid comment' };
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const noticeRows = ss.getSheetByName('notices').getDataRange().getValues();
  if (!noticeRows.slice(1).some(function(row) { return String(row[0]) === noticeId; })) {
    return { status: 'error', message: 'Notice not found' };
  }
  const sheet = ss.getSheetByName('queries');
  const id = nextId_('qId', sheet);
  const date = Utilities.formatDate(new Date(), 'Asia/Muscat', 'dd/MM/yyyy HH:mm');
  const q = { id: id, name: name, student: '@post:' + noticeId, cls: cls,
    msg: msg, date: date, status: 'new', reply: '' };
  sheet.appendRow([q.id, q.name, q.student, q.cls, q.msg, q.date, q.status, q.reply]);
  return { status: 'success', comment: q };
}

function reactNotice(p) {
  const noticeId = String(p.noticeId || '');
  const reaction = String(p.reaction || '');
  const previous = String(p.previous || '');
  if (!/^\d+$/.test(noticeId) || REACTIONS.indexOf(reaction) < 0 ||
      (previous && REACTIONS.indexOf(previous) < 0)) return { status: 'error', message: 'Invalid reaction' };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('notices');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== noticeId) continue;
    const det = String(rows[i][4] || '');
    const oldMarker = det.match(/\[\[MIHBARA_REACTIONS:([^\]]*)\]\]/);
    const counts = {};
    if (oldMarker) oldMarker[1].split(';').forEach(function(part) {
      const bits = part.split('=');
      if (REACTIONS.indexOf(bits[0]) >= 0) counts[bits[0]] = Math.max(0, Number(bits[1]) || 0);
    });
    if (previous) counts[previous] = Math.max(0, (counts[previous] || 0) - 1);
    if (previous !== reaction) counts[reaction] = (counts[reaction] || 0) + 1;
    const markerData = REACTIONS.map(function(key) {
      return (counts[key] || 0) > 0 ? key + '=' + Math.floor(counts[key]) : '';
    }).filter(Boolean).join(';');
    const marker = markerData ? REACTION_PREFIX + markerData + ']]' : '';
    const details = det.replace(/\[\[MIHBARA_REACTIONS:[^\]]*\]\]/g, '').trim();
    sheet.getRange(i + 1, 5).setValue([details, marker].filter(Boolean).join('\n'));
    return { status: 'success' };
  }
  return { status: 'error', message: 'Notice not found' };
}

function updateQuery(id, status, reply) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('queries');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][0]) === String(id)) {
    sheet.getRange(i + 1, 7).setValue(status);
    sheet.getRange(i + 1, 8).setValue(reply);
    return { status: 'success' };
  }
  return { status: 'error', message: 'Query not found' };
}

function deleteNotice(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('notices');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][0]) === String(id)) {
    sheet.deleteRow(i + 1);
    return { status: 'success' };
  }
  return { status: 'error', message: 'Notice not found' };
}

function deleteQuery(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('queries');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][0]) === String(id)) {
    sheet.deleteRow(i + 1);
    return { status: 'success' };
  }
  return { status: 'error', message: 'Query not found' };
}

function nextId_(key, sheet) {
  const settings = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('settings');
  const data = settings.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][0]) === key) {
    const id = Math.max(Number(data[i][1]) || 100, sheet.getLastRow() + 100);
    settings.getRange(i + 1, 2).setValue(id + 1);
    return id;
  }
  const id = sheet.getLastRow() + 100;
  settings.appendRow([key, id + 1]);
  return id;
}

function updateSetting(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('settings');
  if (!sheet) throw new Error('Settings sheet is missing');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][0]) === key) {
    sheet.getRange(i + 1, 2).setValue(value);
    return;
  }
  sheet.appendRow([key, value]);
}

function initializeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('notices')) {
    const sheet = ss.insertSheet('notices');
    sheet.appendRow(['id', 'type', 'cls', 'title', 'det', 'date', 'img']);
  }
  if (!ss.getSheetByName('queries')) {
    const sheet = ss.insertSheet('queries');
    sheet.appendRow(['id', 'name', 'student', 'cls', 'msg', 'date', 'status', 'reply']);
  }
  if (!ss.getSheetByName('settings')) {
    const sheet = ss.insertSheet('settings');
    sheet.appendRow(['key', 'value']);
    sheet.appendRow(['nId', '100']);
    sheet.appendRow(['qId', '100']);
  }
}