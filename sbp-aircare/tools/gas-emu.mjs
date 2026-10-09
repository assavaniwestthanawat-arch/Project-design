// SBP AirCare — a small emulator of the Google Apps Script services the back office uses (Rev.09 r10).
// Runs backoffice/apps-script/Code.gs unchanged inside a Node vm, so the ticket API can be unit-tested and served locally
// before it is deployed on Google. Emulates the behaviour that matters for correctness:
//   · Sheets turns number-looking text into numbers (drops the leading 0 of a phone number) unless the cell format is '@'
//   · a value starting with '=' becomes a formula unless it is prefixed with an apostrophe (the apostrophe is not stored)
//   · script lock, script properties, cache with expiry, JSON text output, Bangkok time formatting
// Mail / UrlFetch calls are recorded (outbox), never sent.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function createGas({ props = {}, state = null, now = () => new Date() } = {}) {
  const outbox = [], fetches = [];
  const sheets = new Map();   // name -> { cells: [[{v, f}]], fmt: Set('r,c'), frozen }
  if (state) for (const [name, s] of Object.entries(state.sheets || {})) sheets.set(name, { cells: s.cells, fmt: new Set(s.fmt), frozen: s.frozen || 0 });
  const P = { ...(state ? state.props : {}), ...props };
  const cache = new Map();

  const makeSheet = name => {
    const S = sheets.get(name);
    const lastRow = () => { for (let r = S.cells.length; r > 0; r--) if ((S.cells[r - 1] || []).some(c => c && c.v !== '' && c.v != null)) return r; return 0; };
    const range = (row, col, nr = 1, nc = 1) => {
      const R = {
        setValues(vals) {
          if (vals.length !== nr || vals.some(r => r.length !== nc)) throw new Error(`setValues: data ${vals.length}x${vals[0]?.length} does not match range ${nr}x${nc}`);
          vals.forEach((r, i) => r.forEach((v, j) => {
            const rr = row + i, cc = col + j; (S.cells[rr - 1] = S.cells[rr - 1] || [])[cc - 1] = store(v, S.fmt.has(`${rr},${cc}`));
          }));
          return R;
        },
        getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const c = (S.cells[row + i - 1] || [])[col + j - 1]; return c ? c.v : ''; })); },
        setNumberFormat(f) { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { const k = `${row + i},${col + j}`; f === '@' ? S.fmt.add(k) : S.fmt.delete(k); } return R; },
        setFontWeight() { return R; },
      };
      return R;
    };
    return {
      getName: () => name, getLastRow: lastRow, getLastColumn: () => Math.max(0, ...S.cells.map(r => (r || []).length)),
      getRange: (a, b, c, d) => { if (typeof a === 'string') throw new Error('A1 ranges are not emulated — use row/column numbers'); return range(a, b, c, d); },
      setFrozenRows(n) { S.frozen = n; }, getMaxRows: () => Math.max(1000, S.cells.length),
    };
  };
  // what Google Sheets keeps when a script writes a value
  function store(v, text) {
    if (typeof v === 'string') {
      if (v.startsWith("'")) return { v: v.slice(1) };                         // apostrophe = literal text, not stored
      if (v.startsWith('=')) return { v: '#FORMULA', f: v };                    // would be evaluated as a formula
      if (!text && /^[+-]?\d+(\.\d+)?$/.test(v.trim())) return { v: Number(v) };  // "0812345678" → 812345678 unless the cell is plain text
    }
    return { v };
  }
  const ss = {
    getSheetByName: n => (sheets.has(n) ? makeSheet(n) : null),
    insertSheet: n => { sheets.set(n, { cells: [], fmt: new Set(), frozen: 0 }); return makeSheet(n); },
  };
  const pad = n => String(n).padStart(2, '0');
  const g = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in P ? String(P[k]) : null), setProperty: (k, v) => { P[k] = String(v); }, getProperties: () => ({ ...P }) }) },
    CacheService: { getScriptCache: () => ({ get: k => { const c = cache.get(k); return c && c.exp > now().getTime() ? c.v : null; }, put: (k, v, ttl = 600) => cache.set(k, { v: String(v), exp: now().getTime() + ttl * 1000 }) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: s => { const o = { content: s, mime: 'text/plain', setMimeType(m) { o.mime = m; return o; }, getContent: () => s }; return o; } },
    Utilities: {
      formatDate(d, tz, fmt) {
        if (tz !== 'Asia/Bangkok') throw new Error('emulator: only Asia/Bangkok');
        const b = new Date(d.getTime() + 7 * 3600e3);   // Thailand has no daylight saving
        const map = { yyyy: b.getUTCFullYear(), yy: pad(b.getUTCFullYear() % 100), MM: pad(b.getUTCMonth() + 1), dd: pad(b.getUTCDate()), HH: pad(b.getUTCHours()), mm: pad(b.getUTCMinutes()), ss: pad(b.getUTCSeconds()) };
        return fmt.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, t => map[t]);
      },
    },
    MailApp: { sendEmail: m => outbox.push({ ...m, at: now().toISOString() }) },
    UrlFetchApp: { fetch: (url, o) => { fetches.push({ url, o }); return { getResponseCode: () => 200, getContentText: () => '{}' }; } },
    console,
  };
  const ctx = vm.createContext(g);
  vm.runInContext(readFileSync(new URL('../backoffice/apps-script/Code.gs', import.meta.url), 'utf8'), ctx, { filename: 'Code.gs' });
  const call = (fn, e) => JSON.parse(ctx[fn](e).getContent());
  return {
    post: body => call('doPost', { postData: { contents: typeof body === 'string' ? body : JSON.stringify(body), type: 'text/plain' } }),
    get: (params = {}) => call('doGet', { parameter: params }),
    outbox, fetches, props: P,
    sheet: (name = 'Tickets') => { const S = sheets.get(name); return S ? S.cells.map(r => (r || []).map(c => (c ? c.v : ''))) : null; },
    formulas: (name = 'Tickets') => { const S = sheets.get(name); return S ? S.cells.flat().filter(c => c && c.f).map(c => c.f) : []; },
    dump: () => ({ props: P, sheets: Object.fromEntries([...sheets].map(([n, s]) => [n, { cells: s.cells, fmt: [...s.fmt], frozen: s.frozen }])) }),
  };
}
