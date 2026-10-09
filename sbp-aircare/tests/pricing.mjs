// Rev.09 r9 — price-policy check (no browser): every price the site can show is a round hundred before VAT,
// tax-invoice maths, and the public quantity ladder of the annual contract. usage: node tests/pricing.mjs
import { readFileSync } from 'node:fs';
globalThis.__SBP_DATA = JSON.parse(readFileSync(new URL('../assets/sbp-data.json', import.meta.url), 'utf8'));
const core = await import('../assets/sbp-core.js');
const { DATA, DEMO, loadData, estimateContract, VOLUME_TIERS, tierFor, withTax, vatOf, r100, TRAVEL, PRESETS, CLEAN_PKGS, SIZE_BANDS } = core;
await loadData();
const bad = [], n = { prices: 0 };
const round = (what, v) => { if (v == null) return; n.prices++; if (v % 100) bad.push([what, v]); };
DEMO.models.forEach(m => m.skus.forEach(s => { round('px ' + s.sku, s.px); round('price ' + s.sku, s.price); round('install ' + s.sku, s.installStdEx); }));
DATA.inst.forEach(i => round('inst ' + i.code, i.ex));
DATA.clean.forEach(r => { round('clean ' + r.pkg + ' ' + r.level + ' ' + r.ty + ' ' + r.range, r.rate.s); if (r.rate.sp != null || r.rate.pj != null) bad.push(['special/project rate in browser', r.name]); });
DATA.rep.forEach(r => { round('rep ' + r.name, r.rate.s); if (r.rate.sp != null || r.rate.pj != null) bad.push(['special/project rate in browser', r.name]); });
round('minBill', DATA.minBill);
TRAVEL.bands.forEach(b => round('travel ' + b.id, b.fee(0)));
// rounding rule: half up to the nearest hundred
[[650, 700], [550, 600], [1050, 1100], [120, 100], [149, 100], [150, 200], [55, 100], [4500, 4500], [0, 0]].forEach(([a, b]) => { if (r100(a) !== b) bad.push(['r100', a, r100(a), b]); });
// tax: individual pays the shown price, tax invoice = + VAT 7%
const t0 = withTax(12300, 'none'), t1 = withTax(12300, 'invoice');
if (t0.total !== 12300 || t0.vat !== 0) bad.push(['tax none', t0]);
if (t1.vat !== 861 || t1.total !== 13161 || vatOf(12300) !== 861) bad.push(['tax invoice', t1]);
// ladder: contiguous, non-decreasing, capped; every contract total stays a round hundred
VOLUME_TIERS.forEach((t, i) => { if (i && (t.min !== VOLUME_TIERS[i - 1].max + 1 || t.off < VOLUME_TIERS[i - 1].off)) bad.push(['tier order', t.th]); if (t.off > 0.07) bad.push(['tier above cap', t.th]); });
[1, 9, 10, 29, 30, 59, 60, 99, 100, 500].forEach(k => { const t = tierFor(k); if (k < t.min || k > t.max) bad.push(['tierFor', k]); });
let checked = 0;
for (const pkg of CLEAN_PKGS.map(p => p.id)) for (const size of SIZE_BANDS.map(b => b.id)) for (const visits of [2, 3, 4]) for (const k of [1, 5, 9, 10, 25, 30, 45, 60, 99, 100, 140]) for (const deep of [true, false]) {
  const e = estimateContract({ units: { wall: Math.ceil(k * 0.6), cassette: Math.floor(k * 0.4) }, visits, pkg, size, deep });
  checked++;
  ['annualEx', 'annualStd', 'discount', 'perVisitC1', 'perVisitC2', 'perUnitYear'].forEach(f => { if (e[f] % 100) bad.push(['contract not round', f, e[f], pkg, size, k]); });
  if (e.annualEx > e.annualStd) bad.push(['discount negative', pkg, size, k]);
  if (e.perVisitC1 < DATA.minBill) bad.push(['below minimum', pkg, size, k]);
  if (e.annualInc !== e.annualEx + vatOf(e.annualEx)) bad.push(['contract vat', k]);
}
PRESETS.forEach(p => { const e = estimateContract({ units: p.units, visits: p.visits }); console.log(`  ${p.th.padEnd(16)} ${String(e.count).padStart(3)} เครื่อง · ${e.tierTh.padEnd(30)} · มาตรฐาน ${e.annualStd.toLocaleString()} → ${e.annualEx.toLocaleString()} ก่อน VAT · ใบกำกับภาษี ${e.annualInc.toLocaleString()}`); });
console.log(JSON.stringify({ prices: n.prices, contractsChecked: checked, problems: bad.length }));
bad.slice(0, 30).forEach(b => console.log(b));
process.exit(bad.length ? 1 : 0);
