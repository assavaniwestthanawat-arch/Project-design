// SBP AirCare — แบบ D "Studio" page chapters (Rev.10, owner 5 ต.ค. 2569). Variant D is the performance-first layout:
// the hero and every chapter heading are static HTML (first paint needs no script), and each chapter mounts only when the
// visitor gets near it (whenNear). Heavy 3D tools never load until a button asks for them.
// Content comes from the same sources as A/B/C — steps from services.js (the company forms), prices from the Pricebook.
// mountCleanChapter(root, {onPick}) · mountInstallChapter(root, {onPick}) · mountRepairChapter(root, {onAll})
// whenNear(el, fn, margin) · onDemand(btn, host, load) · wireContactForm(form, {variant}) · fillFacts(root)
import { DATA, DEMO, BRANDS, TYPE_BY_ID, SIZE_BANDS, CLEAN_PKGS, VOLUME_TIERS, cleanRate, baht, h, $, $$ } from './sbp-core.js';
import { PKG_INFO, METHOD_INFO, materialTable, cart } from './commerce.js';
import { cleanSteps, installSteps, repairSteps } from './services.js';
import { submitTicket, guardForm } from './contact.js';
import { quoteFromCart, sourceTag } from './ticket.js';
import { installRows, diagnosis } from './jobcard.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const TYPES4 = ['wall', 'ceiling', 'cassette', 'floor'];
const PH = { pre: 'ก่อนเริ่มงาน', work: 'ล้างที่ตัวเครื่อง', c2: 'ปลดเครื่องลงล้าง (เฉพาะ C2)', close: 'ประกอบกลับและเก็บงาน', test: 'ทดสอบหลังงาน', hand: 'ส่งมอบ' };
const IPH = { pre: 'ก่อนติดตั้ง', work: 'ติดตั้ง', test: 'ทดสอบ', hand: 'ส่งมอบ' };

/** run fn once when el comes within `margin` of the viewport (or immediately when it already is) */
// (the mount runs in an idle slot so it never joins the page's first long task)
const idle = fn => ('requestIdleCallback' in window ? requestIdleCallback(() => fn(), { timeout: 600 }) : setTimeout(fn, 1));
export function whenNear(el, fn, margin = '500px 0px') {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); idle(fn); } }, { rootMargin: margin });
  io.observe(el);
}
/** a button that loads a heavy tool into host on first press; later presses toggle it */
export function onDemand(btn, host, load) {
  let done = false;
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', host.id);
  btn.addEventListener('click', async () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open)); host.hidden = !open;
    if (open && !done) { done = true; btn.disabled = true; host.replaceChildren(h('p', { class: 'd-load' }, 'กำลังโหลด…')); try { await load(host); } catch (e) { host.replaceChildren(h('p', { class: 'd-load' }, 'โหลดไม่สำเร็จ ลองใหม่อีกครั้ง')); done = false; } btn.disabled = false; }
  });
}
const tabs = (opts, cur, label, onPick) => {
  const g = h('div', { class: 'd-tabs', role: 'group', 'aria-label': label });
  const draw = v => $$('button', g).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  opts.forEach(([v, th]) => g.append(h('button', { type: 'button', 'data-v': v, onclick: () => { draw(v); onPick(v); } }, th)));
  draw(cur); return g;
};
// steps grouped by phase as one ordered sequence (numbers continue across phases — it is one job)
function stepList(steps, names) {
  const out = h('div', { class: 'd-steps' }); let n = 0, cur = null, ol = null;
  steps.forEach(s => {
    if (s.ph !== cur) { cur = s.ph; out.append(h('h4', { class: 'd-ph' }, names[s.ph] || s.ph)); ol = h('ol', { start: n + 1 }); out.append(ol); }
    n++;
    ol.append(h('li', { class: s.off ? 'off' : '' }, h('b', {}, s.t), h('span', {}, s.d), s.off ? h('em', {}, 'ทำเมื่อลูกค้าอนุมัติหรือพบสิ่งผิดปกติ') : null));
  });
  return out;
}

/* ---------------- ล้างแอร์ ---------------- */
export function mountCleanChapter(root, { onPick, pickTo = 'ใบงาน', pickWhere = 'ใบงานด้านบน' } = {}) {   // r12: v2 pages put picks in the quote basket
  const S = { level: 'C1', type: 'wall', pkg: 'Standard Care' };
  // C1 vs C2 side by side — what each one does, how many steps, starting price per machine
  const from = lv => Math.min(...TYPES4.flatMap(t => SIZE_BANDS.map(b => cleanRate('Basic Clean', lv, t, b.id)?.rate.s).filter(v => v != null)));
  const method = h('div', { class: 'd-methods' }, ['C1', 'C2'].map(lv => {
    const M = METHOD_INFO.find(m => m.id === lv), n = cleanSteps('wall', lv, 'Standard Care').length;
    return h('section', { class: 'd-method' },
      h('h3', {}, M.th), h('p', {}, M.d),
      h('dl', {}, h('dt', {}, 'ขั้นตอน'), h('dd', {}, `${n} ขั้น (แอร์ติดผนัง)`), h('dt', {}, 'เริ่มต้น'), h('dd', {}, `${baht(from(lv))} ต่อเครื่อง`)),
      h('p', { class: 'd-when' }, lv === 'C1' ? 'เหมาะกับการล้างตามรอบ 3–6 เดือน เครื่องยังเย็นปกติ' : 'เหมาะเมื่อเห็นคราบดำที่ใบพัด กลิ่นอับไม่หาย หรือไม่ได้ล้างนานกว่าหนึ่งปี'));
  }));
  // the actual steps (services.cleanSteps — the company form) for the chosen type / method / package
  const stepsBox = h('div', { class: 'd-stepsbox' });
  const drawSteps = () => stepsBox.replaceChildren(stepList(cleanSteps(S.type, S.level, S.pkg), PH));
  const pickers = h('div', { class: 'd-pickers' },
    tabs([['C1', 'ล้างปกติ C1'], ['C2', 'ล้างใหญ่ C2']], S.level, 'วิธีล้าง', v => { S.level = v; drawSteps(); drawPrices(); }),
    tabs(TYPES4.map(t => [t, TYPE_BY_ID[t].th]), S.type, 'ประเภทแอร์', v => { S.type = v; drawSteps(); }),
    tabs(CLEAN_PKGS.map(p => [p.id, p.th]), S.pkg, 'แพ็กเกจ', v => { S.pkg = v; drawSteps(); }));
  // packages: what you receive (a real comparison table, not three look-alike cards)
  const pk = h('div', { class: 'd-scroll', tabindex: '0', role: 'region', 'aria-label': 'เทียบแพ็กเกจ' }, h('table', { class: 'd-table d-pk' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'แพ็กเกจ'), PKG_INFO.map(p => h('th', { scope: 'col' }, p.id)))),
    h('tbody', {},
      h('tr', {}, h('th', { scope: 'row' }, 'เหมาะกับ'), PKG_INFO.map(p => h('td', {}, p.fit))),
      h('tr', {}, h('th', { scope: 'row' }, 'สิ่งที่ได้รับ'), PKG_INFO.map(p => h('td', {}, h('ul', {}, p.gets.map(g => h('li', {}, g)))))),
      h('tr', {}, h('th', { scope: 'row' }, 'รับประกันและดูแลหลังงาน'), CLEAN_PKGS.map(p => h('td', {}, p.sub.split(' · ').slice(1).join(' และ ') || '—'))))));
  // price per machine: rows = type × size, columns = packages, for the chosen method
  const priceBox = h('div', { class: 'd-scroll', tabindex: '0', role: 'region', 'aria-label': 'ราคาต่อเครื่อง' });
  const drawPrices = () => priceBox.replaceChildren(h('table', { class: 'd-table d-price' },
    h('caption', {}, `ราคาต่อเครื่อง ${S.level === 'C1' ? 'ล้างปกติ C1' : 'ล้างใหญ่ C2'} ก่อน VAT`),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'ประเภท'), h('th', { scope: 'col' }, 'ขนาด (BTU)'), CLEAN_PKGS.map(p => h('th', { scope: 'col', class: 'r' }, p.th)))),
    TYPES4.map(t => {
      const bands = SIZE_BANDS.filter(b => cleanRate(CLEAN_PKGS[0].id, S.level, t, b.id));
      // one row group per type: the type name spans its size rows
      return h('tbody', { class: 'd-grp' }, bands.map((b, j) => {
        const rs = CLEAN_PKGS.map(p => cleanRate(p.id, S.level, t, b.id));
        return h('tr', {}, j ? null : h('th', { scope: 'rowgroup', rowspan: bands.length, class: 'd-gt' }, TYPE_BY_ID[t].th), h('td', { class: 'd-sz' }, (t === 'wall' ? b.wall : b.other).replace('<=', 'ไม่เกิน ').replace(/-/g, '–')),
          rs.map((r, i) => h('td', { class: 'r' }, r && r.rate.s != null ? h('button', { type: 'button', class: 'd-pick', 'aria-label': `${TYPE_BY_ID[t].th} ${b.id} ${CLEAN_PKGS[i].th} ${baht(r.rate.s)} ใส่ใน${pickTo}`, onclick: () => onPick && onPick({ job: 'clean', type: t, size: b.id, pkg: CLEAN_PKGS[i].id, level: S.level }) }, baht(r.rate.s)) : 'ประเมิน')));
      }));
    })));
  drawSteps(); drawPrices();
  root.replaceChildren(
    method,
    h('div', { class: 'd-split r-wide' },
      h('div', { class: 'd-col' }, h('h3', { class: 'd-h3' }, 'ช่างทำอะไรบ้าง ทีละขั้น'), h('p', { class: 'd-sub' }, 'ขั้นตอนเดียวกับแบบฟอร์มงานล้างของบริษัท SBP-SR-ACCL-UNI-001 Rev.07 เลือกวิธี ประเภท และแพ็กเกจเพื่อดูขั้นที่ตรงกับงานของคุณ'), pickers, stepsBox),
      h('div', { class: 'd-col d-sticky' },
        h('h3', { class: 'd-h3' }, 'ราคาต่อเครื่อง'), h('p', { class: 'd-sub' }, `กดราคาเพื่อใส่ใน${pickWhere} ยอดขั้นต่ำต่อการเข้างาน ${baht(DATA.minBill)} ก่อน VAT`), priceBox)),
    h('div', { class: 'd-wide' }, h('h3', { class: 'd-h3' }, 'แพ็กเกจเอกสาร'), h('p', { class: 'd-sub' }, 'ทุกแพ็กเกจล้างตามขั้นตอนเดียวกัน ต่างกันที่การวัดค่า ภาพ และรายงานที่ส่งมอบ'), pk));
  return { set: o => { Object.assign(S, o); drawSteps(); drawPrices(); } };
}

/* ---------------- ติดตั้ง ---------------- */
export function mountInstallChapter(root, { onPick, pickTo = 'ใบงาน' } = {}) {
  const S = { type: 'wall', tier: 'STANDARD' };
  const priceBox = h('div', { class: 'd-scroll', tabindex: '0', role: 'region', 'aria-label': 'ราคาติดตั้ง' });
  const matBox = h('div', { class: 'd-scroll d-mat', tabindex: '0', role: 'region', 'aria-label': 'วัสดุแต่ละระดับ' });
  const stepsBox = h('div', { class: 'd-stepsbox' });
  const draw = () => {
    const rows = installRows(S.type);
    priceBox.replaceChildren(h('table', { class: 'd-table d-price' }, h('caption', {}, `ค่าติดตั้ง${TYPE_BY_ID[S.type].th} ก่อน VAT ไม่รวมตัวเครื่อง`),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'ขนาด (BTU)'), h('th', { scope: 'col', class: 'r' }, 'มาตรฐาน'), h('th', { scope: 'col', class: 'r' }, 'พรีเมียม'))),
      h('tbody', {}, rows.map((r, i) => h('tr', {}, h('th', { scope: 'row' }, r.range),
        [['STANDARD', r.std], ['PREMIUM', r.prem]].map(([tier, it]) => h('td', { class: 'r' }, it ? h('button', { type: 'button', class: 'd-pick', title: `ใส่ใน${pickTo}`, onclick: () => onPick && onPick({ job: 'install', type: S.type, i, tier }) }, baht(it.ex)) : 'ประเมิน')))))));
    const mid = rows[0] ? rows[0].lo : 12000;
    matBox.replaceChildren(materialTable(S.type, mid, { compact: true }));
    stepsBox.replaceChildren(stepList(installSteps(S.type, S.tier), IPH));
  };
  draw();
  root.replaceChildren(h('div', { class: 'd-split' },
    h('div', { class: 'd-col' },
      tabs(TYPES4.map(t => [t, TYPE_BY_ID[t].th]), S.type, 'ประเภทแอร์', v => { S.type = v; draw(); }),
      priceBox, h('p', { class: 'd-sub' }, 'รวมท่อน้ำยาและวัสดุ 4 เมตรแรก ส่วนที่เกินเลือกเพิ่มได้ตามระยะจริง ขนาดที่ไม่มีในตารางและระบบซ่อนในฝ้าประเมินหน้างาน')),
    h('div', { class: 'd-col' }, h('h3', { class: 'd-h3' }, 'ขั้นตอนติดตั้ง'), h('p', { class: 'd-sub' }, 'ตามแบบฟอร์มงานติดตั้ง SBP-SR-ACIN-UNI-001 Rev.04 ทดสอบรอยรั่วและทำสุญญากาศก่อนเปิดวาล์วทุกงาน'),
      tabs([['STANDARD', 'มาตรฐาน'], ['PREMIUM', 'พรีเมียม']], S.tier, 'ระดับงาน', v => { S.tier = v; stepsBox.replaceChildren(stepList(installSteps(S.type, S.tier), IPH)); }), stepsBox)),
    h('div', { class: 'd-wide' }, h('h3', { class: 'd-h3' }, 'วัสดุที่ใช้ แยกตามระดับงาน'), h('p', { class: 'd-sub' }, 'ทุกรายการระบุยี่ห้อ ทองแดง O-TWO หนา 0.70 มม. ทั้งสองระดับ'), matBox));
}

/* ---------------- ซ่อม ---------------- */
export function mountRepairChapter(root, { onAll } = {}) {
  // a short, honest price list: the diagnosis fees + priced repair items from the Pricebook (unpriced = quoted on site)
  const priced = DATA.rep.filter(r => r.rate.s != null && r.cat !== 'ตรวจวินิจฉัย');
  const pick = ['ระบบน้ำทิ้ง', 'ไฟฟ้า', 'Motor', 'PCB/Control', 'Refrigerant', 'Compressor', 'Coil'];
  const list = pick.flatMap(c => priced.filter(r => r.cat === c).slice(0, 2));
  const diag = ['wall', 'ceiling'].map(diagnosis).filter(Boolean);
  root.replaceChildren(h('div', { class: 'd-split' },
    h('div', { class: 'd-col' }, h('h3', { class: 'd-h3' }, 'ขั้นตอนงานซ่อม'), h('p', { class: 'd-sub' }, 'ไม่ซ่อมก่อนลูกค้าอนุมัติ อะไหล่ที่เปลี่ยนเก็บไว้ให้ดูทุกชิ้น'), stepList(repairSteps('wall'), { pre: 'ตรวจและแจ้งผล', work: 'อนุมัติและซ่อม', test: 'ทดสอบ', hand: 'ส่งมอบ' })),
    h('div', { class: 'd-col' },
      h('h3', { class: 'd-h3' }, 'ค่าตรวจวินิจฉัย'),
      h('ul', { class: 'd-leaders' }, diag.map(d => h('li', {}, h('span', {}, d.name), h('b', {}, baht(d.rate.s)))), h('li', {}, h('span', {}, 'แอร์ตู้ตั้งพื้น'), h('b', {}, 'แจ้งก่อนนัด'))),
      h('h3', { class: 'd-h3' }, 'ตัวอย่างราคางานซ่อม'),
      h('ul', { class: 'd-leaders' }, list.map(r => h('li', {}, h('span', {}, r.name, h('small', {}, r.unit ? ` ต่อ${r.unit}` : '')), h('b', {}, baht(r.rate.s))))),
      h('p', { class: 'd-sub' }, `ราคาก่อน VAT จาก Pricebook ${DATA.rep.length} รายการ ราคาจริงแจ้งหลังตรวจ อะไหล่เฉพาะรุ่นบางรายการต้องสั่ง`),
      onAll ? h('button', { type: 'button', class: 'd-btn ghost', onclick: onAll }, `ดูราคาซ่อมทั้งหมด ${DATA.rep.length} รายการ`) : null)));
}

/* ---------------- contact form → inquiry ticket (same ticket shape as A/B/C, site.js §8) ---------------- */
export function wireContactForm(form, { variant = 'D' } = {}) {
  guardForm(form);
  const out = h('div', { class: 'd-qout', hidden: true }); form.after(out);
  const TOPIC_SVC = { 'ล้างแอร์': 'clean', 'ติดตั้งแอร์': 'install', 'ซ่อม / ตรวจเช็ก': 'repair', 'สัญญาล้างรายปี': 'amc', 'ซื้อแอร์': 'buy', 'FUJIVA': 'buy', 'งานโครงการ / รีโนเวต / เปลี่ยนทั้งชุด': 'project' };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = id => (form.querySelector('#' + id) || {}).value || '';
    const topic = v('q-topic');
    const ticket = { kind: 'inquiry', service: TOPIC_SVC[topic] || 'other', consent: true, website: (form.querySelector('[name=website]') || {}).value || '', source: sourceTag(variant),
      customer: { name: v('q-name'), tel: v('q-tel'), email: v('q-email') }, details: topic ? `เรื่อง: ${topic}` : '', notes: v('q-msg'), quote: quoteFromCart(cart) };
    const text = ['คำขอจากเว็บไซต์ SBP AirCare (แบบ D)', `ชื่อ: ${ticket.customer.name}`, `เบอร์: ${ticket.customer.tel}`, ticket.customer.email ? `อีเมล: ${ticket.customer.email}` : '', topic ? `เรื่อง: ${topic}` : '', ticket.notes].filter(Boolean).join('\n');
    await submitTicket(ticket, { out, form, label: 'คำขอ', fallback: { ref: 'R' + Date.now().toString().slice(-7), title: 'คำขอให้ทีมติดต่อกลับ', text, subject: 'ขอให้ติดต่อกลับ SBP AirCare' } });
    out.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' });
  });
}

/* ---------------- facts that come from the data (never typed by hand) ---------------- */
export function fillFacts(root = document) {
  const v = { models: DEMO.skuCount, brands: new Set(DEMO.models.map(m => m.brand)).size, min: baht(DATA.minBill), ladder: VOLUME_TIERS.find(t => t.off)?.min || 10 };
  $$('[data-fact]', root).forEach(el => { const k = el.dataset.fact; if (v[k] != null) el.textContent = typeof v[k] === 'number' ? v[k].toLocaleString('en-US') : v[k]; });
}
