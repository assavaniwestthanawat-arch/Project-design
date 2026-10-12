// SBP AirCare — customer payment box in the booking status view (Rev.10, owner 9 ต.ค. 2569: "การชำระเงินเป็นชำระออนไลน์และหน้างานได้ทั้งสองแบบ").
// paymentBox({id, tel, payment, status, onChange, onReport}) renders the public payment view the server returns with track
// (server/API.md): what the office has asked for, how to pay it (PromptPay QR to the company account · bank transfer · pay the
// technician on site · a gateway QR in phase 2), receipts. Money is never taken on this page by itself: a customer's "โอนแล้ว" is
// a report the office checks against the bank statement — only then does a receipt number appear (CLAUDE.md §6.6 #23/#24: no claim
// the server did not make). Survey / "ประเมินหน้างาน" items are never charged here: the office asks only for amounts it confirmed.
// Rev.10 UX audit: one hero amount; a reported transfer reads "รอตรวจยอด" (the money stays unpaid until the office verifies it)
// and its pay buttons fold into a secondary <details>; a rejected report, an expired request and a cancelled job each say what to
// do next; method buttons expose aria-pressed and are never disabled while focused; phones can save the QR as a picture; the
// Claude test site marks its QR / account "ทดสอบ" and never sends testers to the real company's phone.
import { h, COMPANY } from './sbp-core.js';
import { payInfo, payReport, errTh, testSite } from './ticket.js';
import { copyText } from './contact.js';

const METHOD_TH = { gateway: 'ชำระออนไลน์ (QR ยืนยันยอดอัตโนมัติ)', promptpay: 'สแกน QR พร้อมเพย์', transfer: 'โอนเข้าบัญชีบริษัท', onsite: 'ชำระหน้างานกับช่าง' };
export const thb = n => '฿' + (+n).toLocaleString('en-US', { minimumFractionDigits: +n % 1 ? 2 : 0, maximumFractionDigits: 2 });   // payments keep satang (sbp-core baht() rounds)
const money = n => (+n).toLocaleString('th-TH', { minimumFractionDigits: +n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' บาท';   // spoken form (QR alt text)
const thDate = s => (s ? new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const TONE = { paid: 'ok', unpaid: 'due', partial: 'due', expired: 'due', checking: 'pay-chk' };
const OWING = ['unpaid', 'partial', 'checking', 'expired'];
let seq = 0;
// "โทร 02-…" for the customer's next step — on the Claude test site testers are never sent to the real company
export const callUs = () => (testSite() ? ['โทรหาบริษัท (เว็บทดสอบ: ไม่ต้องโทรจริง)'] : ['โทร ', h('a', { href: COMPANY.telHref }, COMPANY.tel)]);
// rows of a small two-column fact list (label / value), the payment box's one layout for references, amounts and receipts
const facts = (...kv) => h('dl', { class: 'pay-meta' }, kv.filter(Boolean).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));

export function paymentBox({ id, tel, payment: P, status = '', onChange = null, onReport = null, hl = 'h4' }) {
  const n = ++seq, off = status === 'cancelled';
  const box = h('section', { class: 'pay', 'aria-labelledby': `pay-h-${n}` });
  const payable = off ? [] : P.requests.filter(r => r.status === 'open' && r.remaining > 0);
  const toPay = payable.filter(r => !r.submitted).reduce((a, r) => a + r.remaining, 0), sent = payable.filter(r => r.submitted).reduce((a, r) => a + r.remaining, 0);
  const lapsed = off ? [] : P.requests.filter(r => r.status === 'expired' && r.remaining > 0 && !r.submitted);
  const chip = P.statusTh && !(off && OWING.includes(P.status)) ? h('span', { class: `pay-st ${TONE[P.status] || ''}` }, P.statusTh) : null;
  box.append(h('div', { class: 'pay-h' }, h(hl, { id: `pay-h-${n}`, class: 'pay-t', tabindex: '-1' }, 'การชำระเงิน'), chip));
  // one hero figure: what to pay now · what was reported and waits for the office · what was received
  const hero = toPay > 0 ? ['ยอดที่ต้องชำระ', toPay, ''] : sent > 0 ? ['ยอดที่แจ้งโอน (รอตรวจ)', sent, ' pay-chk'] : P.paid > 0 ? ['ชำระแล้ว', P.paid, ' ok'] : null;
  if (hero) box.append(h('p', { class: 'pay-hero' + hero[2] }, h('span', {}, hero[0]), h('b', {}, thb(hero[1]))));
  const more = [toPay > 0 && sent > 0 ? ['แจ้งโอนแล้ว รอตรวจ', thb(sent)] : null, hero && hero[0] !== 'ชำระแล้ว' && P.paid > 0 ? ['ชำระแล้ว', thb(P.paid)] : null, P.refunded > 0 ? ['คืนเงินแล้ว', thb(P.refunded)] : null].filter(Boolean);
  if (more.length) box.append(facts(...more));
  if (off) box.append(h('p', { class: 'pay-call' }, 'คำขอนี้ถูกยกเลิกแล้ว จึงชำระเงินผ่านหน้านี้ไม่ได้ หากมีข้อสงสัยเรื่องการชำระเงินหรือการคืนเงิน ', ...callUs()));

  const methods = off ? [] : P.methods.filter(m => METHOD_TH[m] && !(m === 'onsite' && status === 'done'));
  for (const r of payable) {
    const did = `pay-d-${n}-${r.id}`, detail = h('div', { class: 'pay-d', id: did });
    const pick = methods.length ? h('div', { class: 'pay-m', role: 'group', 'aria-label': `เลือกวิธีชำระ ${r.kindTh}` }, methods.map(m => h('button', { type: 'button', class: 's-btn ghost', 'aria-pressed': false, 'aria-controls': did, onclick: e => choose(r, m, detail, e.currentTarget) }, METHOD_TH[m])))
      : h('p', { class: 's-note' }, 'ติดต่อบริษัทเพื่อชำระเงิน · ', ...callUs());
    box.append(h('div', { class: 'pay-req' },
      h('p', { class: 'pay-rq' }, h('b', {}, r.kindTh), payable.length > 1 ? ` ${thb(r.remaining)}` : null),
      facts(['รหัสชำระเงิน', h('b', {}, r.ref)], r.expiresAt ? ['ชำระได้ถึง', thDate(r.expiresAt)] : null),
      // reported: say so plainly and keep the pay buttons out of the way (a second transfer is the costly mistake here)
      r.submitted ? [h('p', { class: 'pay-call pay-chk' }, h('b', {}, 'แจ้งโอนแล้ว · บริษัทกำลังตรวจยอด'), ' ยอดนี้นับเป็นชำระแล้วเมื่อบริษัทยืนยันและออกเลขที่ใบเสร็จ'),
        h('details', { class: 'pay-more' }, h('summary', {}, 'ยังไม่ได้โอน หรือโอนไม่ครบ? ดูวิธีชำระอีกครั้ง'), pick, detail)]
        : [r.rejected ? h('p', { class: 'pay-call warn' }, h('b', {}, 'ยังไม่พบยอดที่แจ้งโอนไว้'), ' โปรด', ...callUs(), ' พร้อมสลิปการโอน หรือชำระอีกครั้งด้านล่าง') : null, pick, detail]));
  }
  for (const r of lapsed) box.append(h('div', { class: 'pay-req' },
    h('p', { class: 'pay-rq' }, h('b', {}, `${r.kindTh} ${thb(r.remaining)}`), ' ', h('span', { class: 'pay-x' }, 'หมดอายุ')),
    h('p', { class: 'pay-call warn' }, 'รายการนี้หมดอายุแล้ว ชำระผ่านหน้านี้ไม่ได้ ', ...callUs(), ' เพื่อขอรายการใหม่')));
  if (P.receipts.length) box.append(h('div', { class: 'pay-rc' }, h('p', { class: 'pay-rq' }, h('b', {}, 'เลขที่ใบเสร็จ')),
    P.receipts.map(x => facts(['เลขที่', h('b', {}, x.no)], ['ยอด', thb(x.amount)], ['วันที่', thDate(x.at)], ['วิธี', x.method])),
    h('p', { class: 's-note' }, 'ขอเอกสารใบเสร็จหรือใบกำกับภาษี ', ...callUs())));
  // gateways (and good practice) ask for the cancellation / refund terms right next to the pay buttons
  box.append(h('p', { class: 's-note pay-pol' }, 'บริษัทออกเลขที่ใบเสร็จเมื่อตรวจยืนยันยอดที่ได้รับจริงแล้วเท่านั้น · ', h('a', { href: './refund.html', target: '_blank', rel: 'noopener' }, 'การชำระเงิน การยกเลิก และการคืนเงิน')));

  // never `disabled` on the pressed button: Chrome drops focus to <body> — aria-busy + a token instead (the last choice wins)
  async function choose(r, m, detail, btn) {
    if (btn.getAttribute('aria-busy') === 'true') return;
    btn.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    const tok = detail.dataset.tok = String(Math.random());
    btn.setAttribute('aria-busy', 'true'); detail.replaceChildren(h('p', { class: 's-note' }, 'กำลังโหลด…'));
    try {
      const { pay } = await payInfo(id, tel, r.id, m);
      if (detail.dataset.tok === tok) detail.replaceChildren(...render(pay, r).filter(Boolean));
    } catch (e) {
      if (detail.dataset.tok === tok) detail.replaceChildren(h('p', { class: 's-note bad', role: 'alert' }, errTh(e, 'pay')), onChange && ['pay_closed', 'ticket_cancelled'].includes(e && e.code) ? h('button', { type: 'button', class: 's-btn ghost', onclick: onChange }, 'ตรวจสถานะอีกครั้ง') : '');
    } finally { btn.removeAttribute('aria-busy'); }
  }
  function render(p, r) {
    const test = p.test ? h('p', { class: 'pay-test' }, h('b', {}, 'QR / บัญชีทดสอบ — ห้ามโอนเงินจริง'), ' กด "แจ้งว่าโอนแล้ว" เพื่อทดลองขั้นตอน') : null;
    const amount = ['ยอดชำระ', h('b', {}, thb(p.amount))];
    if (p.method === 'onsite') return [facts(amount, ['ผู้รับเงิน', p.payee]), h('p', {}, 'ชำระกับช่างในวันเข้างาน ช่างบันทึกการรับเงิน แล้วบริษัทตรวจยืนยันและออกเลขที่ใบเสร็จ')];
    const report = p.method === 'gateway' ? null : reportForm(p, r);
    if (p.method === 'promptpay' || p.method === 'gateway') {
      const img = p.qr ? h('img', { class: 'pay-qr', src: p.qr, width: 240, height: 240, alt: `QR พร้อมเพย์ ยอด ${money(p.amount)} ผู้รับเงิน ${p.payee}${p.test ? ' (ทดสอบ ห้ามโอนเงินจริง)' : ''}` }) : null;
      // no save button on the Claude test site: its QR is a test code and the artifact viewer never lets a page hand over a file
      const save = img && /^data:image\//.test(p.qr) && !testSite() ? saveQr(img, `${id}-${p.ref}`, p) : null;
      // a phone cannot scan its own screen: save the picture, then "scan from album" in the bank app
      const coarse = matchMedia('(pointer:coarse)').matches;
      const first = !coarse ? 'เปิดแอปธนาคารในมือถือ เลือกสแกน QR' : save ? 'กด "บันทึกรูป QR" แล้วเปิดแอปธนาคาร เลือกสแกน และเลือกรูป QR จากอัลบั้ม (หรือสแกนจากอีกเครื่อง)' : 'บันทึกภาพหน้าจอ QR แล้วเปิดแอปธนาคาร เลือกสแกนจากรูปภาพ (หรือสแกนจากอีกเครื่อง)';
      return [test, img ? h('div', { class: 'pay-qrw' + (p.test ? ' test' : '') }, img) : null, save,
        facts(amount, ['ผู้รับเงิน', p.payee], p.promptpay ? ['พร้อมเพย์', p.promptpay] : null),
        h('ol', { class: 'pay-how' }, h('li', {}, first), h('li', {}, `ตรวจว่าชื่อผู้รับเงินคือ ${p.payee} และยอดตรงกัน แล้วยืนยัน`),
          p.method === 'gateway' ? h('li', {}, 'ระบบได้รับยอดจากผู้ให้บริการรับชำระโดยตรง กดตรวจสถานะอีกครั้งหลังชำระ') : h('li', {}, 'กด "แจ้งว่าโอนแล้ว" ด้านล่าง เพื่อให้บริษัทตรวจยอด')),
        report, p.method === 'gateway' && onChange ? h('button', { type: 'button', class: 's-btn ghost', onclick: onChange }, 'ตรวจสถานะการชำระ') : null];
    }
    const b = p.bank || {};
    const msg = h('span', { class: 's-tk-m', 'aria-live': 'polite' });
    const copy = h('button', { type: 'button', class: 's-hand-x', onclick: async () => { msg.textContent = (await copyText(String(b.accountNo).replace(/\D/g, ''))) ? 'คัดลอกแล้ว' : 'เลือกเลขบัญชีแล้วคัดลอกจากเครื่องของคุณ'; } }, 'คัดลอก');
    return [test, facts(amount, ['ธนาคาร', b.name], ['ชื่อบัญชี', b.accountName], ['เลขที่บัญชี', [h('b', {}, b.accountNo), ' ', copy, msg]]),
      h('p', { class: 's-note' }, `ใส่รหัสชำระเงิน ${p.ref} ในบันทึกการโอน (ถ้าแอปมีช่องบันทึก) เพื่อให้ตรวจยอดได้เร็ว`), report];
  }
  function reportForm(p, r) {
    const ref = h('input', { maxlength: '60', autocomplete: 'off', placeholder: 'เช่น เวลาโอน 14:05 หรือ 4 ตัวท้ายบัญชีผู้โอน' });
    const out = h('p', { class: 's-note', role: 'status' });
    const btn = h('button', { type: 'submit', class: 's-btn primary' }, 'แจ้งว่าโอนแล้ว');
    return h('form', { class: 'pay-rep', onsubmit: async e => {
      e.preventDefault(); if (btn.getAttribute('aria-busy') === 'true') return;
      btn.setAttribute('aria-busy', 'true'); btn.setAttribute('aria-disabled', 'true'); out.textContent = 'กำลังส่ง…'; out.classList.remove('bad');
      try {
        const res = await payReport(id, tel, r.id, p.method === 'transfer' ? 'transfer' : 'promptpay', ref.value);
        // the reply already carries the new public view: re-render from it (no second track call that could hit a limit)
        if (onReport && res && res.payment) { onReport(res.payment); return; }
        out.textContent = 'แจ้งแล้ว บริษัทจะตรวจยอดในบัญชีแล้วยืนยัน ตรวจสถานะได้ที่นี่ด้วยเลขที่คำขอและเบอร์โทร';
      } catch (err) { out.textContent = errTh(err, 'report'); out.classList.add('bad'); }
      finally { btn.removeAttribute('aria-busy'); btn.removeAttribute('aria-disabled'); }
    } }, h('label', { class: 's-field' }, 'ข้อมูลจากสลิป (ไม่บังคับ)', ref), btn, out);
  }
  return box;
}

// the QR as a PNG picture (white card + amount / payee / reference under it) for the bank app's "scan from album";
// a canvas the browser refuses to export (older Safari with SVG) keeps the original SVG data URL
function saveQr(img, name, p) {
  const a = h('a', { class: 's-btn ghost pay-save', href: img.src, download: name + '.svg' }, 'บันทึกรูป QR');
  const png = () => {
    try {
      const W = 600, c = document.createElement('canvas'); c.width = W; c.height = W + 100;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, W, W);
      g.fillStyle = '#0F1C2B'; g.textAlign = 'center'; g.font = '600 28px sans-serif'; g.fillText(`${thb(p.amount)} · ${p.payee}`, W / 2, W + 36, W - 24);
      g.font = '22px sans-serif'; g.fillText(`${name}${p.test ? ' · ทดสอบ ห้ามโอนเงินจริง' : ''}`, W / 2, W + 76, W - 24);
      a.href = c.toDataURL('image/png'); a.download = name + '.png';
    } catch (e) { /* keep the SVG */ }
  };
  if (img.complete && img.naturalWidth) png(); else img.addEventListener('load', png, { once: true });
  return a;
}
