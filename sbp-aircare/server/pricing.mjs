// SBP AirCare server — server-side quote recalculation. Rev.10.
// Runs the SAME assets/sbp-core.js the browser runs (same r100 rounding, VAT, travel bands, 4,500 cleaning minimum,
// contract ladder — CLAUDE.md §6.6 #1–#3, #8, #9), on the same public assets/sbp-data.json. Never reads the internal
// pricebook extract (internal/sbp_real.json): special / project rates stay out of the server's answers entirely.
// Every cart line is priced from its key (P- I- IN- CL- C- CX- R- RP- A- K- S- SV- PJ-), never from the number the
// browser sent; the browser's figures are kept beside the server's so staff can see any difference.
// Browser-safe module graph: the artifact test site (assets/artifact-api.js) bundles this file and calls initPricing() with
// the page's own sbp-core.js; the Node-only imports live inside loadPricing() (non-literal import(), so bundlers skip them).

// same as util.mjs str / own (util.mjs imports node:crypto, which a browser bundle cannot carry)
const str = (v, max = 120) => (v == null ? '' : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max));
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const nodeImport = s => import(s);

let core = null;
const SKU = new Map();
export const pricing = { version: '', sha: '', loaded: false };

// server: reads assets/sbp-data.json under the site root and loads assets/sbp-core.js from there
export async function loadPricing(root) {
  if (pricing.loaded) return pricing;
  const [{ readFileSync }, { join }, { pathToFileURL }, { sha256 }] = await Promise.all(['node:fs', 'node:path', 'node:url', './util.mjs'].map(nodeImport));
  const raw = readFileSync(join(root, 'assets', 'sbp-data.json'), 'utf8');
  globalThis.__SBP_DATA = JSON.parse(raw);   // sbp-core.loadData() reads the inlined data first (no fetch of file: URLs in Node)
  const m = await import(pathToFileURL(join(root, 'assets', 'sbp-core.js')).href);
  await m.loadData();
  delete globalThis.__SBP_DATA;
  return initPricing(m, { sha: sha256(raw).slice(0, 12) });
}
// browser (or a caller that already loaded sbp-core.js): m = the sbp-core module after loadData()
export function initPricing(m, { sha = '' } = {}) {
  if (pricing.loaded) return pricing;
  core = m; SKU.clear();
  for (const x of core.DEMO.models) for (const s of x.skus) SKU.set(s.sku, { px: s.px, type: x.type, btu: s.btu, brand: x.brand });
  Object.assign(pricing, { version: core.DATA.version, sha, loaded: true, skus: SKU.size });
  return pricing;
}
export const coreApi = () => core;

const GROUPS = { product: 1, install: 1, clean: 1, repair: 1, addon: 1, contract: 1 };
const KINDS = { product: 1, service: 1, addon: 1, survey: 1 };
const clampQty = q => Math.max(1, Math.min(999, Math.floor(+q) || 1));
const num = v => (v == null || v === '' || !Number.isFinite(+v) ? null : +v);

// INS-<W|C|K|FS|DUCT>-<lo>-<hi>-<STANDARD|PREMIUM>[-<room name>]
const instFromKey = rest => { const m = /^(INS-[A-Z]+-\d+-\d+-(?:STANDARD|PREMIUM))(?:-|$)/.exec(rest); return m && core.DATA.instByCode[m[1]]; };
// A-<code>[-FIT | -<room name>]: exact code first, then the longest known code followed by '-'
function itemFromKey(rest) {
  const D = core.DATA.instByCode;
  if (own(D, rest)) return D[rest];
  let best = null;
  for (const c of Object.keys(D)) if (rest.startsWith(c + '-') && (!best || c.length > best.code.length)) best = D[c];
  return best;
}

function priceLine(l) {
  const key = str(l && l.key, 200), name = str(l && l.name, 160), qty = clampQty(l && l.qty);
  const group = own(GROUPS, l && l.group) ? l.group : '', kind = own(KINDS, l && l.kind) ? l.kind : '';
  const client = num(l && l.unitEx);
  const units = num(l && l.units);
  let server = null, known = true, note = '';
  const D = core.DATA;
  if (!key) known = false;
  else if (core.isVRF(name, l && l.detail)) { server = null; note = 'vrf'; }
  else if (key.startsWith('P-')) { const s = SKU.get(key.slice(2)); if (s) server = s.px; else known = false; }
  else if (key.startsWith('I-') || key.startsWith('IN-')) { const it = instFromKey(key.slice(key.indexOf('-') + 1)); if (it) server = it.ex; else known = false; }
  else if (key.startsWith('CL-')) {
    const m = /^CL-(.+)-(C1|C2)-([a-z]+)-(\d)$/.exec(key), r = m && core.cleanRate(m[1], m[2], m[3], +m[4]);
    if (r) server = r.rate.s; else known = false;
  } else if (key.startsWith('CX-')) {
    const nm = key.slice(3), pkg = str(l.pkg), level = str(l.level, 4);
    const rows = D.clean.filter(r => !r.type && r.name === nm && (!pkg || r.pkg === pkg) && (!level || r.level === level));
    const prices = [...new Set(rows.map(r => r.rate.s))];
    if (!rows.length) known = false;
    else if (prices.length === 1) server = prices[0];
    else if (client != null && prices.includes(client)) { server = client; note = 'package_price'; }   // one of the public package prices
    else if (prices.every(p => p == null)) server = null;
    else { known = false; note = 'ambiguous'; }
  } else if (key.startsWith('C-')) {
    const m = /^C-(.+?)-(C1|C2)-([a-z]+)-(.+)$/.exec(key), r = m && D.clean.find(x => x.pkg === m[1] && x.level === m[2] && x.type === m[3] && x.range === m[4]);
    if (r) server = r.rate.s; else known = false;
  } else if (key.startsWith('R-') || key.startsWith('RP-')) {
    const nm = key.slice(key.indexOf('-') + 1), r = D.rep.find(x => x.name === nm);
    if (r) server = r.rate.s; else known = false;
  } else if (key.startsWith('A-')) {
    const it = itemFromKey(key.slice(2));
    if (!it) known = false;
    else if (it.ex == null) server = null;
    else {
      // per-machine metres / pieces are folded into the browser's unit price (commerce.js addToCart, roomfit, business)
      const per = num(l.per);
      if (per && per > 0 && per <= 999) server = it.ex * per;
      else if (client != null && client > 0 && client % it.ex === 0 && client / it.ex <= 999) { server = client; note = 'x' + client / it.ex; }
      else server = it.ex;
    }
  } else if (key.startsWith('K-')) {
    // annual contracts: priced by estimateContract when the line carries its spec; otherwise staff confirm the figure
    const sp = l.spec && typeof l.spec === 'object' ? l.spec : null;
    if (sp && sp.units && typeof sp.units === 'object') {
      const u = {}; for (const [t, n] of Object.entries(sp.units)) if (/^[a-z]{2,10}$/.test(t) && +n > 0) u[t] = Math.min(9999, Math.floor(+n));
      const e = core.estimateContract({ units: u, visits: Math.max(1, Math.min(12, Math.floor(+sp.visits) || 1)), pkg: str(sp.pkg) || 'Standard Care', size: Math.max(0, Math.min(3, Math.floor(+sp.size) || 0)), deep: sp.deep !== false, zone: sp.zoneInput ? core.checkZone(str(sp.zoneInput)) : null });
      if (e.count) server = e.annualEx; else known = false;
    } else { known = false; note = 'contract_estimate'; }
  } else if (/^(S|SV|PJ)-/.test(key)) server = null;
  else known = false;

  let check;
  if (!known) { check = 'unverified'; server = client; }
  else if (server == null) check = client == null ? 'survey' : 'survey_has_price';
  else check = client === server ? 'ok' : 'mismatch';
  return { key, name, detail: str(l && l.detail, 160), group, kind: server == null ? 'survey' : kind, qty, unitEx: server, clientUnitEx: client, ...(units != null ? { units } : {}), check, ...(note ? { note } : {}) };
}

// q = the browser's quote object (ticket.js quoteFromCart): {totalEx, tax, vat, total, travel, minGap, zoneInput?, lines:[{key,group,kind,name,qty,unitEx,units?,per?,pkg?,level?,spec?}]}
export function recompute(q, fallbackArea = '') {
  if (!q || typeof q !== 'object' || !Array.isArray(q.lines) || !q.lines.length) return null;
  const tax = q.tax === 'invoice' ? 'invoice' : 'none';
  const lines = q.lines.slice(0, 200).map(priceLine);
  let ex = 0, cleanEx = 0;
  for (const L of lines) if (L.unitEx != null) { ex += L.unitEx * L.qty; if (L.group === 'clean') cleanEx += L.unitEx * L.qty; }
  const zoneInput = str(q.zoneInput != null ? q.zoneInput : fallbackArea);
  const zone = zoneInput ? core.checkZone(zoneInput) : null;
  // same machine count and trip rule as commerce.js cart.units()/totals()
  const by = {}; for (const L of lines) if (['product', 'install', 'clean', 'repair'].includes(L.group)) by[L.group] = (by[L.group] || 0) + (L.units || L.qty);
  const units = Math.max(0, ...Object.values(by));
  const oneOff = lines.some(L => L.group !== 'contract' && L.kind !== 'survey');
  const tc = oneOff ? core.travelCharge(zone, units) : { fee: 0, waived: false, short: 0 };
  const minBill = core.DATA.minBill;
  const minGap = cleanEx > 0 && cleanEx < minBill ? minBill - cleanEx : 0;
  const totalEx = ex + tc.fee + minGap;
  const tx = core.withTax(totalEx, tax);
  const totals = { ex, travel: tc.fee, travelWaived: !!tc.waived, travelShort: tc.short || 0, units, minGap, totalEx, tax, vat: tx.vat, total: tx.total };
  const client = { totalEx: num(q.totalEx), vat: num(q.vat), total: num(q.total), travel: num(q.travel), minGap: num(q.minGap) };
  const issues = [];
  lines.forEach((L, i) => { if (L.check === 'mismatch' || L.check === 'survey_has_price' || L.check === 'unverified') issues.push({ line: i, key: L.key, check: L.check, client: L.clientUnitEx, server: L.unitEx, ...(L.note ? { note: L.note } : {}) }); });
  for (const k of ['totalEx', 'vat', 'total', 'travel', 'minGap']) if (client[k] != null && client[k] !== totals[k]) issues.push({ total: k, client: client[k], server: totals[k] });
  const verified = lines.every(L => L.check !== 'unverified');   // the server knows every line's public price
  const surveys = lines.filter(L => L.unitEx == null).length;
  return {
    v: pricing.sha, tax, zone: zone ? { input: zoneInput, tier: zone.tier, fee: zone.fee == null ? null : zone.fee, km: zone.km == null ? null : zone.km } : null,
    lines, totals, client, verified, surveys, match: !issues.length, issues,
    // a figure the office may ask the customer to pay without re-pricing: every line priced by the server, nothing left to
    // assess on site, a known service area, no annual contract (contracts are quoted formally), no product (stock is
    // confirmed by the sales team first — sbp-core stock 'check')
    payable: verified && !surveys && !!zone && (zone.tier === 'core' || zone.tier === 'extended') && !(tc.short > 0)
      && !lines.some(L => L.group === 'contract' || L.group === 'product') && tx.total > 0,
  };
}

// '• name × qty = ฿amount' lines for the sheet/board column (server prices; surveys marked like Code.gs) — Rev.10 UX: baht sign +
// thousands separators, plus the cleaning-minimum top-up and the travel fee as their own lines so the lines add up to รวมก่อน VAT
const thb = n => '฿' + n.toLocaleString('en-US');
export const quoteLinesText = rq => [...rq.lines.map(L => '• ' + L.name + (L.detail ? ` (${L.detail})` : '') + ' × ' + L.qty + (L.unitEx == null ? ' (ประเมินหน้างาน)' : ' = ' + thb(L.unitEx * L.qty))),
  rq.totals && rq.totals.minGap > 0 ? '• ส่วนเติมยอดขั้นต่ำงานล้าง ' + thb(rq.totals.minGap) : '', rq.totals && rq.totals.travel > 0 ? '• ค่าเดินทาง ' + thb(rq.totals.travel) : ''].filter(Boolean).join('\n');
