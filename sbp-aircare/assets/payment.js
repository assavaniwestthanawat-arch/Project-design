// SBP AirCare — customer payment box in the booking status view (Rev.10, owner 9 ต.ค. 2569: "การชำระเงินเป็นชำระออนไลน์และหน้างานได้ทั้งสองแบบ").
// paymentBox({id, tel, payment, onChange}) renders the public payment view the server returns with track (server/API.md):
// what the office has asked for, how to pay it (PromptPay QR to the company account · bank transfer · pay the technician on
// site · a gateway QR in phase 2), receipts. Money is never taken on this page by itself: a customer's "โอนแล้ว" is a report
// the office checks against the bank statement — only then does a receipt number appear (CLAUDE.md §6.6 #23: no claim the
// server did not make). Survey / "ประเมินหน้างาน" items are never charged here: the office asks only for amounts it confirmed.
import { h, COMPANY } from './sbp-core.js';
import { payInfo, payReport, errTh } from './ticket.js';
import { copyText } from './contact.js';

const METHOD_TH = { gateway: 'ชำระออนไลน์ (QR ยืนยันยอดอัตโนมัติ)', promptpay: 'สแกน QR พร้อมเพย์', transfer: 'โอนเข้าบัญชีบริษัท', onsite: 'ชำระหน้างานกับช่าง' };
const money = n => (+n).toLocaleString('th-TH', { minimumFractionDigits: +n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' บาท';
const thDate = s => (s ? new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function paymentBox({ id, tel, payment: P, onChange = null, hl = 'h4' }) {
  const box = h('section', { class: 'pay', 'aria-label': 'การชำระเงิน' });
  const tone = P.status === 'paid' ? 'ok' : P.status === 'unpaid' || P.status === 'partial' ? 'due' : '';
  box.append(h('div', { class: 'pay-h' }, h(hl, {}, 'การชำระเงิน'), P.statusTh ? h('span', { class: `pay-st ${tone}` }, P.statusTh) : null));
  const dl = h('dl', { class: 'pay-sum' });
  const row = (k, v) => dl.append(h('dt', {}, k), h('dd', {}, v));
  if (P.due > 0) row('ยอดที่ต้องชำระ', h('b', {}, money(P.due)));
  if (P.paid > 0) row('ชำระแล้ว', money(P.paid));
  if (P.refunded > 0) row('คืนเงินแล้ว', money(P.refunded));
  if (dl.children.length) box.append(dl);
  if (P.pending) box.append(h('p', { class: 's-note pay-wait' }, 'ได้รับแจ้งการโอนแล้ว บริษัทกำลังตรวจยอดในบัญชี ยอดนี้จะนับเป็นชำระแล้วเมื่อบริษัทยืนยันและออกเลขที่ใบเสร็จ'));

  for (const r of P.requests.filter(x => x.status === 'open' && x.remaining > 0)) {
    const detail = h('div', { class: 'pay-d', 'aria-live': 'polite' });
    const methods = P.methods.filter(m => METHOD_TH[m]);
    box.append(h('div', { class: 'pay-req' },
      h('p', { class: 'pay-rq' }, h('b', {}, `${r.kindTh} ${money(r.remaining)}`), h('small', {}, ` · รหัสอ้างอิง ${r.ref}${r.expiresAt ? ' · ชำระได้ถึง ' + thDate(r.expiresAt) : ''}`)),
      r.submitted ? h('p', { class: 's-note' }, 'รายการนี้แจ้งโอนแล้ว รอบริษัทตรวจยอด') : null,
      methods.length ? h('div', { class: 'pay-m', role: 'group', 'aria-label': 'เลือกวิธีชำระ' }, methods.map(m => h('button', { type: 'button', class: 's-btn' + (m === methods[0] ? ' primary' : ' ghost'), onclick: e => choose(r, m, detail, e.currentTarget) }, METHOD_TH[m])))
        : h('p', { class: 's-note' }, 'ติดต่อบริษัทเพื่อชำระเงิน · โทร ', h('a', { href: COMPANY.telHref }, COMPANY.tel)),
      detail));
  }
  if (P.receipts.length) box.append(h('div', { class: 'pay-rc' }, h('p', { class: 'pay-rq' }, h('b', {}, 'ใบเสร็จรับเงิน')),
    h('ul', {}, P.receipts.map(x => h('li', {}, h('b', {}, x.no), ` · ${money(x.amount)} · ${thDate(x.at)} · ${x.method}`)))));
  // gateways (and good practice) ask for the cancellation / refund terms right next to the pay buttons
  box.append(h('p', { class: 's-note pay-pol' }, 'บริษัทยืนยันยอดจากบัญชีธนาคารก่อนออกใบเสร็จทุกครั้ง · ', h('a', { href: './refund.html', target: '_blank', rel: 'noopener' }, 'เงื่อนไขการยกเลิกและคืนเงิน')));

  async function choose(r, m, detail, btn) {
    btn.disabled = true; detail.replaceChildren(h('p', { class: 's-note' }, 'กำลังโหลด…'));
    try {
      const { pay } = await payInfo(id, tel, r.id, m);
      detail.replaceChildren(...render(pay, r).filter(Boolean));
    } catch (e) { detail.replaceChildren(h('p', { class: 's-note bad', role: 'alert' }, errTh(e))); }
    finally { btn.disabled = false; }
  }
  function render(p, r) {
    const amount = h('p', { class: 'pay-amt' }, 'ยอดชำระ ', h('b', {}, money(p.amount)), ' · ผู้รับเงิน ', p.payee);
    if (p.method === 'onsite') return [h('p', {}, 'ชำระกับช่างในวันเข้างานได้ด้วยเงินสด โอน หรือสแกน QR พร้อมเพย์ของบริษัท ช่างบันทึกการรับเงินเข้าระบบ แล้วบริษัทยืนยันยอดและออกเลขที่ใบเสร็จ'), amount];
    const report = p.method === 'gateway' ? null : reportForm(p, r);
    if (p.method === 'promptpay' || p.method === 'gateway') return [
      p.qr ? h('img', { class: 'pay-qr', src: p.qr, width: 240, height: 240, alt: `QR พร้อมเพย์ ยอด ${money(p.amount)} ผู้รับเงิน ${p.payee}` }) : null,
      amount, p.promptpay ? h('p', { class: 's-note' }, `พร้อมเพย์ของบริษัท ${p.promptpay}`) : null,
      h('ol', { class: 'pay-how' }, h('li', {}, 'เปิดแอปธนาคาร เลือกสแกน QR'), h('li', {}, `ตรวจว่าชื่อผู้รับเงินคือ ${p.payee} และยอดตรงกัน แล้วยืนยัน`),
        p.method === 'gateway' ? h('li', {}, 'ระบบได้รับยอดจากผู้ให้บริการรับชำระโดยตรง กดตรวจสถานะอีกครั้งหลังชำระ') : h('li', {}, 'กด "แจ้งว่าโอนแล้ว" ด้านล่าง เพื่อให้บริษัทตรวจยอด')),
      report, p.method === 'gateway' && onChange ? h('button', { type: 'button', class: 's-btn ghost', onclick: onChange }, 'ตรวจสถานะการชำระ') : null];
    const b = p.bank || {};
    const msg = h('span', { class: 's-tk-m', 'aria-live': 'polite' });
    return [amount, h('dl', { class: 'pay-bank' }, h('dt', {}, 'ธนาคาร'), h('dd', {}, b.name), h('dt', {}, 'ชื่อบัญชี'), h('dd', {}, b.accountName),
      h('dt', {}, 'เลขที่บัญชี'), h('dd', {}, h('b', {}, b.accountNo), ' ', h('button', { type: 'button', class: 's-hand-x', onclick: async () => { msg.textContent = (await copyText(String(b.accountNo).replace(/\D/g, ''))) ? 'คัดลอกแล้ว' : 'เลือกเลขบัญชีแล้วคัดลอกจากเครื่องของคุณ'; } }, 'คัดลอก'), msg)),
      h('p', { class: 's-note' }, `ใส่รหัสอ้างอิง ${p.ref} ในบันทึกการโอน (ถ้าแอปมีช่องบันทึก) เพื่อให้ตรวจยอดได้เร็ว`), report];
  }
  function reportForm(p, r) {
    const ref = h('input', { maxlength: '60', autocomplete: 'off', placeholder: 'เช่น เวลาโอน 14:05 หรือ 4 ตัวท้ายบัญชีผู้โอน' });
    const out = h('p', { class: 's-note', 'aria-live': 'polite' });
    const btn = h('button', { type: 'submit', class: 's-btn primary' }, 'แจ้งว่าโอนแล้ว');
    return h('form', { class: 'pay-rep', onsubmit: async e => {
      e.preventDefault(); btn.disabled = true; out.textContent = 'กำลังส่ง…'; out.classList.remove('bad');
      try {
        await payReport(id, tel, r.id, p.method === 'transfer' ? 'transfer' : 'promptpay', ref.value);
        out.textContent = 'แจ้งแล้ว บริษัทจะตรวจยอดในบัญชีแล้วยืนยัน ตรวจสถานะได้ที่นี่ด้วยเลขที่คำขอและเบอร์โทร';
        if (onChange) setTimeout(onChange, 1200);
      } catch (err) { out.textContent = errTh(err); out.classList.add('bad'); }
      finally { btn.disabled = false; }
    } }, h('label', { class: 's-field' }, 'ข้อมูลช่วยตรวจยอด (ไม่บังคับ)', ref), btn, out);
  }
  return box;
}
