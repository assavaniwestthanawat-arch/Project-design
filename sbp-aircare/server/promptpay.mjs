// SBP AirCare server — PromptPay (Thai QR, EMVCo merchant-presented, tag 29) payload + QR image. Rev.10. No network.
// The QR pays straight into the company's own PromptPay (13-digit tax id, 10-digit phone or 15-digit e-wallet id);
// nothing is confirmed automatically — the office checks the bank statement before marking a payment as received.
import { qrcode } from './vendor/qrcode.mjs';

const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
export function crc16(str) {   // CRC-16/CCITT-FALSE, as the Thai QR standard requires
  let crc = 0xffff;
  for (const b of Buffer.from(str, 'ascii')) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function promptpayPayload(id, amountSatang) {
  const d = String(id || '').replace(/\D/g, '');
  if (!/^(\d{10}|\d{13}|\d{15})$/.test(d)) throw new Error('PromptPay id must be 10, 13 or 15 digits');
  if (!Number.isInteger(amountSatang) || amountSatang <= 0) throw new Error('amount must be a positive whole number of satang');
  // sub-tag 01 = mobile (0066 + number without the leading 0), 02 = national / tax id, 03 = e-wallet
  const sub = d.length === 15 ? '03' : d.length === 13 ? '02' : '01';
  const target = d.length === 10 ? '0066' + d.slice(1) : d;
  const p = tlv('00', '01') + tlv('01', '12')   // 12 = dynamic QR (one amount, one payment)
    + tlv('29', tlv('00', 'A000000677010111') + tlv(sub, target))
    + tlv('53', '764') + tlv('54', (amountSatang / 100).toFixed(2)) + tlv('58', 'TH') + '6304';
  return p + crc16(p);
}

// QR as a self-contained SVG data: URL (shown with <img>, so the page CSP needs no inline SVG/script)
export function qrDataUrl(text, { cell = 8, margin = 4 } = {}) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), size = (n + margin * 2) * cell;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${(c + margin) * cell} ${(r + margin) * cell}h${cell}v${cell}h-${cell}z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="${d}"/></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

// show only the last digits of the account the money goes to (customers still see the payee name)
export const maskId = id => { const d = String(id || '').replace(/\D/g, ''); return d ? d.slice(0, 1) + 'x'.repeat(Math.max(0, d.length - 5)) + d.slice(-4) : ''; };
