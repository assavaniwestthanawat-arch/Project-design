// SBP AirCare — page wiring shared by the v2 editions (r12: a2/b2/c2/d2.html). Each edition is its own art direction and
// layout; the behaviour is one: a single cinematic stage that visits the hero, the concierge and the showroom ([data-stage]
// slots), the service chapters, business tabs, booking, quote basket, area check, FAQ and contact — each mounted when the
// visitor gets near it, so the first paint is static HTML and a poster frame.
// mountV2({variant, mood, quality, bars, place, hero}) — hero = the hero slot's own scene cycle (auto shots)
import { loadData, COMPANY, FAQ, cleanRate, h, $, $$ } from './sbp-core.js';
import { installRows } from './jobcard.js';
import { mountZone, mountFaq, wireDrawers, openDrawer, closeDrawer, toast } from './proto-ui.js';
import { mountCart, productDetail, mountPriceCenter, cart } from './commerce.js';
import { enhanceQuoteForm } from './contact.js';
import { travelTable } from './journey.js';
import { mountBooking } from './booking.js';
import { whenNear, onDemand, mountCleanChapter, mountInstallChapter, mountRepairChapter, wireContactForm, fillFacts } from './dstudio.js';
import { createStage, stageLabels } from './stage.js';
import { mountConcierge } from './concierge.js';
import { mountShowroom } from './showroom.js';
import { mountBeta } from './feedback.js';

export async function mountV2({ variant = 'A2', mood = 'aurora', quality = 'auto', bars = false, place = 'home', theme = 'dark', srStart = {} } = {}) {
  await loadData();
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = sel => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); };
  fillFacts();
  $$('[data-company]').forEach(el => { const k = el.dataset.company; if (COMPANY[k]) el.textContent = COMPANY[k]; if (k === 'tel' && el.href) el.href = COMPANY.telHref; });

  // header menu (narrow screens)
  const menu = $('.v-menu'), nav = $('#v-nav');
  if (menu && nav) {
    menu.addEventListener('click', () => { const o = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(o)); nav.classList.toggle('open', o); });
    nav.addEventListener('click', e => { if (e.target.closest('a')) { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); } });
  }
  const hd = $('.v-hd');
  if (hd) { const upd = () => hd.classList.toggle('solid', scrollY > 40); addEventListener('scroll', upd, { passive: true }); upd(); }

  // the stage (one WebGL context for the whole page)
  const stage = createStage({ mood, quality, bars });

  // basket + booking
  mountCart();
  let BK = null;
  const booking = () => BK || (BK = mountBooking($('#bookRoot'), { variant, hl: 'h3' }));
  whenNear($('#booking'), booking, '900px 0px');
  const book = p => { booking().preset(p || {}); go('#booking'); };
  $$('[data-book]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); book({ service: b.dataset.book || undefined }); }));

  // drawers: price centre, product detail, room fit
  let PC = null;
  const openPrices = tab => { const body = $('#drawerBody'); body.replaceChildren(); const box = h('div', { id: 'priceCenter' }); body.append(h('h3', { class: 'd-dh' }, 'ราคาค่าบริการทั้งหมด'), box); PC = mountPriceCenter(box); PC.show(tab); openDrawer($('#drawer')); };
  $$('[data-prices]').forEach(b => b.addEventListener('click', () => openPrices(b.dataset.prices || 'clean')));
  let FIT = null;
  async function openFit() {
    const host = $('#vFit'); if (!host) return null;
    if (!FIT) { const { mountRoomFit } = await import('./roomfit.js'); host.hidden = false; host.replaceChildren(); FIT = mountRoomFit(host, { theme, preset: place === 'office' ? 'office' : 'bedroom', onOpenModel: (m, i) => openProduct(m, i) }); $('#bFit')?.setAttribute('aria-expanded', 'true'); }
    host.hidden = false; go(host); return FIT;
  }
  function openProduct(m, idx = 0) {
    const body = $('#drawerBody'); body.replaceChildren(productDetail(m, idx, { onPick: i => openProduct(m, i), onFit: $('#vFit') ? (mm, i) => { closeDrawer($('#drawer')); openFit().then(F => F && F.setModel(mm, i)); } : null }));
    if ($('#drawer').hidden) openDrawer($('#drawer'));
  }
  const fitBtn = $('#bFit');
  if (fitBtn) { fitBtn.setAttribute('aria-controls', 'vFit'); fitBtn.setAttribute('aria-expanded', 'false'); fitBtn.addEventListener('click', () => { const host = $('#vFit'); if (FIT && !host.hidden) { host.hidden = true; fitBtn.setAttribute('aria-expanded', 'false'); } else openFit(); }); }
  wireDrawers();

  // hero sound toggle (WebAudio only after a click)
  $$('[data-sound]').forEach(b => b.addEventListener('click', () => stage.with(c => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(c.sound(on))); })));

  // showroom
  let SR = null;
  const srRoot = $('#srRoot'), srStage = $('#srStage');
  const showroom = () => SR || (srRoot && srStage ? (SR = mountShowroom(srRoot, { stage, slot: srStage, ctl: $('#srCtl'), start: srStart, onOpen: openProduct, onBook: book, hl: srRoot.closest('section')?.querySelector('h2') ? 'h3' : 'h2' })) : null);
  // (the roots may be display:contents — no box for an IntersectionObserver — so watch their section)
  if (srRoot) whenNear(srRoot.closest('section') || srRoot, showroom, '700px 0px');

  // concierge
  const ccRoot = $('#askRoot'), ccStage = $('#askStage');
  if (ccRoot && ccStage) {
    const labels = stageLabels(ccStage, stage);
    whenNear(ccRoot.closest('section') || ccRoot, () => mountConcierge(ccRoot, { stage, slot: ccStage, labels, place, onBook: book, onPrices: openPrices,
      onShop: f => { const s = showroom(); if (s) { s.filter(f); go('#models'); } } }), '700px 0px');
  }

  // service chapters (same content as แบบ D: steps from the company forms, prices from the Pricebook)
  // a price picked in a chapter table goes into the quote basket (the v2 pages have no job card)
  const LV = { C1: 'ล้างปกติ C1', C2: 'ล้างใหญ่ C2' };
  const toQuote = o => {
    if (o.job === 'clean') { const r = cleanRate(o.pkg, o.level, o.type, o.size); if (!r) return; cart.add({ kind: 'service', group: 'clean', key: `CL-${o.pkg}-${o.level}-${o.type}-${o.size}`, name: `${r.name} · ${LV[o.level]}`, detail: `${o.pkg} · ${r.warranty || ''}`, unitEx: r.rate.s, qty: 1 }); toast(`ใส่ใบเสนอราคาแล้ว ${r.name} · ${LV[o.level]}`); }
    else { const row = installRows(o.type)[o.i], it = row && (o.tier === 'PREMIUM' ? row.prem : row.std); if (!it) return; cart.add({ kind: 'service', group: 'install', key: `I-${it.code}`, name: it.name, detail: it.warranty || '', unitEx: it.ex, qty: 1 }); toast(`ใส่ใบเสนอราคาแล้ว ${it.name}`); }
  };
  whenNear($('#cleanRoot'), () => mountCleanChapter($('#cleanRoot'), { onPick: toQuote, pickTo: 'ใบเสนอราคา', pickWhere: 'ใบเสนอราคา' }));
  whenNear($('#installRoot'), () => mountInstallChapter($('#installRoot'), { onPick: toQuote, pickTo: 'ใบเสนอราคา' }));
  whenNear($('#repairRoot'), () => mountRepairChapter($('#repairRoot'), { onAll: () => openPrices('repair') }));
  const b3d = $('#b3dClean');
  if (b3d) onDemand(b3d, $('#v3dClean'), async host => { const { mountJobGuide } = await import('./jobguide.js'); host.replaceChildren(); mountJobGuide(host, { theme, start: 'C1', type: place === 'office' ? 'cassette' : 'wall' }); });

  // business tabs (contract + ladder / procedure + report / projects), each mounted on first view
  if ($('#business')) {
    const { mountAmc, mountSop, mountProjects } = await import('./business.js');
    const BIZ = { amc: () => { $('#amcRoot').replaceChildren(); mountAmc($('#amcRoot'), { hl: 'h3' }); }, sop: () => mountSop($('#sopRoot'), { hl: 'h3' }), projects: () => mountProjects($('#projRoot'), { hl: 'h3', onCatalog: () => go('#models') }) };
    const done = new Set(), tabs = $$('[data-biz]');
    const show = k => { tabs.forEach(b => { const on = b.dataset.biz === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('#' + b.dataset.biz).hidden = !on; }); if (!done.has(k)) { done.add(k); BIZ[k](); } };
    tabs.forEach((b, i) => { b.addEventListener('click', () => show(b.dataset.biz)); b.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; show(n.dataset.biz); n.focus(); }); });
    ['sop', 'projects'].forEach(k => { const el = $('#' + k); if (el) el.scrollIntoView = (...a) => { show(k); HTMLElement.prototype.scrollIntoView.apply(el, a); }; });
    addEventListener('hashchange', () => { const k = location.hash.slice(1); if (BIZ[k]) show(k); });
    whenNear($('#business'), () => { const k = location.hash.slice(1); show(BIZ[k] ? k : 'amc'); });
  }

  // area, FAQ, contact
  whenNear($('#area'), () => { mountZone($('#area [data-zone]')); $('#travelTbl')?.append(travelTable()); });
  whenNear($('#contact'), () => {
    const fl = $('#faqList'); if (fl) { FAQ.forEach(f => fl.append(h('details', { class: 'd-faq' }, h('summary', {}, f.q), h('p', {}, f.a)))); mountFaq(fl); }
    const qf = $('#qform'); if (qf) { enhanceQuoteForm(qf); wireContactForm(qf, { variant }); }
  });
  mountBeta({ variant });   // r13: beta notice + feedback form, as on every other edition
  document.documentElement.classList.add('v2-on');   // tests: the page script has finished wiring
  return { stage, book, go, openPrices, showroom, cart, toast };
}
